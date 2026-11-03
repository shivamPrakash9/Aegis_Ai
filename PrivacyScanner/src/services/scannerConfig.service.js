// Scanner Configuration Service

const { scannerConfigRepository } = require('../repositories/scannerConfig.repository');
const { validateSafeRegex } = require('../utils/regexSafety');
const { detectorRegistry } = require('../detectors/detectorRegistry');
const { BadRequestError } = require('../utils/errors');

class ScannerConfigService {
  constructor({ repo = scannerConfigRepository, registry = detectorRegistry } = {}) {
    this.repo = repo;
    this.registry = registry;
  }

  async getConfig(organizationId) {
    if (!organizationId) {
      throw new BadRequestError('Organization identifier is required.');
    }
    return this.repo.getConfig(organizationId);
  }

  async updateConfig(organizationId, data) {
    if (!organizationId) {
      throw new BadRequestError('Organization identifier is required.');
    }

    if (data.enabledCategories) {
      if (!Array.isArray(data.enabledCategories)) {
        throw new BadRequestError('enabledCategories must be an array of category strings.');
      }
      const supported = new Set(this.registry.getSupportedCategories());
      for (const cat of data.enabledCategories) {
        if (!supported.has(cat.toUpperCase())) {
          throw new BadRequestError(`Unsupported detection category: ${cat}`);
        }
      }
    }

    return this.repo.upsertConfig(organizationId, data);
  }

  async addCustomPattern(organizationId, patternData) {
    if (!organizationId) {
      throw new BadRequestError('Organization identifier is required.');
    }
    if (!patternData || !patternData.name || !patternData.pattern) {
      throw new BadRequestError('Custom pattern requires name and pattern string.');
    }

    // Safety validation against ReDoS and length limits
    validateSafeRegex(patternData.pattern);

    return this.repo.addCustomPattern(organizationId, patternData);
  }

  async getCustomPatterns(organizationId) {
    if (!organizationId) {
      throw new BadRequestError('Organization identifier is required.');
    }
    return this.repo.getCustomPatterns(organizationId);
  }
}

module.exports = {
  ScannerConfigService,
  scannerConfigService: new ScannerConfigService()
};
