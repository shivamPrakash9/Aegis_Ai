// Scanner Configuration & Custom Pattern Controller

const { scannerConfigService } = require('../services/scannerConfig.service');
const { detectorRegistry } = require('../detectors/detectorRegistry');
const { ForbiddenError } = require('../utils/errors');

class ConfigController {
  constructor({ service = scannerConfigService, registry = detectorRegistry } = {}) {
    this.service = service;
    this.registry = registry;
  }

  /**
   * GET /v1/config
   */
  async getConfig(req, res, next) {
    try {
      const organizationId = req.principal?.organizationId || req.query.organizationId;
      if (!organizationId) {
        throw new ForbiddenError('Organization context required.');
      }

      const config = await this.service.getConfig(organizationId);
      const customPatterns = await this.service.getCustomPatterns(organizationId);
      const supportedCategories = this.registry.getSupportedCategories();

      res.status(200).json({
        config,
        customPatterns,
        supportedCategories
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /v1/config
   */
  async updateConfig(req, res, next) {
    try {
      const organizationId = req.principal?.organizationId || req.body.organizationId;
      if (!organizationId) {
        throw new ForbiddenError('Organization context required.');
      }

      const updated = await this.service.updateConfig(organizationId, req.body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/config/patterns
   */
  async addCustomPattern(req, res, next) {
    try {
      const organizationId = req.principal?.organizationId || req.body.organizationId;
      if (!organizationId) {
        throw new ForbiddenError('Organization context required.');
      }

      const pattern = await this.service.addCustomPattern(organizationId, req.body);
      res.status(201).json(pattern);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/config/limitations
   */
  async getLimitations(req, res, next) {
    try {
      const limitations = this.registry.getLimitations();
      res.status(200).json({ limitations });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = {
  ConfigController,
  configController: new ConfigController()
};
