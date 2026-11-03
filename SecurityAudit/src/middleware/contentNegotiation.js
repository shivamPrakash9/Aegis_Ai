// Content Negotiation Middleware: JSON and XML Support
// Conforms to Web Services Assignment Module 2 Requirement 7

const { create } = require('xmlbuilder2');

/**
 * Safely converts arbitrary JavaScript objects/arrays into XML-compatible structures.
 */
function toXmlSafe(value) {
  if (Array.isArray(value)) {
    return { item: value.map(toXmlSafe) };
  }
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      // Ensure XML element names don't contain invalid characters
      const safeKey = key.replace(/[^a-zA-Z0-9_\-]/g, '_');
      result[safeKey] = toXmlSafe(val);
    }
    return result;
  }
  return value;
}

/**
 * Serializes data into well-formed XML string under <response> root element.
 */
function toXml(data) {
  return create({ response: toXmlSafe(data) }).end({ prettyPrint: true });
}

/**
 * Evaluates whether the client requested XML format specifically.
 */
function wantsXmlOnly(acceptHeader) {
  if (!acceptHeader) return false;
  const accept = acceptHeader.toLowerCase();
  if (accept.includes('application/json') || accept.includes('*/*')) return false;
  return accept.includes('application/xml') || accept.includes('text/xml');
}

/**
 * Checks if the Accept header requests an explicitly unsupported media type.
 */
function isUnsupportedFormat(acceptHeader) {
  if (!acceptHeader || acceptHeader.trim() === '' || acceptHeader === '*/*') return false;
  const accept = acceptHeader.toLowerCase();
  const supported = [
    'application/json',
    'application/xml',
    'text/xml',
    '*/*',
    'text/html', // For swagger UI / browser navigations
    'text/yaml'  // For openapi yaml
  ];
  const tokens = accept.split(',').map((t) => t.trim().split(';')[0]);
  return !tokens.some((token) => supported.some((s) => token.includes(s) || s.includes(token)));
}

/**
 * Express Middleware for XML/JSON Content Negotiation.
 */
function contentNegotiationMiddleware(req, res, next) {
  const acceptHeader = req.headers.accept;

  // Check for unsupported media type in Accept header
  if (isUnsupportedFormat(acceptHeader)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(406).json({
      success: false,
      error: {
        code: 'NOT_ACCEPTABLE',
        message: `Unsupported Accept format: '${acceptHeader}'. Supported representations: application/json, application/xml.`,
        correlationId: req.correlationId || 'unknown',
        requestId: req.correlationId || 'unknown'
      }
    });
  }

  const originalJson = res.json.bind(res);

  res.json = function (body) {
    if (wantsXmlOnly(req.headers.accept)) {
      try {
        const xml = toXml(body);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        return res.send(xml);
      } catch (err) {
        // Fallback to JSON if XML serialization fails
        return originalJson(body);
      }
    }
    return originalJson(body);
  };

  next();
}

module.exports = {
  contentNegotiationMiddleware,
  toXml,
  wantsXmlOnly
};

