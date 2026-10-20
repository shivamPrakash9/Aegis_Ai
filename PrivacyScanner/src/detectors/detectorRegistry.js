// Modular Detector Registry for Privacy Scanner

const { EmailDetector } = require('./email.detector');
const { PhoneDetector } = require('./phone.detector');
const { PanDetector } = require('./pan.detector');
const { AadhaarDetector } = require('./aadhaar.detector');
const { SecretDetector } = require('./secret.detector');
const { CredentialAssignmentDetector } = require('./credentialAssignment.detector');
const { IpAddressDetector } = require('./ipAddress.detector');
const { CustomPatternDetector } = require('./customPattern.detector');

class DetectorRegistry {
  constructor() {
    this.detectors = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.register(new EmailDetector());
    this.register(new PhoneDetector());
    this.register(new PanDetector());
    this.register(new AadhaarDetector());
    this.register(new SecretDetector());
    this.register(new CredentialAssignmentDetector());
    this.register(new IpAddressDetector());
    this.register(new CustomPatternDetector());
  }

  /**
   * Registers a new detector.
   * @param {import('./baseDetector').BaseDetector} detector
   */
  register(detector) {
    if (!detector || !detector.category) {
      throw new Error('Detector must define a valid category.');
    }
    this.detectors.set(detector.category.toUpperCase(), detector);
  }

  /**
   * Retrieves a detector by its category.
   * @param {string} category
   * @returns {import('./baseDetector').BaseDetector | undefined}
   */
  get(category) {
    return this.detectors.get(category.toUpperCase());
  }

  /**
   * Returns all registered detectors.
   * @returns {Array<import('./baseDetector').BaseDetector>}
   */
  getAll() {
    return Array.from(this.detectors.values());
  }

  /**
   * Returns a list of supported category names.
   * @returns {string[]}
   */
  getSupportedCategories() {
    return Array.from(this.detectors.keys());
  }

  /**
   * Compiles limitations across all registered detectors.
   * @returns {Array<{ category: string, method: string, limitations: string[] }>}
   */
  getLimitations() {
    return this.getAll().map((detector) => detector.getLimitations());
  }
}

const defaultRegistry = new DetectorRegistry();

module.exports = {
  DetectorRegistry,
  detectorRegistry: defaultRegistry
};
