// Human Approval Workflow Routes

const express = require('express');
const { approvalController } = require('../controllers/approval.controller');
const { authenticate } = require('../middleware/authenticate');
const { validate } = require('../middleware/validate');
const { approvalDecisionSchema, approvalQuerySchema } = require('../schemas/policy.schema');

const router = express.Router();

// List approvals with optional filtering & pagination
router.get(
  '/approvals',
  authenticate(),
  validate(approvalQuerySchema, 'query'),
  approvalController.listApprovals
);

// Get approval details by ID
router.get(
  '/approvals/:id',
  authenticate(),
  approvalController.getApproval
);

// Submit approval/rejection decision
router.post(
  '/approvals/:id/decision',
  authenticate(),
  validate(approvalDecisionSchema),
  approvalController.submitDecision
);

module.exports = router;
