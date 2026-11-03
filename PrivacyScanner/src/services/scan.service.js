// Privacy Scan Orchestration Service

const { detectorRegistry } = require('../detectors/detectorRegistry');
const { maskingService } = require('./masking.service');
const { decisionService } = require('./decision.service');
const { scannerConfigRepository } = require('../repositories/scannerConfig.repository');
const { scanMetadataRepository } = require('../repositories/scanMetadata.repository');
const { generateScanId } = require('../utils/correlationId');
const { BadRequestError, PayloadTooLargeError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');

class ScanService {
  constructor({
    registry = detectorRegistry,
    masker = maskingService,
    decider = decisionService,
    configRepo = scannerConfigRepository,
    metadataRepo = scanMetadataRepository
  } = {}) {
    this.registry = registry;
    this.masker = masker;
    this.decider = decider;
    this.configRepo = configRepo;
    this.metadataRepo = metadataRepo;
  }

  /**
   * Normalizes inbound payload into standard messages array.
   * Supports Gateway format `{ messages, organizationId }`
   * and extended format `{ requestId, content: { messages }, organizationId, mode }`.
   *
   * @param {object} payload
   * @returns {{
   *   messages: Array<{ role: string, content: string }>,
   *   organizationId: string,
   *   requestId?: string,
   *   mode: string
   * }}
   */
  normalizeInput(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestError('Scan payload must be a valid JSON object.');
    }

    let messages = [];
    if (Array.isArray(payload.messages)) {
      messages = payload.messages;
    } else if (payload.content && Array.isArray(payload.content.messages)) {
      messages = payload.content.messages;
    } else if (typeof payload.text === 'string') {
      messages = [{ role: 'user', content: payload.text }];
    } else {
      throw new BadRequestError(
        'Scan request must include a non-empty array of messages under either "messages" or "content.messages".'
      );
    }

    if (messages.length === 0) {
      throw new BadRequestError('Messages array must contain at least one message.');
    }

    if (messages.length > env.maxScanItems) {
      throw new PayloadTooLargeError(
        `Message count (${messages.length}) exceeds maximum permitted scan items of ${env.maxScanItems}.`
      );
    }

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (!m || typeof m !== 'object') {
        throw new BadRequestError(`Message at index ${i} must be an object with role and content.`);
      }
      if (!m.role || typeof m.role !== 'string') {
        throw new BadRequestError(`Message at index ${i} is missing a valid string 'role'.`);
      }
      if (typeof m.content !== 'string') {
        throw new BadRequestError(`Message at index ${i} is missing a valid string 'content'.`);
      }
      if (m.content.length > env.maxContentLength) {
        throw new PayloadTooLargeError(
          `Message at index ${i} content length (${m.content.length}) exceeds limit of ${env.maxContentLength} characters.`
        );
      }
    }

    const organizationId = payload.organizationId;
    if (!organizationId || typeof organizationId !== 'string') {
      throw new BadRequestError('Scan request must specify a valid organizationId.');
    }

    return {
      messages,
      organizationId,
      requestId: payload.requestId || null,
      mode: payload.mode || env.defaultMode || 'MASK'
    };
  }

  /**
   * Executes privacy scan pipeline.
   *
   * @param {object} rawPayload
   * @param {object} [options]
   * @param {string} [options.correlationId]
   * @returns {Promise<object>} Dual-compatible scan response
   */
  async scan(rawPayload, { correlationId = 'unknown' } = {}) {
    const startTime = Date.now();
    const scanId = generateScanId();

    // 1. Input normalization and validation
    const { messages, organizationId, requestId, mode } = this.normalizeInput(rawPayload);

    // 2. Retrieve organization scanner configuration and custom patterns
    const config = await this.configRepo.getConfig(organizationId);
    const customPatterns = await this.configRepo.getCustomPatterns(organizationId);

    const enabledCategories = new Set(
      (config.enabledCategories || []).map((c) => c.toUpperCase())
    );

    // 3. Run applicable detectors across messages
    const matchesByMessageIndex = new Map();
    const detectedCategorySet = new Set();
    const allDetectors = this.registry.getAll();

    for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
      const msgContent = messages[msgIdx].content;
      const messageMatches = [];

      for (const detector of allDetectors) {
        const catUpper = detector.category.toUpperCase();

        // Check if category is enabled in organization configuration
        if (catUpper !== 'CUSTOM' && !enabledCategories.has(catUpper)) {
          continue;
        }

        const detectorMatches = detector.detect(msgContent, {
          organizationId,
          messageIndex: msgIdx,
          customPatterns
        });

        for (const m of detectorMatches) {
          messageMatches.push(m);
          detectedCategorySet.add(m.category);
        }
      }

      matchesByMessageIndex.set(msgIdx, messageMatches);
    }

    // 4. Apply deterministic masking (without mutating original input)
    let sanitizedMessages = messages;
    let findings = [];
    let maskingSucceeded = true;

    try {
      const maskResult = this.masker.maskMessages(messages, matchesByMessageIndex);
      sanitizedMessages = maskResult.sanitizedMessages;
      findings = maskResult.findings;
    } catch (maskErr) {
      logger.error(
        { correlationId, scanId, err: maskErr.message },
        'Masking transformation failed; failing closed'
      );
      maskingSucceeded = false;
    }

    // 5. Evaluate decision precedence
    const decisionResult = this.decider.evaluateDecision({
      findings,
      mode,
      maskingSucceeded,
      scannerConfig: config
    });

    const durationMs = Date.now() - startTime;

    // 6. Persist non-sensitive scan metadata telemetry
    const detectedCategoriesArray = Array.from(detectedCategorySet);
    await this.metadataRepo.saveMetadata({
      scanId,
      organizationId,
      requestId,
      ruleSetVersion: config.ruleSetVersion || env.rulesetVersion,
      detectedCategories: detectedCategoriesArray,
      findingsCount: findings.length,
      decision: decisionResult.decision,
      processingDurationMs: durationMs
    });

    logger.info(
      {
        correlationId,
        scanId,
        organizationId,
        decision: decisionResult.decision,
        findingsCount: findings.length,
        detectedCategories: detectedCategoriesArray,
        durationMs
      },
      'Privacy scan completed'
    );

    // 7. Format dual-compatible response (Gateway expects action + sanitizedMessages)
    // If BLOCK, sanitized messages are suppressed for maximum security
    const effectiveSanitized = decisionResult.action === 'BLOCK' ? [] : sanitizedMessages;

    return {
      scanId,
      requestId: requestId || scanId,
      status: 'COMPLETED',
      action: decisionResult.action,       // Required by AI Gateway client
      decision: decisionResult.decision,   // Proposed standard
      findings,
      sanitizedMessages: effectiveSanitized, // Required by AI Gateway client
      sanitizedContent: {                  // Proposed standard
        messages: effectiveSanitized
      },
      routingConstraints: decisionResult.routingConstraints || {},
      ruleSetVersion: config.ruleSetVersion || env.rulesetVersion,
      durationMs
    };
  }
}

module.exports = {
  ScanService,
  scanService: new ScanService()
};
