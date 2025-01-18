import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      enableDebugMessages: true,
      skipUndefinedProperties: false,
      skipNullProperties: true,
      skipMissingProperties: false,
      forbidNonWhitelisted: false,
    }),
  );

  await app.listen(app.get(ConfigService).get('HTTP_PORT')).then(() => {
    console.log(app.get(ConfigService).get('HTTP_PORT'));
  });
}
bootstrap();
