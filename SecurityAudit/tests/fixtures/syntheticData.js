// Synthetic Test Data and Token Generators for Security & Audit Testing

const jwt = require('jsonwebtoken');
const { env } = require('../../src/config/env');

const TEST_SECRET = env.jwtSecret;

function generateTestJwt({
  id = 'user_dev_alpha',
  organizationId = 'org_enterprise_alpha',
  role = 'MEMBER',
  permissions = []
} = {}) {
  return jwt.sign(
    {
      sub: id,
      type: 'USER',
      organizationId,
      role,
      permissions
    },
    TEST_SECRET,
    {
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      expiresIn: '1h'
    }
  );
}

const tokenTenantA = generateTestJwt({
  id: 'user_tenant_a',
  organizationId: 'org_enterprise_alpha',
  role: 'MEMBER'
});

const tokenTenantB = generateTestJwt({
  id: 'user_tenant_b',
  organizationId: 'org_enterprise_beta',
  role: 'MEMBER'
});

const tokenAdmin = generateTestJwt({
  id: 'user_admin',
  organizationId: 'org_enterprise_alpha',
  role: 'ADMIN'
});

const tokenAuditor = generateTestJwt({
  id: 'user_auditor',
  organizationId: 'org_enterprise_alpha',
  role: 'SECURITY_AUDITOR'
});

module.exports = {
  generateTestJwt,
  tokenTenantA,
  tokenTenantB,
  tokenAdmin,
  tokenAuditor
};
