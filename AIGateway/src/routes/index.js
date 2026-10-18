// Top-Level Express Router

const { Router } = require('express');
const { healthRoutes } = require('./health.routes');
const { aiRequestRoutes } = require('./aiRequest.routes');

const router = Router();

// Mount Health endpoints at /health
router.use('/health', healthRoutes);

// Mount Versioned AI Gateway endpoints at /v1/ai-requests
router.use('/v1/ai-requests', aiRequestRoutes);

module.exports = { rootRouter: router };
