const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrdeadlineshield = onRequest({}, (req, res) => server.then(it => it.handle(req, res)));
  