// Chat Completions Controller for POST /v1/chat/completions

const { completionService } = require('../services/completion.service');

class CompletionsController {
  constructor(service = completionService) {
    this.service = service;
    this.createCompletion = this.createCompletion.bind(this);
  }

  /**
   * Invokes AI model completion.
   */
  async createCompletion(req, res, next) {
    try {
      const payload = {
        ...req.body,
        organizationId: req.body.organizationId || req.principal?.organizationId
      };

      const result = await this.service.createChatCompletion(payload, {
        correlationId: req.correlationId,
        traceId: req.traceId
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = {
  CompletionsController,
  completionsController: new CompletionsController()
};
