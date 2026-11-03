// Top-Level Express Router for AI Gateway
// Conforms to Web Services Assignment Requirements

const { Router } = require('express');
const { healthRoutes } = require('./health.routes');
const { aiRequestRoutes } = require('./aiRequest.routes');
const { graphqlRoutes } = require('./graphql.routes');

const router = Router();

// Mount Health endpoints at /health and /v1/health
router.use('/health', healthRoutes);
router.use('/v1/health', healthRoutes);

// Mount Versioned AI Gateway endpoints at /v1/ai-requests
router.use('/v1/ai-requests', aiRequestRoutes);

// Mount GraphQL endpoint at /graphql and /v1/graphql (Requirement 15)
router.use('/graphql', graphqlRoutes);
router.use('/v1/graphql', graphqlRoutes);

module.exports = { rootRouter: router };
