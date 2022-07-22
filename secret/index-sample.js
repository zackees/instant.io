exports.rollbar = {
  accessToken: 'TODO'
}

exports.rtcConfig = {
  iceServers: [
    {
      urls: [
        'stun:global.stun.twilio.com:3478',
        'stun:stun.l.google.com:19302' // Slow or timing out as of July 21, 2022
      ]
    },
    {
      urls: [
        'turn:TODO:443?transport=udp',
        'turn:TODO:443?transport=tcp',
        'turns:TODO:443?transport=tcp'
      ],
      username: 'TODO',
      credential: 'TODO'
    }
  ],
  sdpSemantics: 'unified-plan',
  bundlePolicy: 'max-bundle',
  iceCandidatePoolsize: 1
}
