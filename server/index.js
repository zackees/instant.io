require('./rollbar')

const compress = require('compression')
const cors = require('cors')
const express = require('express')
const http = require('http')
const pug = require('pug')
const path = require('path')

const config = require('../config')

const PORT = Number(process.argv[2]) || 4000

let secret
try {
  secret = require('../secret')
} catch (err) {}

const app = express()
const server = http.createServer(app)

// Todo, periodically update stunServers so that we have more redundancy.
const stunServers = secret.stunServers

// Trust "X-Forwarded-For" and "X-Forwarded-Proto" nginx headers
app.enable('trust proxy')

// Disable "powered by express" header
app.set('x-powered-by', false)

// Use pug for templates
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')
app.engine('pug', pug.renderFile)

// Pretty print JSON
app.set('json spaces', 2)

// Use GZIP
app.use(compress())

app.use(function (req, res, next) {
  // Force SSL
  if (config.isProd && req.protocol !== 'https') {
    return res.redirect('https://' + (req.hostname || 'instant.io') + req.url)
  }

  // Redirect www to non-www
  if (req.hostname.startsWith('www.')) {
    return res.redirect('https://' + req.hostname.slice(4) + req.url)
  }

  // Add cross-domain header for fonts, required by spec, Firefox, and IE.
  const extname = path.extname(req.url)
  if (['.eot', '.ttf', '.otf', '.woff', '.woff2'].indexOf(extname) >= 0) {
    res.header('Access-Control-Allow-Origin', '*')
  }

  // Prevents IE and Chrome from MIME-sniffing a response. Reduces exposure to
  // drive-by download attacks on sites serving user uploaded content.
  res.header('X-Content-Type-Options', 'nosniff')

  // Enable the XSS filter built into most recent web browsers. It's usually
  // enabled by default anyway, so role of this headers is to re-enable for this
  // particular website if it was disabled by the user.
  res.header('X-XSS-Protection', '1; mode=block')

  // Force IE to use latest rendering engine or Chrome Frame
  res.header('X-UA-Compatible', 'IE=Edge,chrome=1')

  next()
})

app.use(express.static(path.join(__dirname, '../static')))

app.get('/', function (req, res) {
  res.render('index', {
    title: 'Webtorrentseeder - Utility for seeding torrents'
  })
})

function makeRtcConfig () {
  const rtcConfig = {
    iceServers: [
      {
        urls: stunServers
      }
    ],
    // Turn servers would normally go here but we don't want to support that code path.
    sdpSemantics: 'unified-plan',
    bundlePolicy: 'max-bundle',
    iceCandidatePoolsize: 1
  }
  return rtcConfig
}

app.get('/config', cors({
  origin: function (origin, cb) {
    cb(null, true)
  }
}), function (req, res) {
  console.log('/config request', req.query)
  const rtcConfig = makeRtcConfig()
  res.send({ rtcConfig })
})

// app.get('/500', (req, res, next) => {
//   next(new Error('Manually visited /500'))
// })

app.get('*', function (req, res) {
  res.status(404).render('error', {
    title: '404 Page Not Found - Webtorrentseeder.com',
    message: '404 Not Found'
  })
})

if (global.rollbar) app.use(global.rollbar.errorHandler())

// error handling middleware
app.use(function (err, req, res, next) {
  console.error(err.stack)
  const code = typeof err.code === 'number' ? err.code : 500
  res.status(code).render('error', {
    title: '500 Internal Server Error - Instant.io',
    message: err.message || err
  })
})

server.listen(PORT, '0.0.0.0', function () {
  console.log('listening on port %s', server.address().port)
})
