// Master Router for Security & Audit Microservice

const express = require('express');
const healthRoutes = require('./health.routes');
const eventsRoutes = require('./events.routes');
const auditQueryRoutes = require('./auditQuery.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/v1/events', eventsRoutes);
router.use('/v1', auditQueryRoutes);

module.exports = router;
