// Human Approval Workflow Controller

const { approvalService } = require('../services/approval.service');
const { BadRequestError } = require('../utils/errors');

class ApprovalController {
  constructor(service = approvalService) {
    this.service = service;
    this.listApprovals = this.listApprovals.bind(this);
    this.getApproval = this.getApproval.bind(this);
    this.submitDecision = this.submitDecision.bind(this);
  }

  _getOrgId(req) {
    const orgId = req.principal?.organizationId || req.body?.organizationId || req.query?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Organization context required.');
    }
    return orgId;
  }

  async listApprovals(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const { page, limit, status } = req.query;
      const result = await this.service.listApprovals(organizationId, { page, limit, status });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getApproval(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const approvalId = req.params.id;
      const result = await this.service.getApproval(approvalId, organizationId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async submitDecision(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const approvalId = req.params.id;
      const result = await this.service.submitDecision(
        approvalId,
        organizationId,
        req.body,
        req.principal
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = {
  ApprovalController,
  approvalController: new ApprovalController()
};
