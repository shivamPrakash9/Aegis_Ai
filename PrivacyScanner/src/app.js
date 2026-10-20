// Express Application Definition for AegisAI Privacy Scanner

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
const rootRouter = require('./routes');
const { NotFoundError } = require('./utils/errors');
const { logger } = require('./utils/logger');

const app = express();

// Security Headers with Helmet
app.use(helmet({ contentSecurityPolicy: false }));

// CORS Policy
app.use(
  cors({
    origin: env.corsOrigins === '*' ? true : env.corsOrigins.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Internal-Service-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Correlation-Id']
  })
);

// Payload size limit
app.use(express.json({ limit: env.maxRequestBodyBytes }));
app.use(express.urlencoded({ extended: true, limit: env.maxRequestBodyBytes }));

// Request logging & correlation tracking
app.use(requestLogger);

// Serve OpenAPI 3.1 Documentation via Swagger UI at /docs
try {
  const openApiPath = path.join(__dirname, '../openapi/privacy-scanner.yaml');
  if (fs.existsSync(openApiPath)) {
    const fileContent = fs.readFileSync(openApiPath, 'utf8');
    const swaggerDoc = yaml.parse(fileContent);
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    app.get('/docs.yaml', (_req, res) => {
      res.setHeader('Content-Type', 'text/yaml');
      res.send(fileContent);
    });
  }
} catch (err) {
  logger.warn({ err: err.message }, 'Could not initialize Swagger UI documentation endpoint');
}

// Mount Root Router (/health, /v1/scan, /v1/config)
app.use(rootRouter);

// 404 Route Handler
app.use((req, res, next) => {
  next(new NotFoundError(`Endpoint '${req.method} ${req.originalUrl}' not found.`));
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = { app };
