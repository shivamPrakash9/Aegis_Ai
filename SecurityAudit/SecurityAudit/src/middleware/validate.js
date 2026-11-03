// Generic Request Validation Middleware using Ajv

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { BadRequestError } = require('../utils/errors');

const ajv = new Ajv({ allErrors: true, coerceTypes: true });
addFormats(ajv);

/**
 * Validates request body, query, or params against an Ajv schema.
 *
 * @param {object} schema
 * @param {'body' | 'query' | 'params'} [target='body']
 */
function validate(schema, target = 'body') {
  const compiled = ajv.compile(schema);

  return (req, res, next) => {
    const data = req[target];
    const valid = compiled(data);

    if (!valid) {
      const messages = compiled.errors.map(
        (err) => `${err.instancePath ? err.instancePath + ' ' : ''}${err.message}`
      );
      return next(new BadRequestError(`Validation error: ${messages.join(', ')}`));
    }

    next();
  };
}

module.exports = { validate };
