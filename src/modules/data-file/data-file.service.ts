import { Injectable } from '@nestjs/common';
import { MyLogger } from '../../common/custom-logger';

@Injectable()
export class DataFileService {
  private MyLogger = new MyLogger(DataFileService.name);
  constructor() {}
}
