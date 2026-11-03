// AI Request Controller
// Conforms to Web Services Assignment Requirements

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
    const isOrgAdmin = ['ORGANIZATION_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(req.principal?.role);
    const callerId = isOrgAdmin ? null : req.principal?.id;

    const request = await aiRequestService.getRequestById(req.params.id, req.organizationId, callerId);
    res.status(200).json(request);
  } catch (err) {
    next(err);
  }
}

async function listAiRequests(req, res, next) {
  try {
    const { status, startDate, endDate, page, limit, cursor, search, q, model, provider } = req.query;
    const isOrgAdmin = ['ORGANIZATION_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(req.principal?.role);

    const filter = {
      ...(status ? { status } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(search ? { search } : {}),
      ...(q ? { q } : {}),
      ...(model ? { model } : {}),
      ...(provider ? { provider } : {}),
      ...(!isOrgAdmin ? { callerId: req.principal?.id } : {})
    };

    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      ...(cursor ? { cursor } : {})
    };

    const result = await aiRequestService.listRequests(req.organizationId, filter, pagination);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getAiRequestTrace(req, res, next) {
  try {
    const isOrgAdmin = ['ORGANIZATION_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(req.principal?.role);
    const callerId = isOrgAdmin ? null : req.principal?.id;

    const trace = await aiRequestService.getRequestTrace(
      req.params.id,
      req.organizationId,
      req.correlationId,
      callerId
    );
    res.status(200).json(trace);
  } catch (err) {
    next(err);
  }
}

async function resumeAiRequest(req, res, next) {
  try {
    const result = await aiRequestService.resumeRequest({
      id: req.params.id,
      principal: req.principal,
      organizationId: req.organizationId,
      correlationId: req.correlationId
    });
    res.status(result.statusCode || 200).json(result.body);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitAiRequest,
  getAiRequestById,
  listAiRequests,
  getAiRequestTrace,
  resumeAiRequest
};
