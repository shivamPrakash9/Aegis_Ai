// Health Routes

const { Router } = require('express');
const { getLiveness, getReadiness } = require('../controllers/health.controller');

const router = Router();

router.get('/live', getLiveness);
router.get('/ready', getReadiness);

module.exports = { healthRoutes: router };
