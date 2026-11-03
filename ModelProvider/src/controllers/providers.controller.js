// Provider Administration Controller

const { modelManagementService } = require('../services/modelManagement.service');

class ProvidersController {
  constructor(service = modelManagementService) {
    this.service = service;
    this.listProviders = this.listProviders.bind(this);
    this.getProvider = this.getProvider.bind(this);
    this.registerProvider = this.registerProvider.bind(this);
    this.enableProvider = this.enableProvider.bind(this);
    this.disableProvider = this.disableProvider.bind(this);
    this.testProvider = this.testProvider.bind(this);
  }

  async listProviders(req, res, next) {
    try {
      const enabledOnly = req.query.enabled === 'true';
      const providers = await this.service.listProviders({ enabledOnly });
      res.status(200).json({
        object: 'list',
        data: providers
      });
    } catch (err) {
      next(err);
    }
  }

  async getProvider(req, res, next) {
    try {
      const providerId = req.params.id;
      const provider = await this.service.getProvider(providerId);
      res.status(200).json(provider);
    } catch (err) {
      next(err);
    }
  }

  async registerProvider(req, res, next) {
    try {
      const registered = await this.service.registerProvider(req.body);
      res.status(201).json(registered);
    } catch (err) {
      next(err);
    }
  }

  async enableProvider(req, res, next) {
    try {
      const providerId = req.params.id;
      const updated = await this.service.setProviderStatus(providerId, true);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  async disableProvider(req, res, next) {
    try {
      const providerId = req.params.id;
      const updated = await this.service.setProviderStatus(providerId, false);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  async testProvider(req, res, next) {
    try {
      const providerId = req.params.id;
      const result = await this.service.testProviderConnection(providerId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = {
  ProvidersController,
  providersController: new ProvidersController()
};
