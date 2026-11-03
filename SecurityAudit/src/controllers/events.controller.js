// Audit Events Ingestion Controller

const { eventIngestionService } = require('../services/eventIngestion.service');

class EventsController {
  constructor(service = eventIngestionService) {
    this.service = service;
  }

  /**
   * POST /v1/events
   * Accepts and persists an audit event.
   */
  async ingestEvent(req, res, next) {
    try {
      const result = await this.service.ingestEvent(req.body, {
        principal: req.principal,
        isInternalService: req.isInternalService
      });

      const statusCode = result.status === 'DUPLICATE' ? 200 : 201;
      return res.status(statusCode).json(result);
    } catch (err) {
      next(err);
    }
  }
}

const eventsController = new EventsController();

module.exports = {
  EventsController,
  eventsController
};
