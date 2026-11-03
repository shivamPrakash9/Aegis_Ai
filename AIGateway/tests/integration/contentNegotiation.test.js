// Content Negotiation Integration Tests
// Verifies Module 2 Requirement 7: JSON and XML support

const request = require('supertest');
const { app } = require('../../src/app');

describe('Content Negotiation (JSON & XML)', () => {
  it('should return JSON by default when no Accept header is supplied', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('status', 'UP');
  });

  it('should return JSON when Accept: application/json is explicitly requested', async () => {
    const res = await request(app)
      .get('/health/live')
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('status', 'UP');
  });

  it('should return valid XML under <response> root when Accept: application/xml is requested', async () => {
    const res = await request(app)
      .get('/health/live')
      .set('Accept', 'application/xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<?xml');
    expect(res.text).toContain('<response>');
    expect(res.text).toContain('<status>UP</status>');
    expect(res.text).toContain('</response>');
  });

  it('should return 406 Not Acceptable when unsupported Accept format is requested', async () => {
    const res = await request(app)
      .get('/health/live')
      .set('Accept', 'application/x-custom-unsupported-format');

    expect(res.status).toBe(406);
    expect(res.body.error).toHaveProperty('code', 'NOT_ACCEPTABLE');
  });
});

