import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DiscordWebhookService } from '../webhook/discord-webhook.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly webhookService: DiscordWebhookService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as any)?.message || 'Internal Server Error';

    // If it's an internal server error (500+), notify Discord system alerts
    if (status >= 500) {
      this.logger.error(
        `Unhandled Exception on ${request.method} ${request.url}: ${
          (exception as any)?.message || exception
        }`,
        (exception as any)?.stack,
      );

      this.webhookService
        .notifySystemAlert({
          title: `API Error ${status}: ${request.method} ${request.url}`,
          message: `ตรวจพบข้อผิดพลาดรุนแรงระดับ 5xx ที่ส่งผลต่อการทำงานของระบบ`,
          severity: 'WARN',
          alertKey: `api_500_${request.method}_${request.url}`,
          cooldownMinutes: 5,
          metadata: {
            path: request.url,
            method: request.method,
            status,
            error:
              typeof message === 'object'
                ? JSON.stringify(message)
                : String(message),
          },
        })
        .catch(() => {});
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        typeof message === 'object' && (message as any)?.message
          ? (message as any).message
          : message,
    });
  }
}
