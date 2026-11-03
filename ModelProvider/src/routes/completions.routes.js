// Chat Completions Routes

const express = require('express');
const { completionsController } = require('../controllers/completions.controller');
const { authenticate } = require('../middleware/authenticate');
const { validate } = require('../middleware/validate');
const { createCompletionSchema } = require('../schemas/completion.schema');

const router = express.Router();

router.post(
  '/chat/completions',
  authenticate({ optional: true }),
  validate(createCompletionSchema),
  completionsController.createCompletion
);

module.exports = router;
