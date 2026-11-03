// AJV Request Validation Middleware

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { BadRequestError } = require('../utils/errors');

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  useDefaults: true,
  removeAdditional: false
});

addFormats(ajv);

/**
 * Creates an Express validation middleware for a specific request target.
 * @param {object} schema
 * @param {'body' | 'query' | 'params'} [target='body']
 */
function validate(schema, target = 'body') {
  const validator = ajv.compile(schema);

  return (req, res, next) => {
    const data = req[target] || {};
    const valid = validator(data);

    if (!valid) {
      const details = (validator.errors || []).map((err) => ({
        field: err.instancePath.replace(/^\//, '') || err.params.missingProperty || 'root',
        message: err.message
      }));

      const primaryMessage = details.length > 0
        ? `Validation error on ${details[0].field}: ${details[0].message}`
        : 'Invalid request payload';

      return next(new BadRequestError(primaryMessage, details));
    }

    req[target] = data;
    next();
  };
}

module.exports = { validate };
