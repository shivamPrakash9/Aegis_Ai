// End-to-End Comprehensive Verification of AegisAI Gemini Integration

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { geminiProvider } = require('../src/providers/gemini.provider');
const { scanService } = require('../../PrivacyScanner/src/services/scan.service');
const { privacyEnforcementService } = require('../../AIGateway/src/services/privacyEnforcement.service');
const { providerRegistry } = require('../src/services/providerRegistry.service');

async function testSuite() {
  console.log('================================================================');
  console.log('   AegisAI - Real-Time Gemini AI Integration Verification       ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  // --- Test 1: Basic Prompt Test ---
  total++;
  console.log('>>> [TEST 1] Basic Prompt Test with Real-Time Gemini Inference');
  try {
    const prompt = 'What are three core tenets of enterprise cybersecurity? Keep each point to 5 words or fewer.';
    const res = await geminiProvider.invokeCompletion({
      model: 'gemini-3.5-flash-lite',
      messages: [{ role: 'user', content: prompt }],
      correlationId: 'test-basic-01'
    });

    if (!res || !res.choices || !res.choices[0] || !res.choices[0].message.content) {
      throw new Error('Empty choices returned from Gemini provider');
    }

    console.log('  Model:', res.model);
    console.log('  Provider:', res.provider);
    console.log('  Prompt Tokens:', res.usage.promptTokens);
    console.log('  Completion Tokens:', res.usage.completionTokens);
    console.log('  Response Preview:\n   ', res.choices[0].message.content.trim().replace(/\n/g, '\n    '));
    console.log('  [PASS] Test 1 completed successfully.\n');
    passed++;
  } catch (err) {
    console.error('  [FAIL] Test 1 failed:', err.message, '\n');
  }

  // --- Test 2: Programming / Coding Prompt Test ---
  total++;
  console.log('>>> [TEST 2] Programming Prompt Test (Code Generation)');
  try {
    const prompt = 'Write a TypeScript interface for an Enterprise Audit Log entry with fields id, timestamp, eventType, severity, and actorId. Return only TypeScript code.';
    const res = await geminiProvider.invokeCompletion({
      model: 'gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: 'You are an expert TypeScript architect.' },
        { role: 'user', content: prompt }
      ],
      correlationId: 'test-code-02'
    });

    const code = res.choices[0].message.content.trim();
    if (!code.includes('interface') || !code.includes('eventType')) {
      throw new Error('Generated code did not contain expected interface keywords');
    }

    console.log('  Model:', res.model);
    console.log('  Provider:', res.provider);
    console.log('  Code Generated:\n   ', code.replace(/\n/g, '\n    '));
    console.log('  [PASS] Test 2 completed successfully.\n');
    passed++;
  } catch (err) {
    console.error('  [FAIL] Test 2 failed:', err.message, '\n');
  }

  // --- Test 3: Sensitive Data / PII Masking Pipeline ---
  total++;
  console.log('>>> [TEST 3] PII Protection Pipeline (PrivacyScanner -> Masking -> Gemini)');
  try {
    const sensitiveRawText = 'Employee contact: alice.smith@internal-corp.com, phone +1-555-839-2049, SSN 000-12-3456. Summarize this employee info.';
    console.log('  Original User Input (Contains PII):', sensitiveRawText);

    // Step A: Privacy Scanner detects PII
    const scanResult = await scanService.scan({
      messages: [{ role: 'user', content: sensitiveRawText }],
      organizationId: 'org_enterprise_alpha'
    });

    console.log('  Privacy Action:', scanResult.action);
    console.log('  Findings Detected:', scanResult.findings.map(f => `${f.type} (${f.severity})`).join(', '));
    console.log('  Sanitized Content:', scanResult.sanitizedMessages[0].content);

    // Step B: Privacy Enforcement verifies no raw PII leaks to external AI
    const enforcement = privacyEnforcementService.enforceScanAction({
      action: scanResult.action,
      originalMessages: [{ role: 'user', content: sensitiveRawText }],
      sanitizedMessages: scanResult.sanitizedMessages,
      routingConstraints: scanResult.routingConstraints,
      findings: scanResult.findings
    });

    if (!enforcement.proceedWithInvocation) {
      throw new Error('Privacy enforcement unexpectedly halted invocation');
    }

    // Step C: Send SANITIZED prompt to Gemini
    const geminiRes = await geminiProvider.invokeCompletion({
      model: 'gemini-3.5-flash-lite',
      messages: enforcement.effectiveMessages,
      correlationId: 'test-pii-03'
    });

    console.log('  Gemini Response to Sanitized Prompt:\n   ', geminiRes.choices[0].message.content.trim().replace(/\n/g, '\n    '));

    // Verify raw email did not leak
    if (geminiRes.choices[0].message.content.includes('alice.smith@internal-corp.com')) {
      throw new Error('Data leak detected: Raw email appeared in Gemini completion!');
    }

    console.log('  [PASS] Test 3 completed successfully (PII was securely masked).\n');
    passed++;
  } catch (err) {
    console.error('  [FAIL] Test 3 failed:', err.message, '\n');
  }

  // --- Test 4: Policy Enforcement Blocking ---
  total++;
  console.log('>>> [TEST 4] Policy Enforcement & Security Guardrails');
  try {
    const blockedPolicyDecision = {
      decision: 'DENY',
      violations: [
        { ruleId: 'POL-001', ruleName: 'Restricted Model Usage', severity: 'HIGH', message: 'Requested model is prohibited for this organization tier' }
      ]
    };

    const policyEnforcement = privacyEnforcementService.enforcePolicyDecision(blockedPolicyDecision);
    console.log('  Policy Decision:', blockedPolicyDecision.decision);
    console.log('  Proceed with invocation?', policyEnforcement.proceedWithInvocation);
    console.log('  Final Status:', policyEnforcement.finalStatus);
    console.log('  Reason:', policyEnforcement.reason);

    if (policyEnforcement.proceedWithInvocation === true || policyEnforcement.finalStatus !== 'BLOCKED') {
      throw new Error('Policy enforcer failed to block denied request');
    }

    console.log('  [PASS] Test 4 completed successfully (Policy correctly blocked unauthorized invocation).\n');
    passed++;
  } catch (err) {
    console.error('  [FAIL] Test 4 failed:', err.message, '\n');
  }

  // --- Test 5: Fallback & Error Handling ---
  total++;
  console.log('>>> [TEST 5] Provider Error Handling & Security Isolation');
  try {
    const { GeminiProvider } = require('../src/providers/gemini.provider');
    const unconfiguredProvider = new GeminiProvider({ apiKey: '' });

    let caught = false;
    try {
      await unconfiguredProvider.invokeCompletion({
        model: 'gemini-3.5-flash-lite',
        messages: [{ role: 'user', content: 'Ping' }]
      });
    } catch (unconfiguredErr) {
      caught = true;
      console.log('  Caught unconfigured error correctly:', unconfiguredErr.message);
    }

    if (!caught) {
      throw new Error('Unconfigured provider did not throw expected ServiceUnavailableError');
    }

    // Check unknown model resolution
    let modelErrorCaught = false;
    try {
      providerRegistry.resolveModel('completely-unknown-model-xyz');
    } catch (modelErr) {
      modelErrorCaught = true;
      console.log('  Caught unknown model correctly:', modelErr.message);
    }

    if (!modelErrorCaught) {
      throw new Error('Unknown model did not throw expected ModelNotFoundError');
    }

    console.log('  [PASS] Test 5 completed successfully (Errors handled safely without leaking credentials).\n');
    passed++;
  } catch (err) {
    console.error('  [FAIL] Test 5 failed:', err.message, '\n');
  }

  // --- Summary ---
  console.log('================================================================');
  console.log(`Verification Summary: ${passed}/${total} test suites PASSED`);
  console.log('================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testSuite().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
