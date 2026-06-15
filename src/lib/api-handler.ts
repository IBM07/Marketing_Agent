import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { logger } from './logger';
import { ZodError } from 'zod';

export function apiHandler<T extends Request>(handler: (req: T, context: unknown) => Promise<NextResponse | void>) {
  return async (req: T, context: unknown) => {
    try {
      return await handler(req, context);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }

      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', details: error.format(), code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }

      logger.error('[UNHANDLED]', error);

      // SECURITY: Never expose internal error details to the client.
      // The `error` object is logged server-side only. Do NOT add error.message
      // or stack traces to the JSON response — they leak implementation details.
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  };
}
