// Standardized Error Classes for Privacy Scanner Microservice

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'The scan request is invalid.', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required to access scanner service.', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Caller is not authorized for this organization or scanner resource.', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'The requested scanner resource was not found.', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class PayloadTooLargeError extends AppError {
  constructor(message = 'Request body or content size exceeds configured limits.', details = null) {
    super(message, 413, 'PAYLOAD_TOO_LARGE', details);
  }
}

class UnprocessableEntityError extends AppError {
  constructor(message = 'Request content could not be processed.', details = null) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Too many scan requests. Rate limit exceeded.', details = null) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

class InternalServerError extends AppError {
  constructor(message = 'An unexpected internal error occurred within Privacy Scanner.', details = null) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Privacy Scanner dependency is currently unavailable.', details = null) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

class GatewayTimeoutError extends AppError {
  constructor(message = 'Privacy scan operation timed out.', details = null) {
    super(message, 504, 'GATEWAY_TIMEOUT', details);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  GatewayTimeoutError
};
