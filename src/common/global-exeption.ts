import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message =
        exception instanceof HttpException
          ? exception.getResponse()
          : 'Unexpected error occurred';

      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        message: message,
      });
    } else {
      const status = 500;
      return response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        message: 'internal server Error',
      });
    }
  }
}
