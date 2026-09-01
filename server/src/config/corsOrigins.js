// CLIENT_URL may hold a single origin or a comma-separated list (e.g. prod +
// a preview domain). Falls back to allowing any origin when unset, for local
// dev. Shared by the Express CORS middleware and the Socket.IO server so
// both stay in sync.
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((origin) => origin.trim())
  : true;

module.exports = allowedOrigins;
