// Root Express Router

const express = require('express');
const healthRoutes = require('./health.routes');
const scanRoutes = require('./scan.routes');
const configRoutes = require('./config.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/v1', scanRoutes);
router.use('/v1', configRoutes);

module.exports = router;
