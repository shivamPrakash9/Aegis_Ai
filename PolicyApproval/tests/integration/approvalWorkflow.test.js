// Integration Tests: Human Approval Workflow

const request = require('supertest');
const { app } = require('../../src/app');
const { approvalRepository } = require('../../src/repositories/approval.repository');
const { testOrgId, generateTestToken } = require('../fixtures/syntheticData');

describe('Human Approval Workflow API', () => {
  const securityAdminToken = generateTestToken({
    sub: 'sec_admin_99',
    organizationId: testOrgId,
    role: 'SECURITY_ADMIN'
  });

  const normalMemberToken = generateTestToken({
    sub: 'user_dev_42',
    organizationId: testOrgId,
    role: 'MEMBER'
  });

  beforeEach(() => {
    approvalRepository.setForceInMemory(true);
    approvalRepository.clear();
  });

  test('lists pending approvals with pagination', async () => {
    await approvalRepository.createApproval({
      organizationId: testOrgId,
      requestId: 'req_1',
      reason: 'Approval needed for frontier model',
      modelRequested: 'gpt-4o',
      requesterId: 'usr_dev_42',
      requesterRole: 'MEMBER'
    });

    const res = await request(app)
      .get('/v1/approvals')
      .set('Authorization', `Bearer ${securityAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe('PENDING');
  });

  test('successfully submits decision (APPROVED) by authorized approver', async () => {
    const approval = await approvalRepository.createApproval({
      organizationId: testOrgId,
      requestId: 'req_2',
      reason: 'Frontier model review',
      modelRequested: 'gpt-4o',
      requesterId: 'usr_dev_42',
      requesterRole: 'MEMBER'
    });

    const res = await request(app)
      .post(`/v1/approvals/${approval.id}/decision`)
      .set('Authorization', `Bearer ${securityAdminToken}`)
      .send({
        decision: 'APPROVED',
        reason: 'Authorized for Q4 research sprint'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.approverId).toBe('sec_admin_99');
    expect(res.body.decisionReason).toBe('Authorized for Q4 research sprint');
  });

  test('rejects decision submission on already resolved approval (409 Conflict)', async () => {
    const approval = await approvalRepository.createApproval({
      organizationId: testOrgId,
      requestId: 'req_3',
      reason: 'Already reviewed item',
      requesterId: 'usr_other',
      requesterRole: 'MEMBER'
    });

    // First decision: APPROVED
    await request(app)
      .post(`/v1/approvals/${approval.id}/decision`)
      .set('Authorization', `Bearer ${securityAdminToken}`)
      .send({ decision: 'APPROVED' });

    // Second decision attempt
    const res = await request(app)
      .post(`/v1/approvals/${approval.id}/decision`)
      .set('Authorization', `Bearer ${securityAdminToken}`)
      .send({ decision: 'REJECTED' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('prevents self-approval when requester attempts to review own request (403 Forbidden)', async () => {
    const selfApprovalRequester = 'sec_admin_99';
    const approval = await approvalRepository.createApproval({
      organizationId: testOrgId,
      requestId: 'req_4',
      reason: 'Self-submitted request',
      requesterId: selfApprovalRequester,
      requesterRole: 'SECURITY_ADMIN'
    });

    const res = await request(app)
      .post(`/v1/approvals/${approval.id}/decision`)
      .set('Authorization', `Bearer ${securityAdminToken}`)
      .send({ decision: 'APPROVED' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Self-approval violation/i);
  });

  test('prevents unauthorized member from deciding approvals (403 Forbidden)', async () => {
    const approval = await approvalRepository.createApproval({
      organizationId: testOrgId,
      requestId: 'req_5',
      reason: 'Restricted request',
      requesterId: 'usr_other',
      requesterRole: 'MEMBER'
    });

    const res = await request(app)
      .post(`/v1/approvals/${approval.id}/decision`)
      .set('Authorization', `Bearer ${normalMemberToken}`)
      .send({ decision: 'APPROVED' });

    expect(res.status).toBe(403);
  });
});
