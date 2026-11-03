// Audit Event Repository with MongoDB Persistence and In-Memory Hermetic Fallback

const { getEventsCollection, database } = require('../config/database');
const { logger } = require('../utils/logger');

class AuditEventRepository {
  constructor() {
    this._inMemoryEvents = [];
    this._indexesInitialized = false;
  }

  /**
   * Initializes collection indexes in MongoDB.
   */
  async initIndexes() {
    if (this._indexesInitialized) return;

    const collection = getEventsCollection();
    if (!collection) return;

    try {
      await collection.createIndex({ eventId: 1 }, { unique: true });
      await collection.createIndex({ organizationId: 1, ingestedAt: -1 });
      await collection.createIndex({ organizationId: 1, traceId: 1 });
      await collection.createIndex({ organizationId: 1, requestId: 1 });
      await collection.createIndex({ organizationId: 1, eventType: 1 });
      await collection.createIndex(
        { organizationId: 1, sourceEventId: 1 },
        { sparse: true }
      );

      this._indexesInitialized = true;
      logger.info('MongoDB indexes verified for audit_events collection');
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to initialize MongoDB indexes (will retry)');
    }
  }

  /**
   * Appends an audit event (append-only).
   *
   * @param {object} event
   * @returns {Promise<{ persisted: boolean, isDuplicate: boolean, event: object }>}
   */
  async save(event) {
    const collection = getEventsCollection();

    // Check for existing duplicate by eventId or sourceEventId in same organization
    const existing = await this.findDuplicate(event);
    if (existing) {
      return {
        persisted: false,
        isDuplicate: true,
        event: existing
      };
    }

    if (collection) {
      try {
        await this.initIndexes();
        const docToInsert = { ...event };
        await collection.insertOne(docToInsert);
        return {
          persisted: true,
          isDuplicate: false,
          event: this._formatDoc(docToInsert)
        };
      } catch (err) {
        // Handle MongoDB duplicate key error code 11000
        if (err.code === 11000) {
          const duplicate = await this.findDuplicate(event);
          return {
            persisted: false,
            isDuplicate: true,
            event: duplicate || event
          };
        }
        logger.error({ err: err.message }, 'MongoDB insert failed, storing in resilient fallback store');
      }
    }

    // In-memory fallback
    const fallbackCopy = { ...event };
    this._inMemoryEvents.push(fallbackCopy);
    return {
      persisted: true,
      isDuplicate: false,
      event: this._formatDoc(fallbackCopy)
    };
  }

  /**
   * Detects duplicate event submission.
   */
  async findDuplicate(event) {
    const { eventId, organizationId, sourceEventId } = event;

    const collection = getEventsCollection();
    if (collection) {
      try {
        const query = { organizationId };
        const conditions = [];
        if (eventId) conditions.push({ eventId });
        if (sourceEventId) conditions.push({ sourceEventId });

        if (conditions.length > 0) {
          query.$or = conditions;
          const found = await collection.findOne(query);
          if (found) return this._formatDoc(found);
        }
      } catch {
        // Fall through to in-memory check
      }
    }

    return this._inMemoryEvents.find(
      (e) =>
        e.organizationId === organizationId &&
        ((eventId && e.eventId === eventId) || (sourceEventId && e.sourceEventId === sourceEventId))
    ) || null;
  }

  /**
   * Finds a single audit event by ID and organization context.
   *
   * @param {string} eventId
   * @param {string} organizationId
   * @returns {Promise<object | null>}
   */
  async findByEventId(eventId, organizationId) {
    const collection = getEventsCollection();
    if (collection) {
      try {
        const doc = await collection.findOne({ eventId, organizationId });
        if (doc) return this._formatDoc(doc);
      } catch (err) {
        logger.warn({ err: err.message }, 'MongoDB query failed, falling back to in-memory');
      }
    }

    const found = this._inMemoryEvents.find(
      (e) => e.eventId === eventId && e.organizationId === organizationId
    );
    return found ? this._formatDoc(found) : null;
  }

  /**
   * Retrieves all events associated with a traceId in chronological order.
   *
   * @param {string} traceId
   * @param {string} organizationId
   * @returns {Promise<Array<object>>}
   */
  async findEventsByTraceId(traceId, organizationId) {
    const collection = getEventsCollection();
    if (collection) {
      try {
        const docs = await collection
          .find({ traceId, organizationId })
          .sort({ ingestedAt: 1, occurredAt: 1 })
          .toArray();
        return docs.map((doc) => this._formatDoc(doc));
      } catch (err) {
        logger.warn({ err: err.message }, 'MongoDB trace lookup failed, falling back to in-memory');
      }
    }

    const matches = this._inMemoryEvents
      .filter((e) => e.traceId === traceId && e.organizationId === organizationId)
      .sort((a, b) => new Date(a.ingestedAt || a.occurredAt) - new Date(b.ingestedAt || b.occurredAt));

    return matches.map((m) => this._formatDoc(m));
  }

