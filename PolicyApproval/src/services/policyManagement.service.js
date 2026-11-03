// Policy Management Service

const { policyRepository } = require('../repositories/policy.repository');
const { validateRule } = require('../policy-engine/ruleMatcher');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const { env } = require('../config/env');

class PolicyManagementService {
  constructor({ repo = policyRepository } = {}) {
    this.repo = repo;
  }

  async createPolicy(organizationId, data, callerId) {
    if (!organizationId) {
      throw new BadRequestError('Organization identifier is required.');
    }
    if (!data.name || typeof data.name !== 'string') {
      throw new BadRequestError('Policy name is required.');
    }

    const rules = Array.isArray(data.rules) ? data.rules : [];
    if (rules.length > env.maxRulesPerPolicy) {
      throw new BadRequestError(`Rules count exceeds limit of ${env.maxRulesPerPolicy}.`);
    }

    for (const rule of rules) {
      validateRule(rule);
    }

    return this.repo.createPolicy({
      organizationId,
      name: data.name,
      description: data.description || null,
      category: data.category || 'GENERAL',
      priority: typeof data.priority === 'number' ? data.priority : 100,
      rules,
      createdBy: callerId
    });
  }

  async listPolicies(organizationId, { limit, offset, status, category } = {}) {
    if (!organizationId) {
      throw new BadRequestError('Organization identifier is required.');
    }
    return this.repo.listByOrganization(organizationId, { limit, offset, status, category });
  }

  async getPolicyById(organizationId, policyId) {
    if (!organizationId) {
      throw new BadRequestError('Organization identifier is required.');
    }
    const policy = await this.repo.findById(policyId, organizationId);
    if (!policy) {
      throw new NotFoundError(`Policy '${policyId}' not found.`);
    }
    return policy;
  }

  async createVersion(organizationId, policyId, { rules = [], description, activate = false }, callerId) {
    if (!organizationId) {
      throw new BadRequestError('Organization identifier is required.');
    }
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new BadRequestError('New policy version must define an array of rules.');
    }
    if (rules.length > env.maxRulesPerPolicy) {
      throw new BadRequestError(`Rules count exceeds limit of ${env.maxRulesPerPolicy}.`);
    }

    for (const rule of rules) {
      validateRule(rule);
    }

    const version = await this.repo.createVersion(policyId, organizationId, {
      rules,
      description,
      createdBy: callerId,
      activate
    });

    if (!version) {
      throw new NotFoundError(`Policy '${policyId}' not found.`);
    }

    return version;
  }

  async activatePolicy(organizationId, policyId) {
    const existing = await this.getPolicyById(organizationId, policyId);
    await this.repo.updateStatus(policyId, organizationId, 'ACTIVE');
    return { ...existing, status: 'ACTIVE' };
  }

  async deactivatePolicy(organizationId, policyId) {
    const existing = await this.getPolicyById(organizationId, policyId);
    await this.repo.updateStatus(policyId, organizationId, 'INACTIVE');
    return { ...existing, status: 'INACTIVE' };
  }

  async setActiveVersion(organizationId, policyId, versionNumber) {
    const existing = await this.getPolicyById(organizationId, policyId);
    const hasVersion = existing.versions?.some((v) => v.version === versionNumber);
    if (!hasVersion) {
      throw new BadRequestError(`Version ${versionNumber} does not exist for policy '${policyId}'.`);
    }

    await this.repo.setActiveVersion(policyId, organizationId, versionNumber);
    return { ...existing, activeVersion: versionNumber };
  }
}

module.exports = {
  PolicyManagementService,
  policyManagementService: new PolicyManagementService()
};
