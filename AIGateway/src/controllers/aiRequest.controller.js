// AI Request Controller

const { aiRequestService } = require('../services/aiRequest.service');
const { BadRequestError } = require('../utils/errors');

async function submitAiRequest(req, res, next) {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
      throw new BadRequestError('Idempotency-Key header is required for AI request submission.');
    }

    const result = await aiRequestService.submitRequest({
      principal: req.principal,
      organizationId: req.organizationId,
      idempotencyKey: String(idempotencyKey),
      payload: req.body,
      correlationId: req.correlationId
    });

    res.status(result.statusCode || 202).json(result.body);
  } catch (err) {
    next(err);
  }
}

async function getAiRequestById(req, res, next) {
  try {
    const request = await aiRequestService.getRequestById(req.params.id, req.organizationId);
    res.status(200).json(request);
  } catch (err) {
    next(err);
  }
}

async function listAiRequests(req, res, next) {
  try {
    const { status, startDate, endDate, page, limit } = req.query;

    const filter = {
      ...(status ? { status } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {})
    };

    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20
    };

    const result = await aiRequestService.listRequests(req.organizationId, filter, pagination);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getAiRequestTrace(req, res, next) {
  try {
    const trace = await aiRequestService.getRequestTrace(
      req.params.id,
      req.organizationId,
      req.correlationId
    );
    res.status(200).json(trace);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitAiRequest,
  getAiRequestById,
  listAiRequests,
  getAiRequestTrace
};
