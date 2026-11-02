// ETag and HTTP 304 Not Modified Cache Middleware
// Conforms to Web Services Assignment Module 2 Requirement 6

const crypto = require('crypto');

/**
 * Computes a deterministic weak ETag for any string or buffer content.
 */
function computeEtag(body) {
  const hash = crypto
    .createHash('sha256')
    .update(typeof body === 'string' ? body : Buffer.from(body))
    .digest('base64url')
    .substring(0, 27);
  const length = Buffer.byteLength(body);
  return `W/"${length.toString(16)}-${hash}"`;
}

/**
 * Express Middleware that intercepts GET responses, sets ETag, and returns 304 if representation matches If-None-Match.
 */
function etagCacheMiddleware(req, res, next) {
  if (req.method !== 'GET') {
    return next();
  }

  const originalSend = res.send.bind(res);

  res.send = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300 && body !== undefined && body !== null) {
      const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
      const etag = computeEtag(bodyStr);
      res.setHeader('ETag', etag);

      const clientIfNoneMatch = req.headers['if-none-match'];
      if (clientIfNoneMatch) {
        const matches = clientIfNoneMatch
          .split(',')
          .map((item) => item.trim())
          .some((item) => {
            if (item === '*') return true;
            if (item === etag) return true;
            // Support matching weak vs strong representation
            const cleanClient = item.replace(/^W\//, '');
            const cleanServer = etag.replace(/^W\//, '');
            return cleanClient === cleanServer;
          });

        if (matches) {
          // Return 304 Not Modified with empty body
          res.status(304);
          res.removeHeader('Content-Type');
          res.removeHeader('Content-Length');
          return originalSend('');
        }
      }
    }

    return originalSend(body);
  };

  next();
}

module.exports = {
  etagCacheMiddleware,
  computeEtag
};

