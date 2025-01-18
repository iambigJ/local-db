import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Mutex } from 'async-mutex';
import { ConfigService } from '@nestjs/config';
import { MyLogger } from '../../../common/custom-logger';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface IndexRecord {
  id: string;
  isBinary: boolean;
}

@Injectable()
export class LocalStore {
  private logger: MyLogger = new MyLogger(LocalStore.name);
  private mutexes: Map<string, Mutex>;
  private baseDir: string;
  private storageType: string;
  private indexCache: Map<string, IndexRecord[]>;

  constructor(private configService: ConfigService) {
    this.baseDir = this.configService.get<string>('STORAGE_PATH') || 'storage';
    if (!this.baseDir) {
      this.logger.warn(`STORAGE_PATH not configured, using default "storage"`);
      this.baseDir = 'storage';
    } else if (typeof this.baseDir !== 'string') {
      this.logger.error(`Invalid STORAGE_PATH value: "${this.baseDir}"`);
      throw new Error(`Invalid STORAGE_PATH configuration.`);
    }
    this.storageType =
      this.configService.get<string>('SDD_STORE_TYPE') || 'json';
    this.mutexes = new Map();
    this.indexCache = new Map();

    this.logger.log(
      `DataFileRepo initialized with baseDir="${this.baseDir}", storageType="${this.storageType}"`,
    );
  }

  private getFileExtension(): string {
    return this.storageType === 'yaml' ? 'yaml' : 'json';
  }

  private getCollectionPath(collectionName: string): string {
    return path.join(this.baseDir, collectionName);
  }

  public async createCollection(collectionName: string): Promise<void> {
    this.logger.log(`Creating collection: ${collectionName}`);
    const collectionPath = this.getCollectionPath(collectionName);
    await this.ensureDirExists(collectionPath);
    await this.updateIndex(collectionName, []);
    this.logger.log(`Collection "${collectionName}" created successfully.`);
  }

  public async deleteCollection(collectionName: string): Promise<void> {
    this.logger.log(`Deleting collection: ${collectionName}`);
    const collectionPath = this.getCollectionPath(collectionName);
    const mutex = await this.getMutex(collectionName);
    await mutex.runExclusive(async () => {
      try {
        await fs.rm(collectionPath, { recursive: true, force: true });
        this.mutexes.delete(collectionName);
        this.indexCache.delete(collectionName);
        this.logger.log(`Collection "${collectionName}" deleted successfully.`);
      } catch (err) {
        this.logger.error(
          `Error deleting collection "${collectionName}": ${err.message}`,
        );
        throw err;
      }
    });
  }

  public async insertRecord(
    collectionName: string,
    record: any,
    isBinary: boolean,
  ): Promise<string> {
    this.logger.log(
      `Inserting record (binary=${isBinary}) into collection: ${collectionName}`,
    );
    const mutex = await this.getMutex(collectionName);

    return mutex.runExclusive(async () => {
      const index = await this.getIndex(collectionName);

      const recordId = randomUUID();
      await this.writeRecord(collectionName, recordId, record, isBinary);

      index.push({ id: recordId, isBinary });
      await this.updateIndex(collectionName, index);

      this.logger.log(
        `Record "${recordId}" inserted successfully into "${collectionName}" (binary=${isBinary}).`,
      );
      return recordId;
    });
  }

  public async getRecord(
    collectionName: string,
    recordId: string,
  ): Promise<any | Buffer | null> {
    this.logger.log(`Fetching record "${recordId}" from "${collectionName}"`);
    const index = await this.getIndex(collectionName);
    const entry = index.find((item) => item.id === recordId);
    if (!entry) {
      this.logger.warn(
        `Record "${recordId}" not found in index for collection "${collectionName}".`,
      );
      return null;
    }
    return this.readRecord(collectionName, recordId, entry.isBinary);
  }

