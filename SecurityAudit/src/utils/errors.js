// Standardized Error Hierarchy for Security & Audit Microservice

class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not Found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload Too Large', details = null) {
    super(message, 413, 'PAYLOAD_TOO_LARGE', details);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded. Please try again later.', details = null) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Unavailable', details = null) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

class BadGatewayError extends AppError {
  constructor(message = 'Bad Gateway', details = null) {
    super(message, 502, 'BAD_GATEWAY', details);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  RateLimitError,
  ServiceUnavailableError,
  BadGatewayError
};
