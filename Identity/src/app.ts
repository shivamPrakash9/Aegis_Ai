// Express Application Configuration

import cors from 'cors';
import express, { Request, Response } from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { config } from './config/env';
import { errorHandler, NotFoundError } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { mainRouter } from './routes';

export const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-Id'],
    credentials: true
  })
);

// Payload size limit to prevent abuse
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Correlation ID & request logger
app.use(requestLogger);

// OpenAPI Documentation Route
try {
  const openapiPath = path.resolve(__dirname, '../openapi/identity-service.yaml');
  if (fs.existsSync(openapiPath)) {
    const fileContent = fs.readFileSync(openapiPath, 'utf8');
    const swaggerDoc = YAML.parse(fileContent);

    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    app.get('/openapi.json', (_req: Request, res: Response) => {
      res.json(swaggerDoc);
    });
  }
} catch {
  // If docs cannot be loaded at runtime, log and continue
}

// Mount all application routes
app.use(mainRouter);

// 404 Not Found Handler
app.use((req: Request, _res: Response, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found.`));
});

// Global Error Handler
app.use(errorHandler);
