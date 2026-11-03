// Express Application Setup for Security & Audit Microservice

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
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
const routes = require('./routes');
const { NotFoundError } = require('./utils/errors');

const app = express();

// Security Headers & Cross-Origin
app.use(helmet());
app.use(cors());

// Request Body Limits
app.use(express.json({ limit: env.maxRequestBodyBytes }));
app.use(express.urlencoded({ extended: true, limit: env.maxRequestBodyBytes }));

// Request Tracing and Logging
app.use(requestLogger);

// Content Negotiation: JSON and XML (Requirement 7)
app.use(contentNegotiationMiddleware);

// Deliberate Cache-Control on GET (Requirement 10)
app.use(cacheControl('private-no-store'));

// ETag and HTTP 304 Not Modified Support (Requirement 6)
app.use(etagCacheMiddleware);

// OpenAPI Documentation Swagger UI
try {
  const openApiPath = path.join(__dirname, '../openapi/security-audit.yaml');
  if (fs.existsSync(openApiPath)) {
    const file = fs.readFileSync(openApiPath, 'utf8');
    const swaggerDoc = yaml.parse(file);
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    app.get('/openapi.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.json(swaggerDoc);
    });
  }
} catch {
  // Swagger loading error is non-fatal
}

// API Routes
app.use('/', routes);

// 404 Handler
app.use((req, res, next) => {
  next(new NotFoundError(`Resource not found: ${req.method} ${req.originalUrl}`));
});

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;
