const debug = require('debug')('instant.io')
const dragDrop = require('drag-drop')
const escapeHtml = require('escape-html')
const formatDistance = require('date-fns/formatDistance')
const path = require('path')
const prettierBytes = require('prettier-bytes')
const throttle = require('throttleit')
const uploadElement = require('upload-element')
const WebTorrent = require('webtorrent')
const JSZip = require('jszip')
const util = require('./util')
const fetchNATtype = require('./NATtype').fetchNATtype
const rtcConfig = require('../secret/index').rtcConfig

//const DEFAULT_TRACKERS = ['wss://webtorrent-tracker.onrender.com']
const DEFAULT_TRACKERS = ['wss://tracker.openwebtorrent.com', "wss://tracker.btorrent.xyz", ]

function getDefaultTracker () {
  let trackerUrl = new URLSearchParams(window.location.search).get('tracker')
  if (trackerUrl) {
    // Auto-add the protocol if it's missing (but disable this feature on localhost)
    if (trackerUrl.indexOf('//') === -1 && trackerUrl.indexOf('localhost') === -1) {
      // Add wss prefix.
      trackerUrl = 'wss://' + trackerUrl
    }
    // if trackerURL ends with /, remove it
    if (trackerUrl.endsWith('/')) {
      trackerUrl = trackerUrl.slice(0, -1)
    }
    return [trackerUrl]
  } else {
    return DEFAULT_TRACKERS
  }
}

const domTracker = document.getElementById('trackers')
domTracker.value = getDefaultTracker().join(',')

function getWebtorrentOptions () {
  return { announce: getTrackerList() }
}

const WEBTORRENT_CONFIG = {
  tracker: {
    rtcConfig
  }
}

// Define this to list of your tracker's announce urls.
// const DEFAULT_TRACKERS = ['ws://localhost:8000/']
// Overrides if url search params has tracker=<url>
function getTrackerList () {
  const trackers = []
  domTracker.value.split(',').forEach(tracker => {
    tracker = tracker.trim()
    if (tracker) {
      trackers.push(tracker)
    }
  })

  function checkTrackerUrl (url) {
    if (url.indexOf('//') === 0) {
      util.error('Tracker url missing wss:// prefix: ' + url)
      return
    }
    if (url.endsWith('/')) {
      util.error('Tracker url ends with /: ' + url)
    }
  }
  trackers.forEach(checkTrackerUrl)
  return trackers
}

function newWebtorrentClient () {
  // console.log('getClient options:', options)
  const client = new WebTorrent(WEBTORRENT_CONFIG)
  client.on('warning', util.warning)
  client.on('error', util.error)
  return client
}

const webtorrentClient = window.webtorrentClient = newWebtorrentClient()

function init () {
  if (!WebTorrent.WEBRTC_SUPPORT) {
    util.error('This browser is unsupported. Please use a browser with WebRTC support.')
  }
  const dom = document.getElementById('p-nat-type')
  let natFetched = false
  fetchNATtype(natType => {
    natFetched = true
    if (natType.indexOf('Symmetric') !== -1) {
      dom.innerHTML = 'You have a <b style="color: red;">' + natType + '</b> type, and this site will not work.'
    } else {
      dom.innerHTML = 'You have a <b>' + natType + '</b> type.'
    }
  })

  const timeoutTask = () => { if (!natFetched) dom.innerHTML = '(still waiting for NAT type)' }
  setTimeout(timeoutTask, 4000)
  // Seed via upload input element
  const upload = document.querySelector('input[name=upload]')
  if (upload) {
    uploadElement(upload, function (err, files) {
      if (err) return util.error(err)
      files = files.map(function (file) { return file.file })
      onFiles(files)
    })
  }

  // Seed via drag-and-drop
  dragDrop('body', onFiles)

  // Download via input element
  const form = document.querySelector('form')
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      downloadTorrent(document.querySelector('form textarea[name=torrentId]').value.trim())
    })
  }

  // Download by URL hash
  onHashChange()
  window.addEventListener('hashchange', onHashChange)
  function onHashChange () {
    const hash = decodeURIComponent(window.location.hash.substring(1)).trim()
    if (hash !== '') downloadTorrent(hash)
  }

  // Register a protocol handler for "magnet:" (will prompt the user)
  if ('registerProtocolHandler' in navigator) {
    navigator.registerProtocolHandler('magnet', window.location.origin + '#%s', 'Instant.io')
  }

  // Register a service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
  }
}

function onFiles (files) {
  debug('got files:')
  files.forEach(function (file) {
    debug(' - %s (%s bytes)', file.name, file.size)
  })

  // get the tracking servers
  getTrackerList().forEach(tracker => {
    const correctSchema = tracker.startsWith('wss://') || tracker.startsWith('ws://')
    if (!correctSchema) {
      window.alert(`WARNING! Tracker "${tracker}" is invalid!\nTracker url must start with wss:// or ws://`)
    }
  })

  // .torrent file = start downloading the torrent
  files.filter(isTorrentFile).forEach(downloadTorrentFile)

  // everything else = seed these files
  seed(files.filter(isNotTorrentFile))
}

