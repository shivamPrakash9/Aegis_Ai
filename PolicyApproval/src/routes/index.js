// Root Express Router for Policy & Approval Microservice

const express = require('express');
const healthRoutes = require('./health.routes');
const evaluationRoutes = require('./evaluation.routes');
const policyRoutes = require('./policy.routes');
const approvalRoutes = require('./approval.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/v1', evaluationRoutes);
router.use('/v1', policyRoutes);
router.use('/v1', approvalRoutes);

module.exports = router;
