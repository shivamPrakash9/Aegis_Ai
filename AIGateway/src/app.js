// Express Application Definition for AegisAI AI Gateway
// Conforms to Web Services Assignment Requirements

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const swaggerUi = require('swagger-ui-express');

const { env } = require('./config/env');
const { requestLogger } = require('./middleware/requestLogger');
const { errorHandler } = require('./middleware/errorHandler');
const { contentNegotiationMiddleware } = require('./middleware/contentNegotiation');
const { etagCacheMiddleware } = require('./middleware/etagCache');
const { cacheControl } = require('./middleware/cacheControl');
const { rootRouter } = require('./routes');
const { NotFoundError } = require('./utils/errors');
const { logger } = require('./utils/logger');

const app = express();

// Security Headers with Helmet
app.use(helmet({ contentSecurityPolicy: false }));

// Deliberate CORS Policy (Requirement 17)
app.use(
  cors({
    origin: env.corsOrigins === '*' ? true : env.corsOrigins.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Correlation-Id',
      'X-API-Key',
      'Accept',
      'If-None-Match'
    ],
    exposedHeaders: [
      'X-Correlation-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
      'ETag'
    ],
    credentials: true
  })
);

// Payload size limit
app.use(express.json({ limit: env.maxRequestBodyBytes }));
app.use(express.urlencoded({ extended: true, limit: env.maxRequestBodyBytes }));

// Request logging & correlation tracking (Requirement 25, 26)
app.use(requestLogger);

// Content Negotiation: JSON and XML (Requirement 7)
app.use(contentNegotiationMiddleware);

// Deliberate Cache-Control on GET (Requirement 10)
app.use(cacheControl('private-no-store'));

// ETag and HTTP 304 Not Modified Support (Requirement 6)
app.use(etagCacheMiddleware);

// Serve OpenAPI 3.1 Documentation via Swagger UI at /api-docs and /docs (Requirement 13 & 14)
try {
  const openApiPath = path.join(__dirname, '../openapi/ai-gateway.yaml');
  if (fs.existsSync(openApiPath)) {
    const fileContent = fs.readFileSync(openApiPath, 'utf8');
    const swaggerDoc = yaml.parse(fileContent);
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    app.get('/docs.yaml', (_req, res) => {
      res.setHeader('Content-Type', 'text/yaml');
      res.send(fileContent);
    });
    app.get('/openapi.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.json(swaggerDoc);
    });
  }
} catch (err) {
  logger.warn({ err: err.message }, 'Could not initialize Swagger UI documentation endpoint');
}

// Mount Root Router (/health, /v1/health, /v1/ai-requests, /graphql, /v1/graphql)
app.use(rootRouter);

// 404 Route Handler
app.use((req, res, next) => {
  next(new NotFoundError(`Endpoint '${req.method} ${req.originalUrl}' not found.`));
});

// Centralized Error Handler (Requirement 9, 20)
app.use(errorHandler);

module.exports = { app };