function isTorrentFile (file) {
  const extname = path.extname(file.name).toLowerCase()
  return extname === '.torrent'
}

function isNotTorrentFile (file) {
  return !isTorrentFile(file)
}

function downloadTorrent (torrentId) {
  util.unsafeLog('Downloading torrent:<br><br><strong>' + escapeHtml(torrentId) + '</strong>')
  webtorrentClient.add(torrentId, getWebtorrentOptions(), onTorrent)
}

function downloadTorrentFile (file) {
  util.unsafeLog('Downloading torrent:<br><br><strong>' + escapeHtml(file.name) + '</strong>')
  webtorrentClient.add(file, getWebtorrentOptions(), onTorrent)
}

function seed (files) {
  if (files.length === 0) return
  util.log('Seeding ' + files.length + ' files')
  // Seed from WebTorrent
  webtorrentClient.seed(files, getWebtorrentOptions(), onTorrent)
}

function onTorrent (torrent) {
  torrent.on('warning', util.warning)
  torrent.on('error', util.error)

  const upload = document.querySelector('input[name=upload]')
  upload.value = upload.defaultValue // reset upload element

  const torrentFileName = path.basename(torrent.name, path.extname(torrent.name)) + '.torrent'

  util.log('"' + torrentFileName + '" contains ' + torrent.files.length + ' files:')

  torrent.files.forEach(function (file) {
    util.unsafeLog('&nbsp;&nbsp;- ' + escapeHtml(file.name) + ' (' + escapeHtml(prettierBytes(file.length)) + ')')
  })

  util.log('Torrent info hash: ' + torrent.infoHash)
  util.unsafeLog(
    '<a href="/#' + escapeHtml(torrent.infoHash) + '" onclick="prompt(\'Share this link with anyone you want to download this torrent:\', this.href);return false;">[Share link]</a> ' +
    '<a href="' + escapeHtml(torrent.magnetURI) + '" target="_blank">[Magnet URI]</a> ' +
    '<a href="' + escapeHtml(torrent.torrentFileBlobURL) + '" target="_blank" download="' + escapeHtml(torrentFileName) + '">[Download .torrent]</a>'
  )

  function updateSpeed () {
    const progress = (100 * torrent.progress).toFixed(1)

    let remaining
    if (torrent.done) {
      remaining = 'Done.'
    } else {
      remaining = torrent.timeRemaining !== Infinity
        ? formatDistance(torrent.timeRemaining, 0, { includeSeconds: true })
        : 'Infinity years'
      remaining = remaining[0].toUpperCase() + remaining.substring(1) + ' remaining.'
    }

    util.updateSpeed(
      '<b>Peers:</b> ' + torrent.numPeers + ' ' +
      '<b>Progress:</b> ' + progress + '% ' +
      '<b>Download speed:</b> ' + prettierBytes(webtorrentClient.downloadSpeed) + '/s ' +
      '<b>Upload speed:</b> ' + prettierBytes(webtorrentClient.uploadSpeed) + '/s ' +
      '<b>ETA:</b> ' + remaining
    )
  }

  torrent.on('download', throttle(updateSpeed, 250))
  torrent.on('upload', throttle(updateSpeed, 250))
  setInterval(updateSpeed, 5000)
  updateSpeed()

  torrent.files.forEach(function (file) {
    // append file
    file.appendTo(util.logElem, {
      maxBlobLength: 2 * 1000 * 1000 * 1000 // 2 GB
    }, function (err, elem) {
      if (err) return util.error(err)
    })

    // append download link
    file.getBlobURL(function (err, url) {
      if (err) return util.error(err)

      const a = document.createElement('a')
      a.target = '_blank'
      a.download = file.name
      a.href = url
      a.textContent = 'Download ' + file.name
      util.appendElemToLog(a)
    })
  })

  const downloadZip = document.createElement('a')
  downloadZip.href = '#'
  downloadZip.target = '_blank'
  downloadZip.textContent = 'Download all files as zip'
  downloadZip.addEventListener('click', function (event) {
    let addedFiles = 0
    const zipFilename = path.basename(torrent.name, path.extname(torrent.name)) + '.zip'
    let zip = new JSZip()
    event.preventDefault()

    torrent.files.forEach(function (file) {
      file.getBlob(function (err, blob) {
        addedFiles += 1
        if (err) return util.error(err)

        // add file to zip
        zip.file(file.path, blob)

        // start the download when all files have been added
        if (addedFiles === torrent.files.length) {
          if (torrent.files.length > 1) {
            // generate the zip relative to the torrent folder
            zip = zip.folder(torrent.name)
          }
          zip.generateAsync({ type: 'blob' })
            .then(function (blob) {
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.download = zipFilename
              a.href = url
              a.click()
              setTimeout(function () {
                URL.revokeObjectURL(url)
              }, 30 * 1000)
            }, util.error)
        }
      })
    })
  })
  util.appendElemToLog(downloadZip)
}

init()

// if there is a url in the search params then use that to...
const magnetUrl = new URLSearchParams(window.location.search).get('magnet')
if (magnetUrl) {
  document.getElementById('input-torrent-id').value = magnetUrl
  document.getElementById('btn-submit').click()
}
