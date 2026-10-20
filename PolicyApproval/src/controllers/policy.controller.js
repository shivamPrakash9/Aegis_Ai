// Policy Management Controller

const { policyManagementService } = require('../services/policyManagement.service');
const { BadRequestError } = require('../utils/errors');

class PolicyController {
  constructor(service = policyManagementService) {
    this.service = service;
    this.createPolicy = this.createPolicy.bind(this);
    this.listPolicies = this.listPolicies.bind(this);
    this.getPolicy = this.getPolicy.bind(this);
    this.createVersion = this.createVersion.bind(this);
    this.activatePolicy = this.activatePolicy.bind(this);
    this.deactivatePolicy = this.deactivatePolicy.bind(this);
    this.setActiveVersion = this.setActiveVersion.bind(this);
  }

  _getOrgId(req) {
    const orgId = req.principal?.organizationId || req.body?.organizationId || req.query?.organizationId;
    if (!orgId) {
      throw new BadRequestError('Organization context required.');
    }
    return orgId;
  }

  async createPolicy(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const callerId = req.principal?.id || 'system';
      const created = await this.service.createPolicy(organizationId, req.body, callerId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  async listPolicies(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const { limit, offset, status, category } = req.query;
      const result = await this.service.listPolicies(organizationId, {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        status,
        category
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getPolicy(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const policyId = req.params.id;
      const policy = await this.service.getPolicyById(organizationId, policyId);
      res.status(200).json(policy);
    } catch (err) {
      next(err);
    }
  }

  async createVersion(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const policyId = req.params.id;
      const callerId = req.principal?.id || 'system';
      const version = await this.service.createVersion(organizationId, policyId, req.body, callerId);
      res.status(201).json(version);
    } catch (err) {
      next(err);
    }
  }

  async activatePolicy(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const policyId = req.params.id;
      const policy = await this.service.activatePolicy(organizationId, policyId);
      res.status(200).json(policy);
    } catch (err) {
      next(err);
    }
  }

  async deactivatePolicy(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const policyId = req.params.id;
      const policy = await this.service.deactivatePolicy(organizationId, policyId);
      res.status(200).json(policy);
    } catch (err) {
      next(err);
    }
  }

  async setActiveVersion(req, res, next) {
    try {
      const organizationId = this._getOrgId(req);
      const policyId = req.params.id;
      const versionNumber = parseInt(req.params.versionNumber, 10);
      const policy = await this.service.setActiveVersion(organizationId, policyId, versionNumber);
      res.status(200).json(policy);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = {
  PolicyController,
  policyController: new PolicyController()
};
