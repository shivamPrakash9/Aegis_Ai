// AI Request Routes

const { Router } = require('express');
const {
  submitAiRequest,
  getAiRequestById,
  listAiRequests,
  getAiRequestTrace,
  resumeAiRequest
} = require('../controllers/aiRequest.controller');
const { authenticate } = require('../middleware/authenticate');
const { validate } = require('../middleware/validate');
const {
  createAiRequestSchema,
  listAiRequestsQuerySchema,
  requestIdParamSchema
} = require('../schemas/aiRequest.schema');

const router = Router();

// All AI Request endpoints strictly require authenticated principal context
router.use(authenticate);

// Submit AI Request (POST /v1/ai-requests)
router.post(
  '/',
  validate(createAiRequestSchema, 'body'),
  submitAiRequest
);

// List AI Requests with pagination (GET /v1/ai-requests)
router.get(
  '/',
  validate(listAiRequestsQuerySchema, 'query'),
  listAiRequests
);

// Retrieve AI Request by ID (GET /v1/ai-requests/:id)
router.get(
  '/:id',
  validate(requestIdParamSchema, 'params'),
  getAiRequestById
);

// Retrieve AI Request Trace (GET /v1/ai-requests/:id/trace)
router.get(
  '/:id/trace',
  validate(requestIdParamSchema, 'params'),
  getAiRequestTrace
);

// Resume Approved AI Request (POST /v1/ai-requests/:id/resume)
router.post(
  '/:id/resume',
  validate(requestIdParamSchema, 'params'),
  resumeAiRequest
);

module.exports = { aiRequestRoutes: router };