  /**
   * Retrieves all events associated with a requestId.
   *
   * @param {string} requestId
   * @param {string} organizationId
   * @returns {Promise<Array<object>>}
   */
  async findEventsByRequestId(requestId, organizationId) {
    const collection = getEventsCollection();
    if (collection) {
      try {
        const docs = await collection
          .find({ requestId, organizationId })
          .sort({ ingestedAt: 1 })
          .toArray();
        return docs.map((doc) => this._formatDoc(doc));
      } catch (err) {
        logger.warn({ err: err.message }, 'MongoDB request events query failed, falling back to in-memory');
      }
    }

    const matches = this._inMemoryEvents
      .filter((e) => e.requestId === requestId && e.organizationId === organizationId)
      .sort((a, b) => new Date(a.ingestedAt) - new Date(b.ingestedAt));

    return matches.map((m) => this._formatDoc(m));
  }

  /**
   * Multi-criteria search for audit events with pagination and tenant isolation.
   *
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} [params.eventType]
   * @param {string} [params.severity]
   * @param {string} [params.outcome]
   * @param {string} [params.sourceService]
   * @param {string} [params.requestId]
   * @param {string} [params.traceId]
   * @param {string} [params.startTime]
   * @param {string} [params.endTime]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @returns {Promise<{ items: Array<object>, total: number, page: number, limit: number, totalPages: number }>}
   */
  async findEvents({
    organizationId,
    callerId,
    eventType,
    severity,
    outcome,
    sourceService,
    requestId,
    traceId,
    startTime,
    endTime,
    page = 1,
    limit = 20
  }) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (safePage - 1) * safeLimit;

    const collection = getEventsCollection();
    if (collection) {
      try {
        const filter = { organizationId };

        if (callerId) {
          filter.$or = [{ callerId }, { callerId: null }, { callerId: { $exists: false } }];
        }
        if (eventType) filter.eventType = eventType;
        if (severity) filter.severity = severity;
        if (outcome) filter.outcome = outcome;
        if (sourceService) filter.sourceService = sourceService;
        if (requestId) filter.requestId = requestId;
        if (traceId) filter.traceId = traceId;

        if (startTime || endTime) {
          filter.ingestedAt = {};
          if (startTime) filter.ingestedAt.$gte = new Date(startTime).toISOString();
          if (endTime) filter.ingestedAt.$lte = new Date(endTime).toISOString();
        }

        const total = await collection.countDocuments(filter);
        const docs = await collection
          .find(filter)
          .sort({ ingestedAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .toArray();

        return {
          items: docs.map((d) => this._formatDoc(d)),
          total,
          page: safePage,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit) || 1
        };
      } catch (err) {
        logger.warn({ err: err.message }, 'MongoDB filtered query failed, falling back to in-memory');
      }
    }

    // In-memory filtered search
    let matches = this._inMemoryEvents.filter((e) => e.organizationId === organizationId);

    if (callerId) matches = matches.filter((e) => !e.callerId || e.callerId === callerId);
    if (eventType) matches = matches.filter((e) => e.eventType === eventType);
    if (severity) matches = matches.filter((e) => e.severity === severity);
    if (outcome) matches = matches.filter((e) => e.outcome === outcome);
    if (sourceService) matches = matches.filter((e) => e.sourceService === sourceService);
    if (requestId) matches = matches.filter((e) => e.requestId === requestId);
    if (traceId) matches = matches.filter((e) => e.traceId === traceId);

    if (startTime) {
      const startMs = new Date(startTime).getTime();
      matches = matches.filter((e) => new Date(e.ingestedAt || e.occurredAt).getTime() >= startMs);
    }
    if (endTime) {
      const endMs = new Date(endTime).getTime();
      matches = matches.filter((e) => new Date(e.ingestedAt || e.occurredAt).getTime() <= endMs);
    }

    matches.sort((a, b) => new Date(b.ingestedAt || b.occurredAt) - new Date(a.ingestedAt || a.occurredAt));

    const total = matches.length;
    const paginated = matches.slice(skip, skip + safeLimit);

    return {
      items: paginated.map((m) => this._formatDoc(m)),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1
    };
  }

  /**
   * Formats database document for external presentation (removes raw _id).
   */
  _formatDoc(doc) {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest;
  }

  /**
   * Resets in-memory storage for test isolation.
   */
  clearInMemory() {
    this._inMemoryEvents = [];
  }
}

const auditEventRepository = new AuditEventRepository();

module.exports = {
  AuditEventRepository,
  auditEventRepository
};
