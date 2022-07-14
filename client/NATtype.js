/* global RTCPeerConnection */

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
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

exports.fetchNATtype = function fetchNATtype (cb) {
  cb = cb || console.log
  const candidates = {}
  const rtcOptions = { iceServers: ICE_SERVERS }
  const pc = new RTCPeerConnection(rtcOptions)
  pc.createDataChannel('foo')
  pc.onicecandidate = function (e) {
    // console.log("onicecandidate", e)
    if (e.candidate && e.candidate.candidate.indexOf('srflx') !== -1) {
      // console.log('found srflx candidate')
      const cand = parseCandidate(e.candidate.candidate)
      if (!candidates[cand.relatedPort]) candidates[cand.relatedPort] = []
      candidates[cand.relatedPort].push(cand.port)
    } else if (!e.candidate) {
      // onsole.log("no more candidates")
      if (Object.keys(candidates).length === 1) {
        const ports = candidates[Object.keys(candidates)[0]]
        if (ports.length === 1) {
          cb('Permissive NAT')  // eslint-disable-line
        } else {
          cb('Symmetric NAT')  // eslint-disable-line
        }
      }
    }
  }
  pc.createOffer()
    .then(offer => pc.setLocalDescription(offer))
}
