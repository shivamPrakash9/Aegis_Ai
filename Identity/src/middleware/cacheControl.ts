// Deliberate Cache-Control Middleware for Identity Service
// Conforms to Web Services Assignment Module 2 Requirement 10

import { Request, Response, NextFunction, RequestHandler } from 'express';

export type CacheControlPolicy = 'private-no-store' | 'public-cacheable' | 'revalidate';

export function cacheControl(policy: CacheControlPolicy = 'private-no-store', maxAgeSeconds = 60): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
      return next();
    }

    switch (policy) {
      case 'public-cacheable':
        res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}, must-revalidate`);
        break;
      case 'revalidate':
        res.setHeader('Cache-Control', `private, max-age=${maxAgeSeconds}, must-revalidate`);
        break;
      case 'private-no-store':
      default:
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        break;
    }

    next();
  };
}

