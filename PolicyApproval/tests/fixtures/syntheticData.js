// Synthetic Test Fixtures for Policy & Approval Microservice

const jwt = require('jsonwebtoken');
const { env } = require('../../src/config/env');

const testOrgId = 'org_enterprise_alpha';
const testOrgIdBeta = 'org_enterprise_beta';

function generateTestToken({
  sub = 'user_admin_123',
  organizationId = testOrgId,
  role = 'ORGANIZATION_ADMIN',
  permissions = ['policy:read', 'policy:write', 'approval:review']
} = {}) {
  return jwt.sign(
    {
      sub,
      organizationId,
      role,
      permissions
    },
    env.policyJwtSecret,
    {
      issuer: env.policyJwtIssuer,
      audience: env.policyJwtAudience,
      expiresIn: '1h'
    }
  );
}

const samplePolicies = {
  modelGovernance: {
    name: 'Enterprise Model Governance Policy',
    description: 'Enforces model whitelisting and human approval gates for high-cost models.',
    category: 'MODEL_GOVERNANCE',
    rules: [
      {
        id: 'rule-deny-unauthorized-models',
        name: 'Block Untrusted Models',
        effect: 'DENY',
        priority: 10,
        condition: {
          field: 'model',
          operator: 'in',
          value: ['untrusted-free-model', 'banned-model-v1']
        },
        reason: 'Requested model is not on enterprise approved whitelist.',
        reasonCode: 'POLICY_MODEL_NOT_APPROVED'
      },
      {
        id: 'rule-require-approval-gpt4',
        name: 'Require Approval for Frontier Models',
        effect: 'REQUIRE_APPROVAL',
        priority: 50,
        condition: {
          all: [
            { field: 'model', operator: 'eq', value: 'gpt-4o' },
            { field: 'callerRole', operator: 'neq', value: 'EXECUTIVE' }
          ]
        },
        reason: 'Usage of GPT-4o requires manager or security approval.',
        reasonCode: 'APPROVAL_REQUIRED_FRONTIER_MODEL',
        requiredApprovers: ['SECURITY_ADMIN', 'MANAGER']
      },
      {
        id: 'rule-deny-long-prompts',
        name: 'Deny Excessive Prompt Length',
        effect: 'DENY',
        priority: 20,
        condition: {
          field: 'totalPromptLength',
          operator: 'gt',
          value: 10000
        },
        reason: 'Prompt length exceeds max policy threshold of 10,000 characters.',
        reasonCode: 'POLICY_PROMPT_TOO_LONG'
      },
      {
        id: 'rule-allow-standard',
        name: 'Default Allow Standard Models',
        effect: 'ALLOW',
        priority: 100,
        condition: {
          field: 'model',
          operator: 'in',
          value: ['gpt-4o-mini', 'claude-3-5-sonnet', 'text-embedding-3-small']
        },
        reason: 'Model is cleared for general enterprise usage.'
      }
    ]
  },

  roleBasedAccess: {
    name: 'Role-Based AI Access Policy',
    description: 'Restricts AI capabilities based on principal role.',
    category: 'ACCESS_CONTROL',
    rules: [
      {
        id: 'rule-deny-interns-external-models',
        name: 'Deny Interns External Models',
        effect: 'DENY',
        priority: 15,
        condition: {
          all: [
            { field: 'callerRole', operator: 'eq', value: 'INTERN' },
            { field: 'provider', operator: 'neq', value: 'internal-hosted' }
          ]
        },
        reason: 'Interns are only permitted to query internal self-hosted models.',
        reasonCode: 'POLICY_ROLE_PROVIDER_RESTRICTION'
      }
    ]
  }
};

module.exports = {
  testOrgId,
  testOrgIdBeta,
  generateTestToken,
  samplePolicies
};
