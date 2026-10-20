// Policy Evaluation Routes

const express = require('express');
const { evaluationController } = require('../controllers/evaluation.controller');
const { authenticate } = require('../middleware/authenticate');
const { validate } = require('../middleware/validate');
const { evaluateSchema } = require('../schemas/policy.schema');

const router = express.Router();

router.post(
  '/evaluate',
  authenticate({ optional: true }),
  validate(evaluateSchema),
  evaluationController.evaluate
);

module.exports = router;
