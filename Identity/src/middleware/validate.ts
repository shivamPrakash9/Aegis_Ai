// Request Validation Middleware using AJV

import { NextFunction, Request, Response } from 'express';
import { AnySchema } from 'ajv';
import { ajv } from '../schemas';

export function validate(schema: AnySchema, source: 'body' | 'query' | 'params' = 'body') {
  const validateFn = ajv.compile(schema);

  return (req: Request, res: Response, next: NextFunction) => {
    const data = req[source];
    const valid = validateFn(data);

    if (!valid) {
      const details = validateFn.errors?.map((err) => ({
        field: err.instancePath || err.params?.missingProperty || 'root',
        message: err.message
      }));

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request payload failed validation.',
          correlationId: (req as any).correlationId || 'unknown',
          details
        }
      });
    }

    next();
  };
}
