// High-Entropy Secret and API Key Detector

const { BaseDetector } = require('./baseDetector');

class SecretDetector extends BaseDetector {
  constructor() {
    super({
      category: 'SECRET',
      severity: 'CRITICAL',
      defaultAction: 'BLOCK',
      replacementPrefix: 'SECRET',
      description: 'High-risk API key, private key, or access token detected'
    });

    this.secretSignatures = [
      // 1. AWS Access Key ID
      {
        id: 'AWS_ACCESS_KEY_ID',
        regex: /\b(AKIA[0-9A-Z]{16})\b/g,
        description: 'AWS Access Key ID token'
      },
      // 2. GitHub Personal Access Token (Classic, OAuth, Fine-grained)
      {
        id: 'GITHUB_TOKEN',
        regex: /\b(gh[pousr]_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{82})\b/g,
        description: 'GitHub Personal Access Token'
      },
      // 3. OpenAI API Keys (Standard & Project-scoped)
      {
        id: 'OPENAI_API_KEY',
        regex: /\b(sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_-]{48,})\b/g,
        description: 'OpenAI API Secret Key'
      },
      // 4. Anthropic API Keys
      {
        id: 'ANTHROPIC_API_KEY',
        regex: /\b(sk-ant-[a-zA-Z0-9_-]{32,})\b/g,
        description: 'Anthropic Claude API Key'
      },
      // 5. Slack Bot / User Tokens
      {
        id: 'SLACK_TOKEN',
        regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/g,
        description: 'Slack API Token'
      },
      // 6. Private Key Headers
      {
        id: 'PRIVATE_KEY_PEM',
        regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----[^-]*-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/gs,
        description: 'Asymmetric Private Key PEM block'
      },
      // 7. Signed JWT Token (Bearer token header format)
      {
        id: 'JWT_TOKEN',
        regex: /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
        description: 'Signed JSON Web Token (JWT)'
      },
      // 8. AegisAI Service Account Key
      {
        id: 'AEGIS_SERVICE_ACCOUNT_KEY',
        regex: /\b(aegis_sa_[a-zA-Z0-9]{8,16}_[a-zA-Z0-9]{32,64})\b/g,
        description: 'AegisAI Internal Service Account Credential'
      }
    ];
  }

  detect(text, context = {}) {
    if (!text || typeof text !== 'string') return [];

    const matches = [];
    const seenSpans = new Set();

    for (const signature of this.secretSignatures) {
      const regex = new RegExp(signature.regex.source, signature.regex.flags || 'g');
      let match;

      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0];
        const startIndex = match.index;
        const endIndex = startIndex + matchedText.length;

        const spanKey = `${startIndex}-${endIndex}`;
        if (seenSpans.has(spanKey)) {
          continue;
        }
        seenSpans.add(spanKey);

        matches.push({
          category: this.category,
          severity: this.severity,
          defaultAction: this.defaultAction, // BLOCK
          startIndex,
          endIndex,
          matchedText,
          replacementPrefix: this.replacementPrefix,
          confidence: 'HIGH',
          description: signature.description
        });
      }
    }

    return matches;
  }

  getLimitations() {
    return {
      category: this.category,
      method: 'Signature and structure matching for recognized cloud provider tokens, VCS access keys, and cryptographic key blocks.',
      limitations: [
        'Recognizes explicitly modeled token structures (AWS, GitHub, OpenAI, Anthropic, Slack, PEM, JWT, Aegis SA).',
        'Custom or obscure proprietary secret formats without identifiable prefixes require custom pattern rules or credential assignment detection.',
        'Does not perform online token revocation verification with external identity providers.'
      ]
    };
  }
}

module.exports = { SecretDetector };
