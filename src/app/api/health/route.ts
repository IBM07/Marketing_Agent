import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Check DB connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: 'ok',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      db: 'connected'
    }, { status: 200 });
  } catch (error) {
    logger.error('Health check failed', error);
    
    return NextResponse.json({
      status: 'error',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      db: 'error'
    }, { status: 503 });
  }
}
