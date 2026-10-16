import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'An unexpected internal error occurred.';

  // CastError for invalid ObjectId (e.g. invalid Job ID)
  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Resource not found.';
  } else if (
    message.includes('prohibited') ||
    message.includes('protocol') ||
    message.includes('Invalid') ||
    message.includes('Malformed')
  ) {
    statusCode = 400;
  }

  // Never expose sensitive internal traces or credentials
  const responsePayload = {
    success: false,
    error: {
      message,
      code: err.code || (statusCode === 400 ? 'VALIDATION_ERROR' : statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
    },
  };

  if (env.NODE_ENV === 'development' && statusCode === 500) {
    responsePayload.error.stack = err.stack;
  }

  console.error(`[Error] ${req.method} ${req.path} -> ${statusCode}: ${message}`);
  res.status(statusCode).json(responsePayload);
}
