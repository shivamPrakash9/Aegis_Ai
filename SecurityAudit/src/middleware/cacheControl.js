// Deliberate Cache-Control Middleware
// Conforms to Web Services Assignment Module 2 Requirement 10

/**
 * Middleware factory for deliberate Cache-Control policies.
 *
 * @param {'private-no-store' | 'public-cacheable' | 'revalidate'} [policy='private-no-store']
 * @param {number} [maxAgeSeconds=60]
 */
function cacheControl(policy = 'private-no-store', maxAgeSeconds = 60) {
  return (req, res, next) => {
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

module.exports = {
  cacheControl
};

