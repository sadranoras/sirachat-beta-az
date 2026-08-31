export const ICE_SERVERS: RTCIceServer[] = [
  // STUN servers from multiple providers for better NAT discovery
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },

  // OpenRelay free TURN servers (metered.ca) — multiple transports for firewall bypass
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelay',
    credential: 'openrelay',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelay',
    credential: 'openrelay',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelay',
    credential: 'openrelay',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=udp',
    username: 'openrelay',
    credential: 'openrelay',
  },

  // OpenRelay static auth variant (different credential set)
  {
    urls: 'turn:staticauth.openrelay.metered.ca:80',
    username: 'openrelay',
    credential: 'openrelayprojectsecret',
  },
  {
    urls: 'turn:staticauth.openrelay.metered.ca:443',
    username: 'openrelay',
    credential: 'openrelayprojectsecret',
  },
  {
    urls: 'turns:staticauth.openrelay.metered.ca:443',
    username: 'openrelay',
    credential: 'openrelayprojectsecret',
  },
]