  public async getRecords(
    collectionName: string,
    limit?: number,
    skip?: number,
  ): Promise<Array<any | Buffer>> {
    this.logger.log(
      `Fetching records from "${collectionName}" (limit=${limit}, skip=${skip})`,
    );

    const index = await this.getIndex(collectionName);
    const start = skip || 0;
    const end = limit ? start + limit : index.length;

    const records: Array<any | Buffer> = [];
    for (let i = start; i < Math.min(index.length, end); i++) {
      const { id, isBinary } = index[i];
      const record = await this.readRecord(collectionName, id, isBinary);
      if (!record) {
        this.logger.warn(
          `Record "${id}" was in index but not found on disk in "${collectionName}".`,
        );
      }
      records.push(record);
    }

    this.logger.log(
      `Retrieved ${records.length} record(s) from "${collectionName}".`,
    );
    return records;
  }

  public async updateRecord(
    collectionName: string,
    recordId: string,
    newData: any,
    isBinary: boolean,
  ): Promise<void> {
    this.logger.log(
      `Updating record "${recordId}" in "${collectionName}" (binary=${isBinary})`,
    );
    const mutex = await this.getMutex(collectionName);

    await mutex.runExclusive(async () => {
      const index = await this.getIndex(collectionName);
      const entry = index.find((item) => item.id === recordId);
      if (!entry) {
        this.logger.error(
          `Record "${recordId}" not found in index for "${collectionName}".`,
        );
        throw new Error(
          `Record "${recordId}" not found in collection "${collectionName}"`,
        );
      }
      const data = await this.getRecord(collectionName, recordId);
      Object.assign(data, newData);
      await this.writeRecord(collectionName, recordId, data, isBinary);
      if (entry.isBinary !== isBinary) {
        entry.isBinary = isBinary;
        await this.updateIndex(collectionName, index);
      }

      this.logger.log(
        `Record "${recordId}" updated successfully in "${collectionName}".`,
      );
    });
  }

  public async deleteRecord(
    collectionName: string,
    recordId: string,
  ): Promise<void> {
    this.logger.log(`Deleting record "${recordId}" from "${collectionName}"`);
    const mutex = await this.getMutex(collectionName);

    await mutex.runExclusive(async () => {
      const index = await this.getIndex(collectionName);
      console.log(index);
      const entry = index.find((item) => item.id === recordId);
      if (!entry) {
        this.logger.error(
          `Record "${recordId}" not found in index for "${collectionName}".`,
        );
        throw new Error(
          `Record "${recordId}" not found in collection "${collectionName}"`,
        );
      }
      const updatedIndex = index.filter((item) => item.id !== recordId);

      const filePath = this.getRecordFilePath(
        collectionName,
        recordId,
        entry.isBinary,
      );
      await fs.unlink(filePath).catch((err) => {
        if (err.code !== 'ENOENT') {
          this.logger.error(
            `Error deleting file for record "${recordId}": ${err.message}`,
          );
          throw err;
        }
      });

      await this.updateIndex(collectionName, updatedIndex);
      this.logger.log(`Record "${recordId}" deleted successfully.`);
    });
  }

  private async ensureDirExists(dirPath: string): Promise<any> {
    try {
      await fs.mkdir(dirPath);
    } catch (err) {
      this.logger.error(
        `Error creating directory "${dirPath}": ${err.message}`,
      );
      throw err;
    }
  }

  private getIndexFilePath(collectionName: string): string {
    return path.join(
      this.getCollectionPath(collectionName),
      `index.${this.getFileExtension()}`,
    );
  }

  private getRecordFilePath(
    collectionName: string,
    recordId: string,
    isBinary: boolean,
  ): string {
    if (isBinary) {
      return path.join(
        this.getCollectionPath(collectionName),
        `${recordId}.bin`,
      );
    }
    return path.join(
      this.getCollectionPath(collectionName),
      `${recordId}.${this.getFileExtension()}`,
    );
  }

