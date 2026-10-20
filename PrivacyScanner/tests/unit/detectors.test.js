// Unit Tests: Modular PII & Secret Detectors

const { EmailDetector } = require('../../src/detectors/email.detector');
const { PhoneDetector } = require('../../src/detectors/phone.detector');
const { PanDetector } = require('../../src/detectors/pan.detector');
const { AadhaarDetector } = require('../../src/detectors/aadhaar.detector');
const { SecretDetector } = require('../../src/detectors/secret.detector');
const { CredentialAssignmentDetector } = require('../../src/detectors/credentialAssignment.detector');
const { IpAddressDetector } = require('../../src/detectors/ipAddress.detector');
const { CustomPatternDetector } = require('../../src/detectors/customPattern.detector');
const { syntheticSamples } = require('../fixtures/syntheticData');

describe('Privacy Detectors Unit Tests', () => {
  describe('EmailDetector', () => {
    let detector;
    beforeEach(() => {
      detector = new EmailDetector();
    });

    it('should detect standard email address', () => {
      const text = `Contact user at ${syntheticSamples.emails.standard} for assistance.`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(1);
      expect(matches[0].category).toBe('EMAIL');
      expect(matches[0].matchedText).toBe(syntheticSamples.emails.standard);
      expect(matches[0].severity).toBe('MEDIUM');
    });

    it('should detect plus-addressing with subdomains and mixed case', () => {
      const text = `Send to ${syntheticSamples.emails.plusTagged} or ${syntheticSamples.emails.mixedCase}`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(2);
      expect(matches[0].matchedText).toBe(syntheticSamples.emails.plusTagged);
      expect(matches[1].matchedText).toBe(syntheticSamples.emails.mixedCase);
    });

    it('should extract email embedded inside punctuation without trailing dot or parens', () => {
      const text = syntheticSamples.emails.withPunctuation; // "Contact us (support@example.com)."
      const matches = detector.detect(text);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchedText).toBe('support@example.com');
    });

    it('should NOT match invalid lookalikes', () => {
      const invalidText = 'User alice@ and @example.com and alice @ example.com are invalid.';
      const matches = detector.detect(invalidText);
      expect(matches).toHaveLength(0);
    });

    it('should provide transparent limitations metadata', () => {
      const limitations = detector.getLimitations();
      expect(limitations.category).toBe('EMAIL');
      expect(limitations.limitations.length).toBeGreaterThan(0);
    });
  });

  describe('PhoneDetector', () => {
    let detector;
    beforeEach(() => {
      detector = new PhoneDetector();
    });

    it('should detect international phone number with + prefix', () => {
      const text = `Call support at ${syntheticSamples.phones.intlPlus}.`;
      const matches = detector.detect(text);

      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].category).toBe('PHONE');
    });

    it('should detect US/NANP phone numbers with dashes and parens', () => {
      const text = `Office: ${syntheticSamples.phones.usNanp}, cell: ${syntheticSamples.phones.usDashed}`;
      const matches = detector.detect(text);

      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect Indian mobile numbers with +91 or dashed separators', () => {
      const text = `Mobile is ${syntheticSamples.phones.indiaMobile}`;
      const matches = detector.detect(text);

      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].category).toBe('PHONE');
    });

    it('should NOT match dates or software versions as phone numbers', () => {
      const text = `Released on ${syntheticSamples.phones.dateNotPhone} version ${syntheticSamples.phones.versionNotPhone}`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(0);
    });
  });

  describe('PanDetector', () => {
    let detector;
    beforeEach(() => {
      detector = new PanDetector();
    });

    it('should detect valid Indian PAN format identifier', () => {
      const text = `Tax ID is ${syntheticSamples.pan.individual} and company PAN is ${syntheticSamples.pan.company}`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(2);
      expect(matches[0].category).toBe('PAN');
      expect(matches[0].matchedText).toBe(syntheticSamples.pan.individual);
      expect(matches[0].severity).toBe('HIGH');
    });

    it('should reject PAN embedded inside longer alphanumeric string', () => {
      const text = `Identifier ${syntheticSamples.pan.embeddedInWord} is not a standalone PAN`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(0);
    });
  });

  describe('AadhaarDetector', () => {
    let detector;
    beforeEach(() => {
      detector = new AadhaarDetector();
    });

    it('should detect spaced 12-digit Aadhaar number with valid Verhoeff checksum', () => {
      const text = `UID: ${syntheticSamples.aadhaar.spacedValid}`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(1);
      expect(matches[0].category).toBe('AADHAAR');
      expect(matches[0].matchedText).toBe(syntheticSamples.aadhaar.spacedValid);
      expect(matches[0].confidence).toBe('HIGH');
    });

    it('should reject repetitive synthetic invalid sequences or short numbers', () => {
      const text = `Testing ${syntheticSamples.aadhaar.repeatedInvalid} and ${syntheticSamples.aadhaar.tooShort}`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(0);
    });
  });

  describe('SecretDetector', () => {
    let detector;
    beforeEach(() => {
      detector = new SecretDetector();
    });

    it('should detect AWS Access Key ID and trigger CRITICAL severity BLOCK action', () => {
      const text = `Use AWS key ${syntheticSamples.secrets.awsAccessKey} in deployment`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(1);
      expect(matches[0].category).toBe('SECRET');
      expect(matches[0].severity).toBe('CRITICAL');
      expect(matches[0].defaultAction).toBe('BLOCK');
    });

    it('should detect GitHub Personal Access Tokens and OpenAI Secret Keys', () => {
      const text = `GitHub token: ${syntheticSamples.secrets.githubPat}, OpenAI: ${syntheticSamples.secrets.openAiKey}`;
      const matches = detector.detect(text);

      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches.every((m) => m.defaultAction === 'BLOCK')).toBe(true);
    });

    it('should detect private key PEM block', () => {
      const text = `Key file:\n${syntheticSamples.secrets.privateKeyPem}\n`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(1);
      expect(matches[0].category).toBe('SECRET');
    });
  });

  describe('CredentialAssignmentDetector', () => {
    let detector;
    beforeEach(() => {
      detector = new CredentialAssignmentDetector();
    });

    it('should detect password= assignments and target the sensitive value for redaction', () => {
      const text = `Connect with ${syntheticSamples.credentialAssignments.passwordAssign} immediately`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(1);
      expect(matches[0].category).toBe('CREDENTIAL_ASSIGNMENT');
      expect(matches[0].matchedText).toBe('MySecretPassword123!');
      expect(matches[0].defaultAction).toBe('BLOCK');
    });

    it('should detect quoted passwords and client_secret assignments', () => {
      const text = `Config: ${syntheticSamples.credentialAssignments.passwordQuoted} and ${syntheticSamples.credentialAssignments.clientSecretAssign}`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(2);
      expect(matches[0].matchedText).toBe('SuperSecurePass!');
    });

    it('should ignore common placeholder strings like "your_password"', () => {
      const text = `Example config: ${syntheticSamples.credentialAssignments.placeholderIgnored}`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(0);
    });
  });

  describe('IpAddressDetector', () => {
    let detector;
    beforeEach(() => {
      detector = new IpAddressDetector();
    });

    it('should detect valid IPv4 addresses', () => {
      const text = `Servers at ${syntheticSamples.ipAddresses.validPublic} and ${syntheticSamples.ipAddresses.validPrivate}`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(2);
      expect(matches[0].category).toBe('IP_ADDRESS');
      expect(matches[0].matchedText).toBe(syntheticSamples.ipAddresses.validPublic);
    });

    it('should ignore invalid octets (>255) and software version prefixes', () => {
      const text = `Bad IP ${syntheticSamples.ipAddresses.invalidOctet} and version ${syntheticSamples.ipAddresses.versionPrefixed}`;
      const matches = detector.detect(text);

      expect(matches).toHaveLength(0);
    });
  });

  describe('CustomPatternDetector', () => {
    let detector;
    beforeEach(() => {
      detector = new CustomPatternDetector();
    });

    it('should detect organization-configured keywords and patterns', () => {
      const customPatterns = [
        {
          id: 'rule-1',
          name: 'Project Codename',
          category: 'CONFIDENTIAL_PROJECT',
          pattern: '\\bProject\\s+Titan\\b',
          severity: 'HIGH',
          action: 'REQUIRE_APPROVAL',
          replacement: 'PROJECT_CODENAME'
        }
      ];

      const text = 'All updates on Project Titan must be kept internal.';
      const matches = detector.detect(text, { customPatterns });

      expect(matches).toHaveLength(1);
      expect(matches[0].category).toBe('CONFIDENTIAL_PROJECT');
      expect(matches[0].defaultAction).toBe('REQUIRE_APPROVAL');
      expect(matches[0].replacementPrefix).toBe('PROJECT_CODENAME');
    });
  });
});
