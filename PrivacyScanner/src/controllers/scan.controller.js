// Privacy Scan Controller

const { scanService } = require('../services/scan.service');
const { scanMetadataRepository } = require('../repositories/scanMetadata.repository');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

class ScanController {
  constructor({ service = scanService, metadataRepo = scanMetadataRepository } = {}) {
    this.service = service;
    this.metadataRepo = metadataRepo;
  }

  /**
   * Primary privacy scan handler: POST /v1/scan
   */
  async scan(req, res, next) {
    try {
      const correlationId = req.correlationId;
      const result = await this.service.scan(req.body, { correlationId });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves non-sensitive scan metadata by scanId: GET /v1/scan/:scanId
   */
  async getScanMetadata(req, res, next) {
    try {
      const { scanId } = req.params;
      const organizationId = req.principal?.organizationId || req.query.organizationId;

      if (!organizationId) {
        throw new ForbiddenError('Organization context required to inspect scan metadata.');
      }

      const metadata = await this.metadataRepo.findById(scanId, organizationId);
      if (!metadata) {
        throw new NotFoundError(`Scan record with ID '${scanId}' not found.`);
      }

      res.status(200).json(metadata);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = {
  ScanController,
  scanController: new ScanController()
};
