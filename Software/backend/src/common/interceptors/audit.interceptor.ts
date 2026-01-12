import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const url = request.url;
    const body = request.body;
    const requestId = uuidv4();

    // Skip GET requests for audit logging unless specifically marked
    if (method === 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (data) => {
        try {
          if (user) {
            await this.prisma.logActividad.create({
              data: {
                codigo_usuario: user.codigo_usuario,
                accion: `${method} ${url}`,
                entidad: this.getEntityFromUrl(url),
                descripcion: JSON.stringify({
                  body: this.sanitizeBody(body),
                  response: this.sanitizeBody(data),
                }),
                ip_address: request.ip,
                user_agent: request.headers['user-agent'],
                // request_id: requestId, // Comentado temporalmente hasta que se actualice el cliente de Prisma
                fecha_accion: new Date(),
              },
            });
          }
        } catch (error) {
          this.logger.error(`Failed to log audit for request ${requestId}`, error.stack);
        }
      }),
    );
  }

  private getEntityFromUrl(url: string): string {
    const parts = url.split('/');
    // Assuming standard REST URL structure /api/v1/entity/...
    // Adjust index based on your actual API prefix
    return parts.length > 1 ? parts[1] : 'unknown';
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'creditCard', 'cvv'];
    
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    });

    return sanitized;
  }
}