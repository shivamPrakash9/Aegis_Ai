// Cursor Pagination Integration Tests
// Verifies Module 2 Requirement 8: Cursor pagination with next link

const request = require('supertest');
const { app } = require('../../src/app');
const { identityClient } = require('../../src/clients/identityClient');
const { aiRequestRepository } = require('../../src/repositories/aiRequest.repository');

describe('Cursor-Based Pagination API (GET /v1/ai-requests)', () => {
  const orgId = 'org_cursor_test';
  const validToken = 'valid_cursor_token';

  beforeAll(async () => {
    // Seed 5 test requests into repository
    for (let i = 1; i <= 5; i++) {
      await aiRequestRepository.create({
        id: `req_cursor_item_${i}_${Date.now()}`,
        organizationId: orgId,
        callerId: 'usr_cursor_test',
        callerType: 'USER',
        status: 'COMPLETED',
        modelSelected: 'gpt-4o',
        traceId: `trc_cursor_${i}`,
        sanitizedPromptSummary: `Summary prompt ${i}`
      });
    }
  });

  beforeEach(() => {
    jest.spyOn(identityClient, 'verifySession').mockImplementation(async (token) => {
      if (token === validToken) {
        return {
          valid: true,
          principal: {
            id: 'usr_cursor_test',
            role: 'ORGANIZATION_ADMIN',
            organizationId: orgId,
            permissions: ['ai:request:create', 'ai:request:read', 'ai:request:list']
          }
        };
      }
      const { UnauthorizedError } = require('../../src/utils/errors');
      throw new UnauthorizedError('Credential verification failed.');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return cursor pagination metadata including nextCursor and next link', async () => {
    const res = await request(app)
      .get('/v1/ai-requests?limit=2')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toHaveProperty('nextCursor');
    expect(res.body.pagination).toHaveProperty('next');
    expect(res.body.pagination.hasMore).toBe(true);
    expect(res.body.pagination.next).toMatch(/\/v1\/ai-requests\?cursor=/);
  });

  it('should retrieve the next non-overlapping page of results using cursor', async () => {
    const page1 = await request(app)
      .get('/v1/ai-requests?limit=2')
      .set('Authorization', `Bearer ${validToken}`);

    const cursor = page1.body.pagination.nextCursor;
    expect(cursor).toBeDefined();

    const page2 = await request(app)
      .get(`/v1/ai-requests?cursor=${cursor}&limit=2`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(2);

    // Verify page 1 and page 2 items are non-overlapping
    const page1Ids = page1.body.data.map((d) => d.id);
    const page2Ids = page2.body.data.map((d) => d.id);
    for (const id of page2Ids) {
      expect(page1Ids).not.toContain(id);
    }
  });

  it('should support search query filter alongside pagination', async () => {
    const res = await request(app)
      .get('/v1/ai-requests?search=prompt&limit=10')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].sanitizedPromptSummary).toContain('prompt');
  });
});
