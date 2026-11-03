// ETag and HTTP 304 Not Modified Integration Tests
// Verifies Module 2 Requirement 6: ETag and working 304 response

const request = require('supertest');
const { app } = require('../../src/app');

describe('ETag and HTTP 304 Cache Behavior', () => {
  it('should return 200 OK with ETag header on GET requests', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('etag');
    expect(res.headers.etag).toMatch(/^W\/"/);
    expect(res.headers['cache-control']).toBeDefined();
  });

  it('should return 304 Not Modified with empty body when If-None-Match matches ETag', async () => {
    const initialRes = await request(app).get('/openapi.json');
    const etag = initialRes.headers.etag;
    expect(etag).toBeDefined();

    const cachedRes = await request(app)
      .get('/openapi.json')
      .set('If-None-Match', etag);

    expect(cachedRes.status).toBe(304);
    expect(cachedRes.text).toBe('');
    expect(cachedRes.body).toEqual({});
  });

  it('should return 200 OK when If-None-Match does not match current ETag', async () => {
    const res = await request(app)
      .get('/openapi.json')
      .set('If-None-Match', 'W/"mismatched-etag-hash"');

    expect(res.status).toBe(200);
    expect(res.headers.etag).toBeDefined();
  });
});
