// workerd's node:https.request rejects npm's keepalive/proxy agent (it forces
// an http ClientRequest -> protocol mismatch). Returning no agent makes npm use
// workerd's default request path, which reaches the registry fine.
module.exports = {
  getAgent: () => undefined,
  Agent: class {},
  HttpAgent: class {},
  HttpsAgent: class {},
  cache: new Map(),
};
