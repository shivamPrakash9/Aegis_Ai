// Scanner Configuration and Custom Pattern Repository

const { getPrismaClient } = require('../config/database');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class ScannerConfigRepository {
  constructor() {
    this._inMemoryConfigs = new Map();
    this._inMemoryPatterns = new Map();
    this._forceInMemory = false;
  }

  setForceInMemory(val) {
    this._forceInMemory = val;
  }

  clear() {
    this._inMemoryConfigs.clear();
    this._inMemoryPatterns.clear();
  }

  /**
   * Retrieves scanner configuration for an organization.
   * Returns default configuration if none exists yet.
   *
   * @param {string} organizationId
   * @returns {Promise<object>}
   */
  async getConfig(organizationId) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const config = await prisma.scannerConfiguration.findUnique({
          where: { organizationId }
        });
        if (config) {
          return {
            ...config,
            enabledCategories: JSON.parse(config.enabledCategories || '[]'),
            maskingConfiguration: JSON.parse(config.maskingConfiguration || '{}')
          };
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed, falling back to in-memory config');
      }
    }

    if (this._inMemoryConfigs.has(organizationId)) {
      return this._inMemoryConfigs.get(organizationId);
    }

    // Default configuration
    return {
      id: `cfg_${organizationId}`,
      organizationId,
      enabledCategories: ['EMAIL', 'PHONE', 'PAN', 'AADHAAR', 'SECRET', 'CREDENTIAL_ASSIGNMENT', 'IP_ADDRESS'],
      maskingConfiguration: {},
      ruleSetVersion: '1.0.0',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Upserts configuration for an organization.
   *
   * @param {string} organizationId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async upsertConfig(organizationId, data) {
    const enabledCategoriesJson = JSON.stringify(
      data.enabledCategories || ['EMAIL', 'PHONE', 'PAN', 'AADHAAR', 'SECRET', 'CREDENTIAL_ASSIGNMENT', 'IP_ADDRESS']
    );
    const maskingConfigJson = JSON.stringify(data.maskingConfiguration || {});
    const ruleSetVersion = data.ruleSetVersion || '1.0.0';
    const status = data.status || 'ACTIVE';

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const saved = await prisma.scannerConfiguration.upsert({
          where: { organizationId },
          update: {
            enabledCategories: enabledCategoriesJson,
            maskingConfiguration: maskingConfigJson,
            ruleSetVersion,
            status
          },
          create: {
            organizationId,
            enabledCategories: enabledCategoriesJson,
            maskingConfiguration: maskingConfigJson,
            ruleSetVersion,
            status
          }
        });
        return {
          ...saved,
          enabledCategories: JSON.parse(saved.enabledCategories),
          maskingConfiguration: JSON.parse(saved.maskingConfiguration)
        };
      } catch (err) {
        logger.debug({ err: err.message }, 'Database upsert failed, using in-memory store');
      }
    }

    const memoryConfig = {
      id: `cfg_${organizationId}`,
      organizationId,
      enabledCategories: JSON.parse(enabledCategoriesJson),
      maskingConfiguration: JSON.parse(maskingConfigJson),
      ruleSetVersion,
      status,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this._inMemoryConfigs.set(organizationId, memoryConfig);
    return memoryConfig;
  }

  /**
   * Retrieves enabled custom patterns for an organization.
   *
   * @param {string} organizationId
   * @returns {Promise<Array<object>>}
   */
  async getCustomPatterns(organizationId) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        return await prisma.customSensitivePattern.findMany({
          where: { organizationId, enabled: true }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database query failed, using in-memory patterns');
      }
    }

    const orgPatterns = this._inMemoryPatterns.get(organizationId) || [];
    return orgPatterns.filter((p) => p.enabled);
  }

  /**
   * Adds a custom pattern for an organization.
   *
   * @param {string} organizationId
   * @param {object} patternData
   * @returns {Promise<object>}
   */
  async addCustomPattern(organizationId, patternData) {
    const id = patternData.id || uuidv4();
    const newPattern = {
      id,
      organizationId,
      name: patternData.name,
      category: patternData.category || 'CUSTOM',
      pattern: patternData.pattern,
      severity: patternData.severity || 'HIGH',
      action: patternData.action || 'BLOCK',
      replacement: patternData.replacement || null,
      enabled: patternData.enabled !== undefined ? patternData.enabled : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        return await prisma.customSensitivePattern.create({
          data: newPattern
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database create failed, saving in-memory');
      }
    }

    const existing = this._inMemoryPatterns.get(organizationId) || [];
    existing.push(newPattern);
    this._inMemoryPatterns.set(organizationId, existing);
    return newPattern;
  }
}

module.exports = {
  ScannerConfigRepository,
  scannerConfigRepository: new ScannerConfigRepository()
};
