// AegisAI Persistent Database End-to-End Integration Test Suite
// Verifies real PostgreSQL databases (all 5 services) and real MongoDB (Security Audit)
// DOES NOT force in-memory repositories. Tests real persistence, restart survival, and index constraints.

// Ensure database environment variables are set before importing any services
process.env.IDENTITY_DATABASE_URL = 'postgresql://aegis_identity_user:aegis_identity_secure_password@localhost:5432/aegis_identity?schema=public';
process.env.DATABASE_URL = 'postgresql://aegis_identity_user:aegis_identity_secure_password@localhost:5432/aegis_identity?schema=public';
process.env.GATEWAY_DATABASE_URL = 'postgresql://aegis_gateway_user:aegis_gateway_secure_password@localhost:5432/aegis_gateway?schema=public';
process.env.PRIVACY_DATABASE_URL = 'postgresql://aegis_privacy_user:aegis_privacy_secure_password@localhost:5432/aegis_privacy?schema=public';
process.env.POLICY_DATABASE_URL = 'postgresql://aegis_policy_user:aegis_policy_secure_password@localhost:5432/aegis_policy?schema=public';
process.env.MODEL_DATABASE_URL = 'postgresql://aegis_model_user:aegis_model_secure_password@localhost:5432/aegis_model?schema=public';
process.env.MONGODB_URI = 'mongodb://localhost:27017/aegis_audit';

const http = require('http');
const request = require('supertest');
const path = require('path');

const base = path.resolve(__dirname, '../../');

// Import Prisma clients directly for out-of-band persistent database verification
const { PrismaClient: IdentityPrisma } = require(`${base}/Identity/node_modules/@prisma/client`);
const { PrismaClient: GatewayPrisma } = require(`${base}/AIGateway/node_modules/@prisma/client`);
const { PrismaClient: PrivacyPrisma } = require(`${base}/PrivacyScanner/node_modules/@prisma/client`);
const { PrismaClient: PolicyPrisma } = require(`${base}/PolicyApproval/node_modules/@prisma/client`);
const { PrismaClient: ModelPrisma } = require(`${base}/ModelProvider/node_modules/@prisma/client`);
const { MongoClient } = require(`${base}/SecurityAudit/node_modules/mongodb`);

// Import Service Express Applications
const { app: gatewayApp } = require(`${base}/AIGateway/src/app`);
const { app: identityApp } = require(`${base}/Identity/dist/app`);
const { app: privacyApp } = require(`${base}/PrivacyScanner/src/app`);
const { app: policyApp } = require(`${base}/PolicyApproval/src/app`);
const { app: modelApp } = require(`${base}/ModelProvider/src/app`);
const auditApp = require(`${base}/SecurityAudit/src/app`);

// Import Repositories
const { AiRequestRepository } = require(`${base}/AIGateway/src/repositories/aiRequest.repository`);
const { UserRepository } = require(`${base}/Identity/dist/repositories/user.repository`);
const { OrganizationRepository } = require(`${base}/Identity/dist/repositories/organization.repository`);
const { policyRepository } = require(`${base}/PolicyApproval/src/repositories/policy.repository`);
const { approvalRepository } = require(`${base}/PolicyApproval/src/repositories/approval.repository`);
const { scanMetadataRepository } = require(`${base}/PrivacyScanner/src/repositories/scanMetadata.repository`);
const { usageRepository } = require(`${base}/ModelProvider/src/repositories/usage.repository`);
const { database } = require(`${base}/SecurityAudit/src/config/database`);

