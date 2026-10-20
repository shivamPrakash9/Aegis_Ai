// Policy Evaluation Controller for POST /v1/evaluate

const { policyEvaluationService } = require('../services/policyEvaluation.service');

class EvaluationController {
  constructor(service = policyEvaluationService) {
    this.evaluationService = service;
    this.evaluate = this.evaluate.bind(this);
  }

  /**
   * Evaluates AI request governance policies.
   */
  async evaluate(req, res, next) {
    try {
      const result = await this.evaluationService.evaluate(req.body, {
        correlationId: req.correlationId
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = {
  EvaluationController,
  evaluationController: new EvaluationController()
};
