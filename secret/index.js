exports.rollbar = {
  accessToken: 'TODO'
}

exports.stunServers = [
  'stun:relay.socket.dev:443'
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
