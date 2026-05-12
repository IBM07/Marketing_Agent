export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(401, message, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', code: string = 'NOT_FOUND') {
    super(404, message, code);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too Many Requests', code: string = 'RATE_LIMIT_EXCEEDED') {
    super(429, message, code);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation Error', code: string = 'VALIDATION_ERROR') {
    super(400, message, code);
  }
}
