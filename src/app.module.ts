import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocalStoreModule } from './modules/local-store/local-store.module';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/global-exeption';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LocalStoreModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
