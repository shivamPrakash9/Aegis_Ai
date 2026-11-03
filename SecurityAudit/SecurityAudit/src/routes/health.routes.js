// Health Check Routes

const express = require('express');
const { healthController } = require('../controllers/health.controller');

const router = express.Router();

router.get('/live', (req, res) => healthController.live(req, res));
router.get('/ready', (req, res) => healthController.ready(req, res));

module.exports = router;
