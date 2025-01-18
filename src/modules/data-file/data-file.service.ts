import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MyLogger } from '../../common/custom-logger';
import { DataFileRepo } from './repository/repository';

@Injectable()
export class DataFileService {
  private logger = new MyLogger(DataFileService.name);

  constructor(private readonly dataFileRepo: DataFileRepo) {}


  public async createCollection(tableName: string): Promise<void> {
    this.logger.log(`Creating table/collection: ${tableName}`);
    try {
      await this.dataFileRepo.createCollection(tableName);
    } catch (error) {
      this.logger.error(`createTable error: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }


  public async deleteTable(tableName: string): Promise<void> {
    this.logger.log(`Deleting table/collection: ${tableName}`);
    try {
      await this.dataFileRepo.deleteCollection(tableName);
    } catch (error) {
      this.logger.error(`deleteTable error: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  public async insertRecord(
    tableName: string,
    record: any,
    isBinary: boolean,
  ): Promise<string> {
    this.logger.log(
      `Inserting record into "${tableName}" (binary=${isBinary})`,
    );
    try {
      return await this.dataFileRepo.insertRecord(tableName, record, isBinary);
    } catch (error) {
      this.logger.error(`insertRecord error: ${error.message}`);
      if (error.message.includes('Expected a Buffer for binary record')) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  public async getRecord(
    tableName: string,
    recordId: string,
  ): Promise<any | Buffer | null> {
    this.logger.log(`Retrieving record "${recordId}" from "${tableName}"`);
    try {
      const record = await this.dataFileRepo.getRecord(tableName, recordId);

      if (record === null) {
        throw new NotFoundException(
          `Record "${recordId}" not found in table "${tableName}"`,
        );
      }

      return record;
    } catch (error) {
      this.logger.error(`getRecord error: ${error.message}`);
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  public async getRecords(
    tableName: string,
    limit?: number,
    skip?: number,
  ): Promise<Array<any | Buffer>> {
    this.logger.log(
      `Retrieving records from "${tableName}" (limit=${limit}, skip=${skip})`,
    );
    try {
      return await this.dataFileRepo.getRecords(tableName, limit, skip);
    } catch (error) {
      this.logger.error(`getRecords error: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  public async updateRecord(
    tableName: string,
    recordId: string,
    newData: any,
    isBinary: boolean,
  ): Promise<void> {
    this.logger.log(
      `Updating record "${recordId}" in "${tableName}" (binary=${isBinary})`,
    );
    try {
      await this.dataFileRepo.updateRecord(
        tableName,
        recordId,
        newData,
        isBinary,
      );
    } catch (error) {
      this.logger.error(`updateRecord error: ${error.message}`);
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      if (error.message.includes('Expected a Buffer for binary record')) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(error.message);
    }
  }


  public async deleteRecord(
    tableName: string,
    recordId: string,
  ): Promise<void> {
    this.logger.log(`Deleting record "${recordId}" from "${tableName}"`);
    try {
      await this.dataFileRepo.deleteRecord(tableName, recordId);
    } catch (error) {
      this.logger.error(`deleteRecord error: ${error.message}`);
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw new InternalServerErrorException(error.message);
    }
  }
}
