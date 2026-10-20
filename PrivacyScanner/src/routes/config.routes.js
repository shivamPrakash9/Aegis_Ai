// Scanner Configuration Routes

const express = require('express');
const { configController } = require('../controllers/config.controller');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { updateConfigSchema, addCustomPatternSchema } = require('../schemas/scan.schema');

const router = express.Router();

// GET /v1/config/limitations (Public/transparency endpoint for scanner engine capabilities)
router.get('/config/limitations', (req, res, next) => configController.getLimitations(req, res, next));

// GET /v1/config (Retrieve organization privacy configuration)
router.get(
  '/config',
  authenticate({ optional: false }),
  (req, res, next) => configController.getConfig(req, res, next)
);

// PUT /v1/config (Update organization privacy configuration)
router.put(
  '/config',
  authenticate({ optional: false }),
  authorize(['ORGANIZATION_ADMIN', 'SECURITY_AUDITOR']),
  validate(updateConfigSchema, 'body'),
  (req, res, next) => configController.updateConfig(req, res, next)
);

// POST /v1/config/patterns (Register safe custom pattern/keyword rule)
router.post(
  '/config/patterns',
  authenticate({ optional: false }),
  authorize(['ORGANIZATION_ADMIN', 'SECURITY_AUDITOR']),
  validate(addCustomPatternSchema, 'body'),
  (req, res, next) => configController.addCustomPattern(req, res, next)
);

module.exports = router;
