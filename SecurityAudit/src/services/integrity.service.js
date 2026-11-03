// Cryptographic Tamper-Evidence and Integrity Service

const crypto = require('crypto');

class IntegrityService {
  /**
   * Deterministically stringifies an object by sorting all object keys recursively.
   *
   * @param {*} value
   * @returns {string}
   */
  canonicalJson(value) {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalJson(item)).join(',')}]`;
    }

    const sortedKeys = Object.keys(value).sort();
    const keyPairs = sortedKeys.map(
      (key) => `${JSON.stringify(key)}:${this.canonicalJson(value[key])}`
    );
    return `{${keyPairs.join(',')}}`;
  }

  /**
   * Generates a canonical representation string for an audit event.
   * Excludes mutable transport metadata (like HTTP headers or database internal _id).
   *
   * Included fields:
   * 1. eventId
   * 2. eventVersion
   * 3. eventType
   * 4. occurredAt
   * 5. organizationId
   * 6. sourceService
   * 7. requestId
   * 8. traceId
   * 9. severity
   * 10. canonicalJson(details or metadata)
   *
   * @param {object} event
   * @returns {string}
   */
  generateCanonicalString(event) {
    const eventId = event.eventId || '';
    const eventVersion = event.eventVersion || 1;
    const eventType = event.eventType || '';
    const occurredAt = event.occurredAt || event.timestamp || '';
    const organizationId = event.organizationId || '';
    const sourceService = event.sourceService || '';
    const requestId = event.requestId || '';
    const traceId = event.traceId || '';
    const severity = event.severity || 'INFO';
    const metadata = event.details || event.metadata || {};

    const metadataCanonical = this.canonicalJson(metadata);

    return [
      eventId,
      eventVersion,
      eventType,
      occurredAt,
      organizationId,
      sourceService,
      requestId,
      traceId,
      severity,
      metadataCanonical
    ].join('|');
  }

  /**
   * Computes SHA-256 digest over the canonical event string.
   *
   * @param {object} event
   * @returns {{ digest: string, algorithm: string, canonicalString: string }}
   */
  calculateDigest(event) {
    const canonicalString = this.generateCanonicalString(event);
    const digest = crypto
      .createHash('sha256')
      .update(canonicalString, 'utf8')
      .digest('hex');

    return {
      digest,
      algorithm: 'sha256',
      canonicalString
    };
  }

  /**
   * Verifies the cryptographic integrity of a stored audit event.
   *
   * @param {object} event
   * @returns {{ valid: boolean, calculatedDigest: string, storedDigest: string | null }}
   */
  verifyIntegrity(event) {
    const storedDigest = event.integrity?.digest || null;
    if (!storedDigest) {
      return {
        valid: false,
        calculatedDigest: this.calculateDigest(event).digest,
        storedDigest: null,
        reason: 'Event does not contain stored integrity digest'
      };
    }

    const { digest: calculatedDigest } = this.calculateDigest(event);
    const valid = crypto.timingSafeEqual(
      Buffer.from(calculatedDigest, 'hex'),
      Buffer.from(storedDigest, 'hex')
    );

    return {
      valid,
      calculatedDigest,
      storedDigest,
      reason: valid ? 'Verified' : 'Tamper detected: digest mismatch'
    };
  }
}

const integrityService = new IntegrityService();

module.exports = {
  IntegrityService,
  integrityService
};
