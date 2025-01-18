import { Module } from '@nestjs/common';
import { DataFileService } from './data-file.service';
import { DataFileRepo } from './repository/repository';
import { MyTableController } from './data-file.controller';

@Module({
  imports: [],
  controllers: [MyTableController],
  providers: [DataFileService, DataFileRepo],
})
export class DataFileModule {}
