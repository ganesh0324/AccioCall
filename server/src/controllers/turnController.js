// Hands the client TURN credentials for WebRTC calls across different
// networks. Metered's TURN username/password is designed to be given to the
// browser (it's what RTCPeerConnection needs to authenticate to the relay) —
// unlike the account API key, it isn't a secret that must stay server-side.
// Keeping it behind this endpoint just avoids hardcoding it into client
// source so it can be rotated without a client rebuild.
const buildIceServers = (username, credential) => [
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: "turn:global.relay.metered.ca:80", username, credential },
  { urls: "turn:global.relay.metered.ca:80?transport=tcp", username, credential },
  { urls: "turn:global.relay.metered.ca:443", username, credential },
  { urls: "turns:global.relay.metered.ca:443?transport=tcp", username, credential },
];

const DEFAULT_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const getTurnCredentials = (req, res) => {
  const username = process.env.METERED_TURN_USERNAME?.trim();
  const credential = process.env.METERED_TURN_CREDENTIAL?.trim();

  if (!username || !credential) {
    // TURN isn't configured — client falls back to STUN-only.
    return res.json({ iceServers: DEFAULT_ICE_SERVERS });
  }

  res.json({ iceServers: buildIceServers(username, credential) });
};

module.exports = { getTurnCredentials };
