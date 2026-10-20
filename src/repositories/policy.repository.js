// Policy and Policy Version Repository

const { getPrismaClient } = require('../config/database');
const { logger } = require('../utils/logger');
const { generatePolicyId } = require('../utils/correlationId');
const { v4: uuidv4 } = require('uuid');

class PolicyRepository {
  constructor() {
    this._inMemoryPolicies = new Map();
    this._inMemoryVersions = new Map();
    this._forceInMemory = false;
  }

  setForceInMemory(val) {
    this._forceInMemory = val;
  }

  clear() {
    this._inMemoryPolicies.clear();
    this._inMemoryVersions.clear();
  }

  /**
   * Retrieves active policies and their active versions for an organization.
   *
   * @param {string} organizationId
   * @returns {Promise<Array<object>>}
   */
  async findActiveByOrganization(organizationId) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const policies = await prisma.policy.findMany({
          where: {
            organizationId,
            status: 'ACTIVE'
          },
          include: {
            versions: true
          },
          orderBy: {
            priority: 'desc'
          }
        });

        return policies.map((p) => {
          const activeVer = p.versions.find((v) => v.version === p.activeVersion);
          return {
            ...p,
            rules: activeVer ? JSON.parse(activeVer.rules || '[]') : [],
            versionNumber: p.activeVersion
          };
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for active policies, using in-memory');
      }
    }

    const orgPolicies = Array.from(this._inMemoryPolicies.values()).filter(
      (p) => p.organizationId === organizationId && p.status === 'ACTIVE'
    );

