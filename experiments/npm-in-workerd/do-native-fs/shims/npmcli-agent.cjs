// workerd's node:https.request rejects npm's @npmcli/agent instances with
// ERR_INVALID_PROTOCOL: workerd's http.Agent declares `protocol` as a TS class
// field, so an OWN data property 'http:' shadows agent-base's prototype
// protocol getter/setter (in Node the constructor assignment is a [[Set]] the
// subclass setter swallows). Returning no agent makes npm use workerd's
// default request path, which reaches the registry fine. Full analysis in
// base-image/build.mjs (REDIRECTS comment).
module.exports = {
  getAgent: () => undefined,
  Agent: class {},
  HttpAgent: class {},
  HttpsAgent: class {},
  cache: new Map(),
};
