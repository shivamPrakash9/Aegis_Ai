// Provider Administration Routes

const express = require('express');
const { providersController } = require('../controllers/providers.controller');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { registerProviderSchema } = require('../schemas/completion.schema');

const router = express.Router();
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODEL_ADMIN', 'ORGANIZATION_ADMIN'];

// List providers
router.get('/providers', authenticate({ optional: true }), providersController.listProviders);

// Get specific provider details
router.get('/providers/:id', authenticate({ optional: true }), providersController.getProvider);

// Register or update provider configuration (Admin only)
router.post(
  '/providers',
  authenticate(),
  authorize(ADMIN_ROLES),
  validate(registerProviderSchema),
  providersController.registerProvider
);

// Enable provider (Admin only)
router.post(
  '/providers/:id/enable',
  authenticate(),
  authorize(ADMIN_ROLES),
  providersController.enableProvider
);

// Disable provider (Admin only)
router.post(
  '/providers/:id/disable',
  authenticate(),
  authorize(ADMIN_ROLES),
  providersController.disableProvider
);

// Test provider connectivity (Admin only)
router.post(
  '/providers/:id/test',
  authenticate(),
  authorize(ADMIN_ROLES),
  providersController.testProvider
);

module.exports = router;
