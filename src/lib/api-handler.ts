import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { logger } from './logger';
import { ZodError } from 'zod';

export function apiHandler(handler: (req: Request, context: unknown) => Promise<NextResponse | void>) {
  return async (req: Request, context: unknown) => {
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

      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  };
}
