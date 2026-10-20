// Privacy Scan Routes

const express = require('express');
const { scanController } = require('../controllers/scan.controller');
const { authenticate } = require('../middleware/authenticate');
const { validate } = require('../middleware/validate');
const { scanRequestSchema, scanIdParamSchema } = require('../schemas/scan.schema');

const router = express.Router();

// Primary Privacy Scan: POST /v1/scan
router.post(
  '/scan',
  authenticate({ optional: false }),
  validate(scanRequestSchema, 'body'),
  (req, res, next) => scanController.scan(req, res, next)
);

// Scan Metadata Inspection: GET /v1/scan/:scanId
router.get(
  '/scan/:scanId',
  authenticate({ optional: false }),
  validate(scanIdParamSchema, 'params'),
  (req, res, next) => scanController.getScanMetadata(req, res, next)
);

module.exports = router;
