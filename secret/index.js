exports.rollbar = {
  accessToken: 'TODO'
}

exports.stunServers = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:global.stun.twilio.com:3478'
]

exports.rtcConfig = {
  iceServers: [
    {
      urls: exports.stunServers
    }
    /*
    {
      urls: [
        'turn:TODO:443?transport=udp',
        'turn:TODO:443?transport=tcp',
        'turns:TODO:443?transport=tcp'
      ],
      username: 'TODO',
      credential: 'TODO'
    }

    {
      urls: [
        'turn:localhost:443?transport=udp',
        'turn:localhost:443?transport=tcp',
        'turns:localhost:443?transport=tcp'
      ],
      username: 'TODO',
      credential: 'TODO'
    }    */
  ],
  sdpSemantics: 'unified-plan',
  bundlePolicy: 'max-bundle',
  iceCandidatePoolsize: 1
}
