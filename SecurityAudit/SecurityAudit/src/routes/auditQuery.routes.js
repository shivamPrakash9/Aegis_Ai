// Audit Query and Investigation Route Definitions

const express = require('express');
const { auditQueryController } = require('../controllers/auditQuery.controller');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// GET /v1/traces/:traceId (consumed by AI Gateway's securityAuditClient)
router.get(
  '/traces/:traceId',
  authenticate({ optional: false }),
  (req, res, next) => auditQueryController.getTrace(req, res, next)
);

// GET /v1/requests/:requestId/events
router.get(
  '/requests/:requestId/events',
  authenticate({ optional: false }),
  (req, res, next) => auditQueryController.getRequestEvents(req, res, next)
);

// GET /v1/events/:eventId/verify (cryptographic verification)
router.get(
  '/events/:eventId/verify',
  authenticate({ optional: false }),
  authorize(['ADMIN', 'SECURITY_AUDITOR', 'ORGANIZATION_ADMIN', 'INTERNAL_SERVICE']),
  (req, res, next) => auditQueryController.verifyEvent(req, res, next)
);

// GET /v1/events/:eventId
router.get(
  '/events/:eventId',
  authenticate({ optional: false }),
  (req, res, next) => auditQueryController.getEventById(req, res, next)
);

// GET /v1/events (search with filters and pagination)
router.get(
  '/events',
  authenticate({ optional: false }),
  (req, res, next) => auditQueryController.searchEvents(req, res, next)
);

module.exports = router;
