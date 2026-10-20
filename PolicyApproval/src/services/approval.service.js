// Human Approval Workflow Service

const { approvalRepository } = require('../repositories/approval.repository');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../utils/errors');
const { logger } = require('../utils/logger');

const ALLOWED_APPROVER_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'POLICY_ADMIN',
  'SECURITY_ADMIN',
  'COMPLIANCE_OFFICER',
  'MANAGER',
  'INTERNAL_SERVICE'
]);

class ApprovalService {
  constructor(repo = approvalRepository) {
    this.approvalRepo = repo;
  }

  /**
   * List approvals for a tenant organization.
   */
  async listApprovals(organizationId, { page = 1, limit = 20, status } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let normalizedStatus = status ? String(status).toUpperCase() : undefined;
    if (normalizedStatus && !['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(normalizedStatus)) {
      throw new BadRequestError(`Invalid status filter '${status}'. Must be PENDING, APPROVED, REJECTED, or EXPIRED.`);
    }

    const { items, total } = await this.approvalRepo.listByOrganization(organizationId, {
      limit: limitNum,
      offset,
      status: normalizedStatus
    });

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  }

  /**
   * Get an approval request by ID.
   */
  async getApproval(approvalId, organizationId) {
    const approval = await this.approvalRepo.findById(approvalId, organizationId);
    if (!approval) {
      throw new NotFoundError(`Approval request '${approvalId}' not found.`);
    }
    return approval;
  }

  /**
   * Submit human decision (APPROVE / REJECT) for an approval request.
   */
  async submitDecision(approvalId, organizationId, { decision, reason }, principal = {}) {
    if (!decision) {
      throw new BadRequestError("Field 'decision' is required ('APPROVED' or 'REJECTED').");
    }

    const normalizedDecision = decision.toUpperCase();
    const finalStatus = normalizedDecision === 'APPROVE' ? 'APPROVED' : normalizedDecision === 'REJECT' ? 'REJECTED' : normalizedDecision;

    if (!['APPROVED', 'REJECTED'].includes(finalStatus)) {
      throw new BadRequestError(`Invalid decision '${decision}'. Must be APPROVED or REJECTED.`);
    }

    // Role check: Only authorized roles can approve/reject
    const approverRole = principal.role || 'MEMBER';
    if (!ALLOWED_APPROVER_ROLES.has(approverRole) && !principal.isInternalService) {
      throw new ForbiddenError(`Role '${approverRole}' is not authorized to review or decide approval requests.`);
    }

    const existing = await this.getApproval(approvalId, organizationId);

    // Prevent self-approval (requester cannot approve own request, unless SUPER_ADMIN or INTERNAL_SERVICE)
    if (
      existing.requesterId &&
      principal.id &&
      existing.requesterId === principal.id &&
      !['SUPER_ADMIN', 'INTERNAL_SERVICE'].includes(approverRole)
    ) {
      throw new ForbiddenError('Self-approval violation: Requesters cannot approve their own requests.');
    }

    // Check expiration
    if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
      throw new BadRequestError(`Approval request '${approvalId}' has expired.`);
    }

    const updated = await this.approvalRepo.submitDecision(approvalId, organizationId, {
      status: finalStatus,
      approverId: principal.id || 'system:approver',
      approverRole,
      decisionReason: reason || null
    });

    logger.info(
      {
        approvalId,
        organizationId,
        decision: finalStatus,
        approverId: principal.id,
        approverRole
      },
      'Approval decision recorded successfully'
    );

    return updated;
  }
}

module.exports = {
  ApprovalService,
  approvalService: new ApprovalService()
};