    orgPolicies.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return orgPolicies.map((p) => {
      const versions = this._inMemoryVersions.get(p.id) || [];
      const activeVer = versions.find((v) => v.version === p.activeVersion);
      return {
        ...p,
        rules: activeVer ? activeVer.rules : [],
        versionNumber: p.activeVersion
      };
    });
  }

  /**
   * Lists policies for an organization with pagination and filters.
   */
  async listByOrganization(organizationId, { limit = 20, offset = 0, status, category } = {}) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const where = { organizationId };
        if (status) where.status = status;
        if (category) where.category = category;

        const [items, total] = await Promise.all([
          prisma.policy.findMany({
            where,
            skip: offset,
            take: limit,
            orderBy: { createdAt: 'desc' }
          }),
          prisma.policy.count({ where })
        ]);

        return { items, total };
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for policy list, using in-memory');
      }
    }

    let items = Array.from(this._inMemoryPolicies.values()).filter(
      (p) => p.organizationId === organizationId
    );

    if (status) items = items.filter((p) => p.status === status);
    if (category) items = items.filter((p) => p.category === category);

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);

    return { items: paginated, total };
  }

  /**
   * Retrieves policy by ID scoped strictly to the organization.
   */
  async findById(policyId, organizationId) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const policy = await prisma.policy.findFirst({
          where: { id: policyId, organizationId },
          include: { versions: { orderBy: { version: 'desc' } } }
        });

        if (policy) {
          return {
            ...policy,
            versions: policy.versions.map((v) => ({
              ...v,
              rules: JSON.parse(v.rules || '[]')
            }))
          };
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for policy by ID, using in-memory');
      }
    }

    const policy = this._inMemoryPolicies.get(policyId);
    if (policy && policy.organizationId === organizationId) {
      const versions = this._inMemoryVersions.get(policyId) || [];
      return {
        ...policy,
        versions
      };
    }
    return null;
  }

  /**
   * Creates a new policy and initial version 1.
   */
  async createPolicy({ organizationId, name, description, category = 'GENERAL', priority = 100, rules = [], createdBy }) {
    const policyId = generatePolicyId();
    const versionId = uuidv4();
    const rulesJson = JSON.stringify(rules);

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const created = await prisma.policy.create({
          data: {
            id: policyId,
            organizationId,
            name,
            description,
            category,
            priority,
            status: 'ACTIVE',
            activeVersion: 1,
            createdBy,
            versions: {
              create: {
                id: versionId,
                version: 1,
                rules: rulesJson,
                description: 'Initial version',
                createdBy
              }
            }
          },
          include: { versions: true }
        });

        const parsedVersions = created.versions.map((v) => ({
          ...v,
          rules: JSON.parse(v.rules || '[]')
        }));
        return {
          ...created,
          rules,
          versions: parsedVersions
        };
      } catch (err) {
        logger.debug({ err: err.message }, 'Database write failed for createPolicy, using in-memory');
      }
    }

    const now = new Date();
    const policyRecord = {
      id: policyId,
      organizationId,
      name,
      description,
      category,
      priority,
      status: 'ACTIVE',
      activeVersion: 1,
      createdBy,
      createdAt: now,
      updatedAt: now
    };

    const versionRecord = {
      id: versionId,
      policyId,
      version: 1,
      rules,
      description: 'Initial version',
      createdBy,
      createdAt: now
    };

    this._inMemoryPolicies.set(policyId, policyRecord);
    this._inMemoryVersions.set(policyId, [versionRecord]);

    return {
      ...policyRecord,
      rules,
      versions: [versionRecord]
    };
  }

  /**
   * Creates a new immutable version for an existing policy.
   */
  async createVersion(policyId, organizationId, { rules = [], description, createdBy, activate = false }) {
    const existing = await this.findById(policyId, organizationId);
    if (!existing) return null;

    const nextVersion = (existing.versions?.length || 0) + 1;
    const versionId = uuidv4();
    const rulesJson = JSON.stringify(rules);

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const created = await prisma.$transaction(async (tx) => {
          const ver = await tx.policyVersion.create({
            data: {
              id: versionId,
              policyId,
              version: nextVersion,
              rules: rulesJson,
              description,
              createdBy
            }
          });

          if (activate) {
            await tx.policy.update({
              where: { id: policyId },
              data: { activeVersion: nextVersion }
            });
          }

          return ver;
        });

        return {
          ...created,
          rules: JSON.parse(created.rules)
        };
      } catch (err) {
        logger.debug({ err: err.message }, 'Database transaction failed for createVersion, using in-memory');
      }
    }

    const now = new Date();
    const versionRecord = {
      id: versionId,
      policyId,
      version: nextVersion,
      rules,
      description,
      createdBy,
      createdAt: now
    };

    const versions = this._inMemoryVersions.get(policyId) || [];
    versions.push(versionRecord);
    this._inMemoryVersions.set(policyId, versions);

    if (activate) {
      const pol = this._inMemoryPolicies.get(policyId);
      if (pol) {
        pol.activeVersion = nextVersion;
        pol.updatedAt = now;
      }
    }

    return versionRecord;
  }

  /**
   * Updates policy status (e.g. ACTIVE, INACTIVE).
   */
  async updateStatus(policyId, organizationId, status) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        return await prisma.policy.updateMany({
          where: { id: policyId, organizationId },
          data: { status }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database update failed for policy status, using in-memory');
      }
    }

    const pol = this._inMemoryPolicies.get(policyId);
    if (pol && pol.organizationId === organizationId) {
      pol.status = status;
      pol.updatedAt = new Date();
      return { count: 1 };
    }
    return { count: 0 };
  }

  /**
   * Sets active version for a policy.
   */
  async setActiveVersion(policyId, organizationId, versionNumber) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        return await prisma.policy.updateMany({
          where: { id: policyId, organizationId },
          data: { activeVersion: versionNumber }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database update failed for active version, using in-memory');
      }
    }

    const pol = this._inMemoryPolicies.get(policyId);
    if (pol && pol.organizationId === organizationId) {
      pol.activeVersion = versionNumber;
      pol.updatedAt = new Date();
      return { count: 1 };
    }
    return { count: 0 };
  }
}

module.exports = {
  PolicyRepository,
  policyRepository: new PolicyRepository()
};
