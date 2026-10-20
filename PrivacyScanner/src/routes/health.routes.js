// Health Routes

const express = require('express');
const { healthController } = require('../controllers/health.controller');

const router = express.Router();

router.get('/live', (req, res) => healthController.getLive(req, res));
router.get('/ready', (req, res) => healthController.getReady(req, res));

module.exports = router;
