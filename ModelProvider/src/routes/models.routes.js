// Model Catalog and Usage Administration Routes

const express = require('express');
const { modelsController } = require('../controllers/models.controller');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { registerModelSchema, usageQuerySchema } = require('../schemas/completion.schema');

const router = express.Router();
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODEL_ADMIN', 'ORGANIZATION_ADMIN'];

// List models
router.get('/models', authenticate({ optional: true }), modelsController.listModels);

// Get specific model details
router.get('/models/:id', authenticate({ optional: true }), modelsController.getModel);

// Register or update model configuration
router.post(
  '/models',
  authenticate(),
  authorize(ADMIN_ROLES),
  validate(registerModelSchema),
  modelsController.registerModel
);

// Enable model
router.post(
  '/models/:id/enable',
  authenticate(),
  authorize(ADMIN_ROLES),
  modelsController.enableModel
);

// Disable model
router.post(
  '/models/:id/disable',
  authenticate(),
  authorize(ADMIN_ROLES),
  modelsController.disableModel
);

// Query usage statistics
router.get(
  '/usage',
  authenticate(),
  validate(usageQuerySchema, 'query'),
  modelsController.getUsage
);

module.exports = router;
