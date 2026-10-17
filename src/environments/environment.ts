export interface SyncEnvironment {
  iceServers: RTCIceServer[];
}

export const environment: { sync: SyncEnvironment } = {
  sync: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};
