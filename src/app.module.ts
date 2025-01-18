import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataFileModule } from './modules/data-file/data-file.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DataFileModule,
  ],
})
export class AppModule {}
