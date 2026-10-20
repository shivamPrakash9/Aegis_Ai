// Approval Request Repository

const { getPrismaClient } = require('../config/database');
const { logger } = require('../utils/logger');
const { generateApprovalId } = require('../utils/correlationId');
const { ConflictError, NotFoundError } = require('../utils/errors');

class ApprovalRepository {
  constructor() {
    this._inMemoryApprovals = new Map();
    this._forceInMemory = false;
  }

  setForceInMemory(val) {
    this._forceInMemory = val;
  }

  clear() {
    this._inMemoryApprovals.clear();
  }

  /**
   * Creates a new pending approval request.
   */
  async createApproval({
    organizationId,
    requestId,
    policyId,
    policyVersion,
    ruleId,
    reason,
    modelRequested,
    requesterId,
    requesterRole,
    requesterType = 'USER',
    expiresInHours = 72
  }) {
    const id = generateApprovalId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 3600 * 1000);

    const record = {
      id,
      organizationId,
      requestId: requestId || null,
      policyId: policyId || null,
      policyVersion: policyVersion || null,
      ruleId: ruleId || null,
      reason,
      modelRequested: modelRequested || null,
      status: 'PENDING',
      requesterId,
      requesterRole: requesterRole || null,
      requesterType,
      approverId: null,
      approverRole: null,
      decisionReason: null,
      decisionAt: null,
      expiresAt,
      createdAt: now,
      updatedAt: now
    };

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        return await prisma.approvalRequest.create({
          data: record
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database write failed for approval creation, using in-memory');
      }
    }

    this._inMemoryApprovals.set(id, { ...record });
    return record;
  }

  /**
   * Retrieves an approval request by ID scoped to the organization.
   */
  async findById(approvalId, organizationId) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        return await prisma.approvalRequest.findFirst({
          where: { id: approvalId, organizationId }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for approval lookup, using in-memory');
      }
    }

    const item = this._inMemoryApprovals.get(approvalId);
    if (item && item.organizationId === organizationId) {
      return { ...item };
    }
    return null;
  }

  /**
   * Lists approval requests for an organization with pagination.
   */
  async listByOrganization(organizationId, { limit = 20, offset = 0, status } = {}) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const where = { organizationId };
        if (status) where.status = status;

        const [items, total] = await Promise.all([
          prisma.approvalRequest.findMany({
            where,
            skip: offset,
            take: limit,
            orderBy: { createdAt: 'desc' }
          }),
          prisma.approvalRequest.count({ where })
        ]);

        return { items, total };
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for approval listing, using in-memory');
      }
    }

    let items = Array.from(this._inMemoryApprovals.values()).filter(
      (a) => a.organizationId === organizationId
    );

    if (status) items = items.filter((a) => a.status === status);

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);

    return { items: paginated, total };
  }

  /**
   * Submits human decision for an approval request (atomic state transition).
   */
  async submitDecision(approvalId, organizationId, { status, approverId, approverRole, decisionReason }) {
    const existing = await this.findById(approvalId, organizationId);
    if (!existing) {
      throw new NotFoundError(`Approval request '${approvalId}' not found.`);
    }

    if (existing.status !== 'PENDING') {
      throw new ConflictError(
        `Approval request '${approvalId}' is already in '${existing.status}' state and cannot be modified.`
      );
    }

    const now = new Date();
    const updateData = {
      status,
      approverId,
      approverRole: approverRole || null,
      decisionReason: decisionReason || null,
      decisionAt: now,
      updatedAt: now
    };

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const updated = await prisma.approvalRequest.updateMany({
          where: {
            id: approvalId,
            organizationId,
            status: 'PENDING' // Atomic check
          },
          data: updateData
        });

        if (updated.count === 0) {
          throw new ConflictError(`Approval request '${approvalId}' was already resolved by another approver.`);
        }

        return await this.findById(approvalId, organizationId);
      } catch (err) {
        if (err instanceof ConflictError) throw err;
        logger.debug({ err: err.message }, 'Database update failed for approval decision, using in-memory');
      }
    }

    const memoryItem = this._inMemoryApprovals.get(approvalId);
    if (!memoryItem || memoryItem.status !== 'PENDING') {
      throw new ConflictError(`Approval request '${approvalId}' is already resolved.`);
    }

    Object.assign(memoryItem, updateData);
    return { ...memoryItem };
  }
}

module.exports = {
  ApprovalRepository,
  approvalRepository: new ApprovalRepository()
};
