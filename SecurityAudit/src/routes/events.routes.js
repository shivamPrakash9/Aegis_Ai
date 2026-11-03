// Audit Events Ingestion Route Definitions

const express = require('express');
const { eventsController } = require('../controllers/events.controller');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

// Primary event ingestion endpoint
router.post(
  '/',
  authenticate({ optional: false }),
  (req, res, next) => eventsController.ingestEvent(req, res, next)
);

module.exports = router;