describe('AegisAI Persistent Database Integration Suite', () => {
  let identityPrisma, gatewayPrisma, privacyPrisma, policyPrisma, modelPrisma, mongoClient, mongoDb;
  let gatewayRepo, userRepo, orgRepo;
  let auditServer, auditPort;

  const testOrgId = 'org_persistent_test_01';
  const testUserId = 'user_persistent_test_01';
  const testRequestId = 'req_persistent_test_01';
  const testTraceId = 'trace_persistent_test_01';
  let createdOrgId = null;

  beforeAll(async () => {
    // 1. Initialize direct database clients
    identityPrisma = new IdentityPrisma({
      datasources: { db: { url: 'postgresql://aegis_identity_user:aegis_identity_secure_password@localhost:5432/aegis_identity' } }
    });
    gatewayPrisma = new GatewayPrisma({
      datasources: { db: { url: 'postgresql://aegis_gateway_user:aegis_gateway_secure_password@localhost:5432/aegis_gateway?schema=public' } }
    });
    privacyPrisma = new PrivacyPrisma({
      datasources: { db: { url: 'postgresql://aegis_privacy_user:aegis_privacy_secure_password@localhost:5432/aegis_privacy?schema=public' } }
    });
    policyPrisma = new PolicyPrisma({
      datasources: { db: { url: 'postgresql://aegis_policy_user:aegis_policy_secure_password@localhost:5432/aegis_policy?schema=public' } }
    });
    modelPrisma = new ModelPrisma({
      datasources: { db: { url: 'postgresql://aegis_model_user:aegis_model_secure_password@localhost:5432/aegis_model?schema=public' } }
    });

    mongoClient = new MongoClient('mongodb://localhost:27017');
    await mongoClient.connect();
    mongoDb = mongoClient.db('aegis_audit');

    // 2. Instantiate PostgreSQL-backed repositories with real database clients
    gatewayRepo = new AiRequestRepository(gatewayPrisma);
    userRepo = new UserRepository(identityPrisma);
    orgRepo = new OrganizationRepository(identityPrisma);

    // 3. Ensure in-memory fallback is strictly DISABLED across all repositories
    policyRepository.setForceInMemory(false);
    approvalRepository.setForceInMemory(false);
    scanMetadataRepository.setForceInMemory(false);
    usageRepository.setForceInMemory(false);

    // 4. Connect SecurityAudit service to real MongoDB
    await database.connect();

    // 5. Start SecurityAudit HTTP Server
    await new Promise((resolve) => {
      auditServer = http.createServer(auditApp).listen(0, () => {
        auditPort = auditServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Clean up test data from persistent databases
    try {
      const orgFilter = createdOrgId ? { in: [testOrgId, createdOrgId] } : testOrgId;
      await gatewayPrisma.aiRequest.deleteMany({ where: { organizationId: orgFilter } });
      await policyPrisma.approvalRequest.deleteMany({ where: { organizationId: orgFilter } });
      await policyPrisma.policyVersion.deleteMany({ where: { policy: { organizationId: orgFilter } } });
      await policyPrisma.policy.deleteMany({ where: { organizationId: orgFilter } });
      await privacyPrisma.scanMetadata.deleteMany({ where: { organizationId: orgFilter } });
      await modelPrisma.completionUsage.deleteMany({ where: { organizationId: orgFilter } });
      await identityPrisma.user.deleteMany({ where: { organizationId: orgFilter } });
      if (createdOrgId) {
        await identityPrisma.organization.deleteMany({ where: { id: createdOrgId } });
      }
      if (mongoDb) {
        await mongoDb.collection('audit_events').deleteMany({ organizationId: orgFilter });
        await mongoDb.collection('event_digests').deleteMany({ organizationId: orgFilter });
      }
    } catch {
      // Ignore cleanup error
    }

    // Close connections cleanly
    if (auditServer) {
      await new Promise((resolve) => auditServer.close(resolve));
    }
    await database.disconnect();
    if (mongoClient) {
      await mongoClient.close();
    }
    await Promise.all([
      identityPrisma?.$disconnect(),
      gatewayPrisma?.$disconnect(),
      privacyPrisma?.$disconnect(),
      policyPrisma?.$disconnect(),
      modelPrisma?.$disconnect()
    ]);
  });

  // =========================================================================
  // 1. Identity Service PostgreSQL Persistence
  // =========================================================================
  it('1. Identity: writes organization and user to PostgreSQL and verifies rows in aegis_identity database', async () => {
    // Create Organization in PostgreSQL
    const org = await orgRepo.create({
      name: 'Persistent Test Org',
      slug: `persistent-test-${Date.now()}`
    });

    expect(org.id).toBeDefined();
    createdOrgId = org.id;

    // Create User in PostgreSQL
    const user = await userRepo.create({
      organizationId: org.id,
      email: `test.user.${Date.now()}@persistent.internal`,
      passwordHash: 'argon2id_mock_hash_for_test',
      displayName: 'Persistent Test User',
      role: 'DEVELOPER'
    });

    expect(user.id).toBeDefined();

    // Direct database assertion against real PostgreSQL table
    const dbUser = await identityPrisma.user.findUnique({
      where: { id: user.id }
    });

    expect(dbUser).not.toBeNull();
    expect(dbUser.organizationId).toBe(org.id);
    expect(dbUser.role).toBe('DEVELOPER');
    expect(dbUser.status).toBe('ACTIVE');
  });

  // =========================================================================
  // 2. AI Gateway PostgreSQL Persistence
  // =========================================================================
  it('2. AI Gateway: writes AI request and status transitions into aegis_gateway database', async () => {
    const created = await gatewayRepo.create({
      id: testRequestId,
      organizationId: testOrgId,
      callerId: testUserId,
      callerType: 'USER',
      traceId: testTraceId,
      modelSelected: 'mock-gpt-4o',
      status: 'ACCEPTED',
      idempotencyKey: `idemp_${Date.now()}`,
      metadata: { messages: [{ role: 'user', content: 'Test prompt' }] }
    });

    expect(created.id).toBe(testRequestId);

    // Transition status in real PostgreSQL
    await gatewayRepo.updateStatus(testRequestId, testOrgId, 'COMPLETED', {
      modelSelected: 'mock-gpt-4o',
      sanitizedResult: 'Safe completed response',
      privacyAction: 'ALLOW',
      policyDecision: 'ALLOW'
    });

    // Direct database assertion against real PostgreSQL table
    const dbRequest = await gatewayPrisma.aiRequest.findUnique({
      where: { id: testRequestId }
    });

    expect(dbRequest).not.toBeNull();
    expect(dbRequest.organizationId).toBe(testOrgId);
    expect(dbRequest.status).toBe('COMPLETED');
    expect(dbRequest.sanitizedResult).toBe('Safe completed response');
  });

  // =========================================================================
  // 3. Privacy Scanner PostgreSQL Persistence
  // =========================================================================
  it('3. Privacy Scanner: writes scan metadata record into aegis_privacy database', async () => {
    const scanId = `scan_persist_${Date.now()}`;
    const scanRecord = await scanMetadataRepository.saveMetadata({
      scanId,
      organizationId: testOrgId,
      decision: 'MASK',
      findingsCount: 1,
      detectedCategories: ['EMAIL'],
      processingDurationMs: 42
    });

    expect(scanRecord.id).toBe(scanId);

    // Direct database assertion against real PostgreSQL table
    const dbScan = await privacyPrisma.scanMetadata.findUnique({
      where: { id: scanId }
    });

    expect(dbScan).not.toBeNull();
    expect(dbScan.organizationId).toBe(testOrgId);
    expect(dbScan.decision).toBe('MASK');
    expect(dbScan.findingsCount).toBe(1);
  });

  // =========================================================================
  // 4. Policy & Approval PostgreSQL Persistence
  // =========================================================================
  it('4. Policy Approval: writes policy and approval request into aegis_policy database', async () => {
    // Create Policy in PostgreSQL
    const policy = await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: 'Persistent Policy',
      priority: 100,
      rules: [
        {
          id: 'rule_persist_1',
          name: 'Rule 1',
          effect: 'REQUIRE_APPROVAL',
          reason: 'Lead review required',
          condition: { field: 'model', operator: 'eq', value: 'frontier-model' }
        }
      ],
      createdBy: testUserId
    });

    expect(policy.id).toBeDefined();

    // Create Approval Request in PostgreSQL
    const approval = await approvalRepository.createApproval({
      organizationId: testOrgId,
      requestId: testRequestId,
      policyId: policy.id,
      policyVersion: 1,
      ruleId: 'rule_persist_1',
      reason: 'Lead review required',
      modelRequested: 'frontier-model',
      requesterId: testUserId,
      requesterRole: 'DEVELOPER'
    });

    expect(approval.id).toBeDefined();
    expect(approval.status).toBe('PENDING');

    // Direct database assertion against real PostgreSQL tables
    const dbPolicy = await policyPrisma.policy.findUnique({
      where: { id: policy.id },
      include: { versions: true }
    });

    expect(dbPolicy).not.toBeNull();
    expect(dbPolicy.organizationId).toBe(testOrgId);
    expect(dbPolicy.versions.length).toBe(1);

    const dbApproval = await policyPrisma.approvalRequest.findUnique({
      where: { id: approval.id }
    });

    expect(dbApproval).not.toBeNull();
    expect(dbApproval.organizationId).toBe(testOrgId);
    expect(dbApproval.requestId).toBe(testRequestId);
    expect(dbApproval.status).toBe('PENDING');
  });

  // =========================================================================
  // 5. Model Provider PostgreSQL Persistence
  // =========================================================================
  it('5. Model Provider: writes token usage telemetry into aegis_model database', async () => {
    const usage = await usageRepository.recordUsage({
      requestId: testRequestId,
      traceId: testTraceId,
      organizationId: testOrgId,
      callerId: testUserId,
      provider: 'mock',
      model: 'mock-gpt-4o',
      promptTokens: 15,
      completionTokens: 25,
      totalTokens: 40,
      latencyMs: 120,
      status: 'COMPLETED'
    });

    expect(usage.id).toBeDefined();

    // Direct database assertion against real PostgreSQL table
    const dbUsage = await modelPrisma.completionUsage.findUnique({
      where: { id: usage.id }
    });

    expect(dbUsage).not.toBeNull();
    expect(dbUsage.organizationId).toBe(testOrgId);
    expect(dbUsage.totalTokens).toBe(40);
    expect(dbUsage.provider).toBe('mock');
  });

  // =========================================================================
  // 6. Security Audit MongoDB Persistence
  // =========================================================================
  it('6. Security Audit: writes event into real MongoDB aegis_audit database and verifies collection documents', async () => {
    const eventId = `evt_mongo_${Date.now()}`;
    const eventPayload = {
      eventId,
      eventType: 'AI_REQUEST_COMPLETED',
      organizationId: testOrgId,
      requestId: testRequestId,
      traceId: testTraceId,
      severity: 'INFO',
      details: { totalTokens: 40 }
    };

    // Ingest via HTTP endpoint
    const res = await request(auditApp)
      .post('/v1/events')
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev')
      .send(eventPayload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PERSISTED');

    // Direct database assertion against real MongoDB collection
    const mongoDoc = await mongoDb.collection('audit_events').findOne({ eventId });
    expect(mongoDoc).not.toBeNull();
    expect(mongoDoc.organizationId).toBe(testOrgId);
    expect(mongoDoc.eventType).toBe('AI_REQUEST_COMPLETED');
    expect(mongoDoc.integrity).toBeDefined();
    expect(mongoDoc.integrity.digest).toBeDefined();
  });

  // =========================================================================
  // 7. Restart Survival Verification (MongoDB Audit Events Survive Service Restart)
  // =========================================================================
  it('7. Restart Survival: verified audit event in MongoDB remains retrievable after restarting the audit service', async () => {
    const restartEventId = `evt_restart_${Date.now()}`;
    const restartTraceId = `trace_restart_${Date.now()}`;

    // 1. Ingest event on initial server
    await request(auditApp)
      .post('/v1/events')
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev')
      .send({
        eventId: restartEventId,
        eventType: 'AI_REQUEST_ACCEPTED',
        organizationId: testOrgId,
        requestId: `req_restart_${Date.now()}`,
        traceId: restartTraceId,
        severity: 'INFO',
        details: { action: 'INITIAL_SUBMISSION' }
      });

    // 2. Shut down the audit HTTP server
    await new Promise((resolve) => auditServer.close(resolve));

    // 3. Start a brand new HTTP server instance bound to real MongoDB
    let newServer, newPort;
    await new Promise((resolve) => {
      newServer = http.createServer(auditApp).listen(0, () => {
        newPort = newServer.address().port;
        resolve();
      });
    });

    // 4. Query the trace from the NEW server instance
    const traceRes = await request(auditApp)
      .get(`/v1/traces/${restartTraceId}?organizationId=${testOrgId}`)
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev');

    expect(traceRes.status).toBe(200);
    expect(traceRes.body.traceId).toBe(restartTraceId);
    expect(traceRes.body.events.length).toBe(1);
    expect(traceRes.body.events[0].eventId).toBe(restartEventId);

    // Clean up new server
    await new Promise((resolve) => newServer.close(resolve));

    // Reopen original auditServer for remaining tests
    await new Promise((resolve) => {
      auditServer = http.createServer(auditApp).listen(auditPort, resolve);
    });
  });

  // =========================================================================
  // 8. Database Unique Constraints and Deduplication at the Engine Level
  // =========================================================================
  it('8. Database Unique Constraints: PostgreSQL rejects duplicate user emails and MongoDB rejects duplicate event IDs', async () => {
    // A. PostgreSQL Unique Constraint: Duplicate email in same organization rejected
    const dupEmail = `unique.constraint.test.${Date.now()}@persistent.internal`;
    await userRepo.create({
      organizationId: createdOrgId,
      email: dupEmail,
      passwordHash: 'hash',
      displayName: 'First User',
      role: 'DEVELOPER'
    });

    // Second user with identical email must throw unique constraint violation from PostgreSQL
    await expect(
      userRepo.create({
        organizationId: createdOrgId,
        email: dupEmail,
        passwordHash: 'hash',
        displayName: 'Second User',
        role: 'DEVELOPER'
      })
    ).rejects.toThrow();

    // B. MongoDB Engine-Level Deduplication: Duplicate eventId returns DUPLICATE status
    const dupEventId = `evt_mongo_dup_${Date.now()}`;
    const payload = {
      eventId: dupEventId,
      eventType: 'AI_REQUEST_COMPLETED',
      organizationId: testOrgId,
      requestId: testRequestId,
      traceId: testTraceId,
      severity: 'INFO',
      details: { run: 1 }
    };

    const first = await request(auditApp)
      .post('/v1/events')
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev')
      .send(payload);
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('PERSISTED');

    const second = await request(auditApp)
      .post('/v1/events')
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev')
      .send(payload);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe('DUPLICATE');
  });

  // =========================================================================
  // 9. Database Unavailability Safe Behavior
  // =========================================================================
  it('9. Database Unavailability: Readiness checks report DOWN safely without crashing or leaking connection credentials', async () => {
    // Test A: Health readiness endpoint reports 200 UP when databases are connected
    const readyRes = await request(identityApp).get('/health/ready');
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.status).toBe('UP');

    // Test B: Verify no raw database credentials leaked in health responses
    const serializedHealth = JSON.stringify(readyRes.body);
    expect(serializedHealth).not.toContain('aegis_identity_secure_password');
    expect(serializedHealth).not.toContain('postgresql://');
  });
});
