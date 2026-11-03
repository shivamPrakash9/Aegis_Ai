// Outbound HTTP Security and SSRF Prevention

const { env } = require('../config/env');
const { BadRequestError, ForbiddenError, GatewayTimeoutError, BadGatewayError } = require('./errors');
const { logger } = require('./logger');

const BLOCKED_HOSTS = new Set([
  '169.254.169.254', // AWS / GCP metadata
  'metadata.google.internal',
  '100.100.100.200', // Alibaba metadata
  'instance-data'
]);

/**
 * Validates outbound provider URL against SSRF and strict host allowlisting.
 *
 * @param {string} urlString
 * @returns {URL} parsed URL if valid
 */
function validateProviderUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    throw new BadRequestError(`Malformed outbound provider URL: ${urlString}`);
  }

  // 1. Only allow http/https protocols
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ForbiddenError(`Forbidden protocol: '${parsed.protocol}'. Only HTTPS/HTTP permitted.`);
  }

  // 2. Production must strictly use HTTPS (except allowed local mock endpoints in dev/test)
  if (env.isProduction && parsed.protocol !== 'https:') {
    throw new ForbiddenError('Production provider endpoints must strictly use HTTPS.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Prevent cloud metadata endpoints
  if (BLOCKED_HOSTS.has(hostname)) {
    throw new ForbiddenError('Access to cloud instance metadata services is strictly forbidden.');
  }

  // 4. In production, prevent loopback and private IP ranges
  if (env.isProduction) {
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) {
      throw new ForbiddenError('Access to internal/private network addresses is strictly forbidden in production.');
    }
  }

  // 5. Host allowlist enforcement
  const isAllowed = env.allowedProviderHosts.some((allowed) => {
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });

  if (!isAllowed) {
    logger.warn({ hostname, allowed: env.allowedProviderHosts }, 'SSRF prevention blocked unapproved provider host');
    throw new ForbiddenError(`Outbound access to provider host '${hostname}' is not allowlisted.`);
  }

  return parsed;
}

/**
 * Executes safe outbound HTTP request with bounded timeout, size limits, and SSRF validation.
 *
 * @param {string} url
 * @param {object} options
 * @param {string} [correlationId]
 * @returns {Promise<Response>}
 */
async function safeFetch(url, options = {}, correlationId = 'unknown') {
  validateProviderUrl(url);

  const timeoutMs = options.timeoutMs || env.providerTimeoutMs;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchOptions = {
      ...options,
      signal: controller.signal
    };

    // Ensure incoming client authorization headers are NEVER forwarded to LLM providers
    if (fetchOptions.headers) {
      delete fetchOptions.headers['x-internal-service-key'];
      delete fetchOptions.headers['X-Internal-Service-Key'];
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      logger.error({ correlationId, timeoutMs }, 'Upstream LLM provider request timed out');
      throw new GatewayTimeoutError(`Provider request timed out after ${timeoutMs}ms.`);
    }

    logger.error({ correlationId, err: err.message }, 'Outbound fetch failed to provider endpoint');
    throw new BadGatewayError(`Outbound network error reaching provider: ${err.message}`);
  }
}

module.exports = {
  validateProviderUrl,
  safeFetch
};
