// GraphQL HTTP Route Handler
// Conforms to Web Services Assignment Module 1, 3, 4 Requirement 15

const { Router } = require('express');
const { graphql } = require('graphql');
const { schema } = require('../graphql/schema');
const { rootResolvers } = require('../graphql/resolvers');
const { authenticate } = require('../middleware/authenticate');
const { logger } = require('../utils/logger');

const router = Router();

// Protect GraphQL endpoint with JWT authentication
router.post('/', authenticate, async (req, res, next) => {
  const { query, variables, operationName } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Must provide query string.',
        correlationId: req.correlationId || 'unknown',
        requestId: req.correlationId || 'unknown'
      }
    });
  }

  // Basic query depth/complexity protection
  const queryDepth = (query.match(/\{/g) || []).length;
  if (queryDepth > 10) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'QUERY_TOO_COMPLEX',
        message: 'GraphQL query exceeds maximum allowed depth limit (10).',
        correlationId: req.correlationId || 'unknown',
        requestId: req.correlationId || 'unknown'
      }
    });
  }

  try {
    const contextValue = {
      principal: req.principal,
      organizationId: req.organizationId,
      correlationId: req.correlationId
    };

    const result = await graphql({
      schema,
      source: query,
      rootValue: rootResolvers,
      contextValue,
      variableValues: variables,
      operationName
    });

    if (result.errors && result.errors.length > 0) {
      logger.warn(
        { correlationId: req.correlationId, errors: result.errors.map((e) => e.message) },
        'GraphQL execution completed with errors'
      );
    }

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = {
  graphqlRoutes: router
};

