import { ConsoleLogger } from '@nestjs/common';

export class MyLogger extends ConsoleLogger {
  log(message: string, ...optionalParams: [...any]) {
    super.log('📢 ' + message, optionalParams);
  }

  warn(message: string, ...optionalParams: [...any]) {
    super.warn('📢 ' + message, optionalParams);
  }
  debug(message: string, ...optionalParams: [...any]) {
    super.debug('📢 ' + message, optionalParams);
  }

  error(message: string, ...optionalParams: [...any]) {
    super.error('📢 ' + message, optionalParams);
  }
}
