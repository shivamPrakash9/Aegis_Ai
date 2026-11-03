// Synthetic Test Fixtures (Strictly Non-Production Synthetic Data)

const jwt = require('jsonwebtoken');
const { env } = require('../../src/config/env');

const testOrgId = 'org_enterprise_alpha';
const testOrgIdBeta = 'org_enterprise_beta';

function generateTestToken({
  sub = 'user_admin_123',
  organizationId = testOrgId,
  role = 'ORGANIZATION_ADMIN',
  permissions = ['privacy:scan', 'privacy:config']
} = {}) {
  return jwt.sign(
    {
      sub,
      organizationId,
      role,
      permissions
    },
    env.privacyJwtSecret,
    {
      issuer: env.privacyJwtIssuer,
      audience: env.privacyJwtAudience,
      expiresIn: '1h'
    }
  );
}

const syntheticSamples = {
  // Email fixtures
  emails: {
    standard: 'alice.smith@example.com',
    plusTagged: 'alice.smith+alerts@sub.corp-example.co.uk',
    mixedCase: 'Bob.Jones@Domain-Example.COM',
    multiple: 'Send copy to carol@test.org and dave@company.net please.',
    invalidNoDomain: 'alice@',
    invalidNoUser: '@example.com',
    invalidSpaces: 'alice @ example.com',
    withPunctuation: 'Contact us (support@example.com).'
  },

  // Phone fixtures
  phones: {
    usNanp: '(555) 019-2834',
    usDashed: '555-0199',
    intlPlus: '+1 555-019-2834',
    indiaMobile: '+91 98765 43210',
    indiaMobileDashed: '98765-43210',
    dateNotPhone: '2026-10-19',
    versionNotPhone: '1.2.3.4'
  },

  // PAN fixtures
  pan: {
    individual: 'ABCDE1234F',
    company: 'XYZCP5678K',
    lowerCaseNotPan: 'abcde1234f', // PAN is uppercase
    embeddedInWord: 'PREFIXABCDE1234FSUFFIX'
  },

  // Aadhaar fixtures (with valid Verhoeff checksum)
  aadhaar: {
    spacedValid: '2345 6789 0120', // Verhoeff valid synthetic Aadhaar
    continuousValid: '234567890120',
    repeatedInvalid: '999999999999',
    tooShort: '1234 5678'
  },

  // Secrets fixtures
  secrets: {
    awsAccessKey: 'AKIAIOSFODNN7EXAMPLE',
    githubPat: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    openAiKey: 'sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
    anthropicKey: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789',
    slackToken: 'xyz',
    privateKeyPem: '-----BEGIN PRIVATE KEY-----\nMIGEAgEAMBAGByqGSM49AgEGBSuBBAAKBG0wawIBAQQgExampleKeyContentOnly\n-----END PRIVATE KEY-----'
  },

  // Credential assignment fixtures
  credentialAssignments: {
    passwordAssign: 'password=MySecretPassword123!',
    passwordQuoted: 'password="SuperSecurePass!"',
    apiKeyAssign: 'api_key=ak_live_testkey987654321',
    clientSecretAssign: 'client_secret=cs_secret_alpha_bravo',
    placeholderIgnored: 'password=your_password'
  },

  // IP Address fixtures
  ipAddresses: {
    validPublic: '198.51.100.42',
    validPrivate: '192.168.1.1',
    invalidOctet: '999.1.2.3',
    versionPrefixed: 'v1.2.3.4'
  }
};

module.exports = {
  testOrgId,
  testOrgIdBeta,
  generateTestToken,
  syntheticSamples
};
