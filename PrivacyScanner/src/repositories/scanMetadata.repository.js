// Scan Metadata Repository (Non-sensitive Execution Telemetry)

const { getPrismaClient } = require('../config/database');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class ScanMetadataRepository {
  constructor() {
    this._inMemoryMetadata = new Map();
    this._forceInMemory = false;
  }

  setForceInMemory(val) {
    this._forceInMemory = val;
  }

  clear() {
    this._inMemoryMetadata.clear();
  }

  /**
   * Persists non-sensitive scan execution metadata.
   * Zero raw prompts or sensitive findings are stored.
   *
   * @param {object} params
   * @param {string} params.scanId
   * @param {string} params.organizationId
   * @param {string} [params.requestId]
   * @param {string} params.ruleSetVersion
   * @param {Array<string>} params.detectedCategories
   * @param {number} params.findingsCount
   * @param {string} params.decision
   * @param {number} params.processingDurationMs
   * @returns {Promise<object>}
   */
  async saveMetadata({
    scanId,
    organizationId,
    requestId,
    ruleSetVersion = '1.0.0',
    detectedCategories = [],
    findingsCount = 0,
    decision,
    processingDurationMs = 0
  }) {
    const record = {
      id: scanId || uuidv4(),
      organizationId,
      requestId: requestId || null,
      ruleSetVersion,
      detectedCategories: JSON.stringify(detectedCategories),
      findingsCount,
      decision,
      processingDurationMs,
      createdAt: new Date()
    };

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const saved = await prisma.scanMetadata.create({
          data: record
        });
        return {
          ...saved,
          detectedCategories: JSON.parse(saved.detectedCategories)
        };
      } catch (err) {
        logger.debug({ err: err.message }, 'Database write failed for scan metadata, using in-memory');
      }
    }

    const memoryRecord = {
      ...record,
      detectedCategories: detectedCategories
    };
    this._inMemoryMetadata.set(record.id, memoryRecord);
    return memoryRecord;
  }

  /**
   * Retrieves scan metadata by scanId, scoped strictly to the organization.
   *
   * @param {string} scanId
   * @param {string} organizationId
   * @returns {Promise<object | null>}
   */
  async findById(scanId, organizationId) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const record = await prisma.scanMetadata.findFirst({
          where: { id: scanId, organizationId }
        });
        if (record) {
          return {
            ...record,
            detectedCategories: JSON.parse(record.detectedCategories)
          };
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for scan metadata');
      }
    }

    const memoryRecord = this._inMemoryMetadata.get(scanId);
    if (memoryRecord && memoryRecord.organizationId === organizationId) {
      return memoryRecord;
    }
    return null;
  }
}

module.exports = {
  ScanMetadataRepository,
  scanMetadataRepository: new ScanMetadataRepository()
};
