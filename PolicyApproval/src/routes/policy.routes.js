// Policy Administration Routes

const express = require('express');
const { policyController } = require('../controllers/policy.controller');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { createPolicySchema } = require('../schemas/policy.schema');

const router = express.Router();

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'POLICY_ADMIN', 'ORGANIZATION_ADMIN'];

// Create a new policy
router.post(
  '/policies',
  authenticate(),
  authorize(ADMIN_ROLES),
  validate(createPolicySchema),
  policyController.createPolicy
);

// List policies for current tenant
router.get(
  '/policies',
  authenticate(),
  policyController.listPolicies
);

// Get specific policy by ID
router.get(
  '/policies/:id',
  authenticate(),
  policyController.getPolicy
);

// Publish a new version of an existing policy
router.post(
  '/policies/:id/versions',
  authenticate(),
  authorize(ADMIN_ROLES),
  policyController.createVersion
);

// Activate a policy
router.post(
  '/policies/:id/activate',
  authenticate(),
  authorize(ADMIN_ROLES),
  policyController.activatePolicy
);

// Deactivate a policy
router.post(
  '/policies/:id/deactivate',
  authenticate(),
  authorize(ADMIN_ROLES),
  policyController.deactivatePolicy
);

// Set active version for a policy
router.post(
  '/policies/:id/versions/:versionNumber/activate',
  authenticate(),
  authorize(ADMIN_ROLES),
  policyController.setActiveVersion
);

module.exports = router;
