// Model Catalog & Operational Usage Controller

const { modelManagementService } = require('../services/modelManagement.service');
const { BadRequestError } = require('../utils/errors');

class ModelsController {
  constructor(service = modelManagementService) {
    this.service = service;
    this.listModels = this.listModels.bind(this);
    this.getModel = this.getModel.bind(this);
    this.registerModel = this.registerModel.bind(this);
    this.enableModel = this.enableModel.bind(this);
    this.disableModel = this.disableModel.bind(this);
    this.getUsage = this.getUsage.bind(this);
  }

  _getOrgId(req) {
    const orgId = req.principal?.organizationId || req.query?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Organization identifier is required.');
    }
    return orgId;
  }

  async listModels(req, res, next) {
    try {
      const enabledOnly = req.query.enabled === 'true';
      const models = await this.service.listModels({ enabledOnly });
      res.status(200).json({
        object: 'list',
        data: models
      });
    } catch (err) {
      next(err);
    }
  }

  async getModel(req, res, next) {
    try {
      const modelId = req.params.id;
      const model = await this.service.getModel(modelId);
      res.status(200).json(model);
    } catch (err) {
      next(err);
    }
  }

  async registerModel(req, res, next) {
    try {
      const registered = await this.service.registerModel(req.body);
      res.status(201).json(registered);
    } catch (err) {
      next(err);
    }
  }

  async enableModel(req, res, next) {
    try {
      const modelId = req.params.id;
      const updated = await this.service.setModelStatus(modelId, true);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  async disableModel(req, res, next) {
    try {
      const modelId = req.params.id;
      const updated = await this.service.setModelStatus(modelId, false);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  async getUsage(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const { limit, offset, model, provider } = req.query;

      // Organization-level RBAC:
      // Developers can only see their own usage records
      // Admins and Auditors can see their organization's usage
      let callerId = undefined;
      if (req.principal?.role === 'DEVELOPER') {
        callerId = req.principal.id;
      }

      const usage = await this.service.getUsageStats(organizationId, {
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        model,
        provider,
        callerId
      });
      res.status(200).json(usage);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = {
  ModelsController,
  modelsController: new ModelsController()
};