  private async writeRecord(
    collectionName: string,
    recordId: string,
    data: any,
    isBinary: boolean,
  ): Promise<void> {
    const filePath = this.getRecordFilePath(collectionName, recordId, isBinary);

    if (isBinary) {
      if (!Buffer.isBuffer(data)) {
        throw new Error(
          `Expected a Buffer for binary record "${recordId}" in "${collectionName}".`,
        );
      }
      await this.writeBinaryFile(filePath, data);
    } else {
      if (Buffer.isBuffer(data)) {
        throw new Error(
          `Expected an object for text record "${recordId}" in "${collectionName}", but got a Buffer.`,
        );
      }
      await this.writeTextFile(filePath, data);
    }
  }

  private async readRecord(
    collectionName: string,
    recordId: string,
    isBinary: boolean,
  ): Promise<any | Buffer | null> {
    const filePath = this.getRecordFilePath(collectionName, recordId, isBinary);

    try {
      if (isBinary) {
        return await fs.readFile(filePath);
      } else {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return this.storageType === 'yaml'
          ? yaml.load(fileContent)
          : JSON.parse(fileContent);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null;
      }
      this.logger.error(
        `Error reading file "${filePath}" in collection "${collectionName}": ${err.message}`,
      );
      throw err;
    }
  }

  private async writeTextFile(filePath: string, data: any): Promise<void> {
    try {
      const fileContent =
        this.storageType === 'yaml'
          ? yaml.dump(data)
          : JSON.stringify(data, null, 2);

      await fs.writeFile(filePath, fileContent, 'utf-8');
    } catch (err) {
      this.logger.error(
        `Error writing text file "${filePath}": ${err.message}`,
      );
      throw err;
    }
  }

  private async writeBinaryFile(filePath: string, data: Buffer): Promise<void> {
    try {
      await fs.writeFile(filePath, data);
    } catch (err) {
      this.logger.error(
        `Error writing binary file "${filePath}": ${err.message}`,
      );
      throw err;
    }
  }

  private async getMutex(collectionName: string): Promise<Mutex> {
    if (!this.mutexes.has(collectionName)) {
      this.logger.log(
        `Creating a new mutex for collection "${collectionName}"`,
      );
      this.mutexes.set(collectionName, new Mutex());
    }
    return this.mutexes.get(collectionName)!;
  }

  private async getIndex(collectionName: string): Promise<IndexRecord[]> {
    if (this.indexCache.has(collectionName)) {
      return this.indexCache.get(collectionName)!;
    }
    this.logger.log(`Loading index from disk for "${collectionName}"`);
    const indexPath = this.getIndexFilePath(collectionName);

    let indexData: IndexRecord[] = [];
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      if (this.storageType === 'yaml') {
        indexData = (yaml.load(content) as IndexRecord[]) || [];
      } else {
        indexData = JSON.parse(content) || [];
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.logger.error(
          `Error reading index for "${collectionName}": ${err.message}`,
        );
        throw err;
      }
      indexData = [];
    }

    this.indexCache.set(collectionName, indexData);
    return indexData;
  }

  private async updateIndex(
    collectionName: string,
    newIndex: IndexRecord[],
  ): Promise<void> {
    this.logger.log(
      `Updating index for "${collectionName}" with ${newIndex.length} record(s)`,
    );
    this.indexCache.set(collectionName, newIndex);
    const indexPath = this.getIndexFilePath(collectionName);
    let indexContent: string;
    try {
      indexContent =
        this.storageType === 'yaml'
          ? yaml.dump(newIndex)
          : JSON.stringify(newIndex, null, 2);
    } catch (err) {
      this.logger.error(
        `Error serializing index for "${collectionName}": ${err.message}`,
      );
      this.indexCache.delete(collectionName);
      throw new Error(
        `Failed to serialize index for "${collectionName}": ${err.message}`,
      );
    }
    try {
      await fs.writeFile(indexPath, indexContent, 'utf-8');
    } catch (err) {
      this.logger.error(
        `Error writing index file "${indexPath}": ${err.message}`,
      );
      this.indexCache.delete(collectionName);
      this.logger.error('error while updating index', err?.stack);
      throw err;
    }
  }
}
