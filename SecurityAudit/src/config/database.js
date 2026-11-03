// MongoDB Database Connection Manager

const { MongoClient } = require('mongodb');
const { env } = require('./env');
const { logger } = require('../utils/logger');

class DatabaseConnection {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Connects to the configured MongoDB database.
   */
  async connect() {
    if (this.isConnected) {
      return this.db;
    }

    if (this.isConnecting) {
      // Avoid parallel connection attempts
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.db;
    }

    this.isConnecting = true;

    try {
      this.client = new MongoClient(env.mongodbUri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        maxPoolSize: 20
      });

      await this.client.connect();
      this.db = this.client.db(env.mongodbDatabase);
      this.isConnected = true;
      this.isConnecting = false;

      logger.info(
        { database: env.mongodbDatabase },
        'Connected to MongoDB for Security & Audit Service'
      );

      return this.db;
    } catch (err) {
      this.isConnected = false;
      this.isConnecting = false;
      logger.warn(
        { err: err.message, database: env.mongodbDatabase },
        'MongoDB connection attempt failed (operating in fallback mode)'
      );
      return null;
    }
  }

  /**
   * Health check probe for MongoDB connectivity.
   */
  async checkHealth() {
    if (!this.isConnected || !this.client) {
      return {
        status: 'DISCONNECTED',
        database: env.mongodbDatabase,
        latencyMs: null
      };
    }

    const start = Date.now();
    try {
      await this.db.command({ ping: 1 });
      const latencyMs = Date.now() - start;
      return {
        status: 'CONNECTED',
        database: env.mongodbDatabase,
        latencyMs
      };
    } catch (err) {
      this.isConnected = false;
      return {
        status: 'DISCONNECTED',
        database: env.mongodbDatabase,
        error: err.message
      };
    }
  }

  /**
   * Retrieves the MongoDB database instance.
   */
  getDb() {
    return this.db;
  }

  /**
   * Retrieves the audit events collection.
   */
  getEventsCollection() {
    if (!this.db) return null;
    return this.db.collection('audit_events');
  }

  /**
   * Graceful disconnection on shutdown.
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
        this.isConnected = false;
        this.db = null;
        logger.info('MongoDB connection closed cleanly');
      } catch (err) {
        logger.error({ err: err.message }, 'Error closing MongoDB connection');
      }
    }
  }
}

const database = new DatabaseConnection();

module.exports = {
  database,
  getDb: () => database.getDb(),
  getEventsCollection: () => database.getEventsCollection(),
  checkDatabaseHealth: () => database.checkHealth()
};
