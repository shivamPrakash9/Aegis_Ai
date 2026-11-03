const express = require('express');
const healthRoutes = require('./health.routes');
const completionsRoutes = require('./completions.routes');
const modelsRoutes = require('./models.routes');
const providersRoutes = require('./providers.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/v1', completionsRoutes);
router.use('/v1', modelsRoutes);
router.use('/v1', providersRoutes);

module.exports = router;

