// Authentication Middleware via Identity Service Session Verification

const { identityClient } = require('../clients/identityClient');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Express middleware that extracts credentials and verifies them against the Identity Service.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Missing Authorization header. Expected Bearer <token> or service account key.');
    }

    let token = authHeader.trim();
    if (token.startsWith('Bearer ') || token.startsWith('bearer ')) {
      token = token.slice(7).trim();
    }

    if (!token) {
      throw new UnauthorizedError('Empty authorization credential provided.');
    }

    // Verify session via Identity Service contract (POST /v1/sessions/verify)
    const verification = await identityClient.verifySession(token, req.correlationId);

    if (!verification || !verification.valid || !verification.principal) {
      throw new UnauthorizedError('Session verification returned invalid principal.');
    }

    // Bind verified principal and verified organizationId to request
    req.principal = verification.principal;
    req.organizationId = verification.principal.organizationId;

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
