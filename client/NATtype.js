/* global RTCPeerConnection */

const DEFAULT_ICE_SERVERS = [
  /* Note, as pf July 21st, 2022, these google servers
  were testing extremely slow now.
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  */
  { urls: 'stun:global.stun.twilio.com:3478' }
]

function parseCandidate (line) {
  let parts
  // Parse both variants.
  if (line.indexOf('a=candidate:') === 0) {
    parts = line.substring(12).split(' ')
  } else {
    parts = line.substring(10).split(' ')
  }

  const candidate = {
    foundation: parts[0],
    component: parts[1],
    protocol: parts[2].toLowerCase(),
    priority: parseInt(parts[3], 10),
    ip: parts[4],
    port: parseInt(parts[5], 10),
    // skip parts[6] == 'typ'
    type: parts[7]
  }

  for (let i = 8; i < parts.length; i += 2) {
    switch (parts[i]) {
      case 'raddr':
        candidate.relatedAddress = parts[i + 1]
        break
      case 'rport':
        candidate.relatedPort = parseInt(parts[i + 1], 10)
        break
      case 'tcptype':
        candidate.tcpType = parts[i + 1]
        break
      default: // Unknown extensions are silently ignored.
        break
    }
  }
  return candidate
};

// This function will determine the NAT type. After three seconds of no
exports.fetchNATtype = function fetchNATtype (cb, timeout = 0, optIceServers = undefined) {
  cb = cb || console.log
  const candidates = {}
  const rtcOptions = { iceServers: optIceServers || DEFAULT_ICE_SERVERS }

  let timedoutJob = null
  let timedout = false
  if (timeout > 0) {
    timedoutJob = setTimeout(() => {
      timedout = true
      cb('timed out') // eslint-disable-line
    }, timeout)
  }

  const pc = new RTCPeerConnection(rtcOptions)
  pc.createDataChannel('foo')
  pc.onicecandidate = function (rtcPeerConnectionIceEvent) {
    if (timedout) return
    // rtcPeerConnectionIceEvent is type RTCPeerConnectionIceEvent
    console.log('onicecandidate', rtcPeerConnectionIceEvent)
    const rtcIceCandidate = rtcPeerConnectionIceEvent.candidate
    if (rtcPeerConnectionIceEvent.candidate && rtcIceCandidate.candidate.indexOf('srflx') !== -1) {
      // Candidate is a server relexive candidate and the ip indicates an intermediary
      // address assigned by the STUN server to represent the candidate's peer anonymously.
      // console.log('found srflx candidate')
      const cand = parseCandidate(rtcPeerConnectionIceEvent.candidate.candidate)
      if (!candidates[cand.relatedPort]) candidates[cand.relatedPort] = []
      candidates[cand.relatedPort].push(cand.port)
    } else if (!rtcPeerConnectionIceEvent.candidate) {
      // onsole.log("no more candidates")
      if (Object.keys(candidates).length === 1) {
        clearTimeout(timedoutJob)
        const ports = candidates[Object.keys(candidates)[0]]
        if (ports.length === 1) {
          cb('Permissive NAT')  // eslint-disable-line
        } else {
          cb('Symmetric NAT')  // eslint-disable-line
        }
      }
    }
  }
  // Initiates the creation of an SDP offer for the purpose of starting a new WebRTC
  // connection to a remote peer.
  pc.createOffer()
    .catch(err => { console.log(`createOffer error: ${err}`) })
    .then(offer => pc.setLocalDescription(offer))
}
