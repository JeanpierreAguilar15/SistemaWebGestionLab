import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestContext } from '../../admin/admin-events.service';

/**
 * Decorator to extract IP address and User-Agent from the request
 * Used for audit logging
 *
 * Usage:
 * @Post()
 * async create(@RequestContext() ctx: RequestContext) { ... }
 */
export const RequestCtx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext => {
    const request = context.switchToHttp().getRequest();

    // Extract IP address (handles proxies via x-forwarded-for)
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = forwardedFor
      ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim())
      : request.ip || request.connection?.remoteAddress || null;

    // Extract User-Agent
    const userAgent = request.headers['user-agent'] || null;

    return {
      ipAddress,
      userAgent,
    };
  },
);
