// ETag and HTTP 304 Not Modified Cache Middleware for Identity Service
// Conforms to Web Services Assignment Module 2 Requirement 6

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function computeEtag(body: string | Buffer): string {
  const hash = crypto
    .createHash('sha256')
    .update(typeof body === 'string' ? body : Buffer.from(body))
    .digest('base64url')
    .substring(0, 27);
  const length = Buffer.byteLength(body);
  return `W/"${length.toString(16)}-${hash}"`;
}

export function etagCacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET') {
    return next();
  }

  const originalSend = res.send.bind(res);

  res.send = function (body: any): Response {
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
            const cleanClient = item.replace(/^W\//, '');
            const cleanServer = etag.replace(/^W\//, '');
            return cleanClient === cleanServer;
          });

        if (matches) {
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

