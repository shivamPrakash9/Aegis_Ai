// GraphQL Endpoint Integration Tests
// Verifies Module 1, 3, 4 Requirement 15: GraphQL alongside REST

const request = require('supertest');
const { app } = require('../../src/app');
const { identityClient } = require('../../src/clients/identityClient');

describe('GraphQL Endpoint (/graphql and /v1/graphql)', () => {
  const validToken = 'valid_graphql_token';

  beforeEach(() => {
    jest.spyOn(identityClient, 'verifySession').mockImplementation(async (token) => {
      if (token === validToken) {
        return {
          valid: true,
          principal: {
            id: 'usr_graphql_test_123',
            email: 'admin@aegisai.internal',
            role: 'ORGANIZATION_ADMIN',
            organizationId: 'org_graphql_test',
            permissions: ['ai:request:create', 'ai:request:read', 'ai:request:list']
          }
        };
      }
      const { UnauthorizedError } = require('../../src/utils/errors');
      throw new UnauthorizedError('Credential verification failed: invalid token.');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject unauthenticated GraphQL query with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: '{ me { id role } }' });

    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
  });

  it('should successfully execute me query with valid Bearer token', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ query: '{ me { id role organizationId } }' });

    expect(res.status).toBe(200);
    expect(res.body.data.me).toEqual({
      id: 'usr_graphql_test_123',
      role: 'ORGANIZATION_ADMIN',
      organizationId: 'org_graphql_test'
    });
  });

  it('should execute models catalogue query', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ query: '{ models { id name provider } }' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.models)).toBe(true);
    expect(res.body.data.models.length).toBeGreaterThan(0);
    expect(res.body.data.models[0]).toHaveProperty('provider');
  });

  it('should execute aiRequests connection query with pagination', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ query: '{ aiRequests(limit: 5) { items { id status } total hasMore } }' });

    expect(res.status).toBe(200);
    expect(res.body.data.aiRequests).toHaveProperty('items');
    expect(res.body.data.aiRequests).toHaveProperty('hasMore');
  });

  it('should reject queries exceeding depth complexity limit', async () => {
    const deepQuery = '{ me { id } }'.repeat(12);
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ query: deepQuery });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('code', 'QUERY_TOO_COMPLEX');
  });
});
