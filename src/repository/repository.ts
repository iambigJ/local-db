import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Mutex } from 'async-mutex';

const BASE_DIR = path.resolve(__dirname, 'data');
const STORE_TYPE = process.env.SDD_STORE_TYPE || 'json';

class Database {
  private baseDir: string;
  private mutexes: Map<string, Mutex>;
  private indexCache: Map<string, string[]>; // Cache for indices

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.mutexes = new Map();
    this.indexCache = new Map();
  }

  private getFileExtension(): string {
    return STORE_TYPE === 'yaml' ? 'yaml' : 'json';
  }

  private async ensureDirExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }

  private getCollectionPath(collectionName: string): string {
    return path.join(this.baseDir, collectionName);
  }

  private getIndexFilePath(collectionName: string): string {
    return path.join(
      this.getCollectionPath(collectionName),
      `index.${this.getFileExtension()}`,
    );
  }

  private getRecordFilePath(collectionName: string, recordId: string): string {
    return path.join(
      this.getCollectionPath(collectionName),
      `${recordId}.${this.getFileExtension()}`,
    );
  }

  private getBinaryFilePath(collectionName: string, recordId: string): string {
    return path.join(this.getCollectionPath(collectionName), `${recordId}.bin`);
  }

  private async readFile(filePath: string): Promise<any> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return STORE_TYPE === 'yaml'
        ? yaml.load(fileContent)
        : JSON.parse(fileContent);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  private async writeFile(filePath: string, data: any): Promise<void> {
    const fileContent =
      STORE_TYPE === 'yaml' ? yaml.dump(data) : JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, fileContent, 'utf-8');
  }

  private async writeBinaryFile(filePath: string, data: Buffer): Promise<void> {
    await fs.writeFile(filePath, data);
  }

  private async getMutex(collectionName: string): Promise<Mutex> {
    if (!this.mutexes.has(collectionName)) {
      this.mutexes.set(collectionName, new Mutex());
    }
    return this.mutexes.get(collectionName)!;
  }

  private async getIndex(collectionName: string): Promise<string[]> {
    if (this.indexCache.has(collectionName)) {
      return this.indexCache.get(collectionName)!;
    }

    const indexPath = this.getIndexFilePath(collectionName);
    const index = (await this.readFile(indexPath)) || [];
    this.indexCache.set(collectionName, index);
    return index;
  }

  private async updateIndex(
    collectionName: string,
    index: string[],
  ): Promise<void> {
    const indexPath = this.getIndexFilePath(collectionName);
    await this.writeFile(indexPath, index);
    this.indexCache.set(collectionName, index);
  }

  public async createCollection(collectionName: string): Promise<void> {
    const collectionPath = this.getCollectionPath(collectionName);
    await this.ensureDirExists(collectionPath);
    await this.updateIndex(collectionName, []);
  }

  public async deleteCollection(collectionName: string): Promise<void> {
    const collectionPath = this.getCollectionPath(collectionName);
    const mutex = await this.getMutex(collectionName);
    await mutex.runExclusive(async () => {
      await fs.rm(collectionPath, { recursive: true, force: true });
      this.mutexes.delete(collectionName);
      this.indexCache.delete(collectionName);
    });
  }

  public async insertRecord(
    collectionName: string,
    record: any,
    binaryData?: Buffer,
  ): Promise<string> {
    const mutex = await this.getMutex(collectionName);
    return mutex.runExclusive(async () => {
      const index = await this.getIndex(collectionName);

      const recordId = Date.now().toString();
      record.id = recordId;

      const recordPath = this.getRecordFilePath(collectionName, recordId);
      await this.writeFile(recordPath, record);

      if (binaryData) {
        const binaryPath = this.getBinaryFilePath(collectionName, recordId);
        await this.writeBinaryFile(binaryPath, binaryData);
      }

      index.push(recordId);
      await this.updateIndex(collectionName, index);

      return recordId;
    });
  }

  public async getRecords(
    collectionName: string,
    limit?: number,
    skip?: number,
  ): Promise<any[]> {
    const index = await this.getIndex(collectionName);

    const records = [];
    for (
      let i = skip || 0;
      i < Math.min(index.length, (skip || 0) + (limit || index.length));
      i++
    ) {
      const recordPath = this.getRecordFilePath(collectionName, index[i]);
      const record = await this.readFile(recordPath);
      if (record) records.push(record);
    }

    return records;
  }

  public async getRecord(
    collectionName: string,
    recordId: string,
  ): Promise<any> {
    const recordPath = this.getRecordFilePath(collectionName, recordId);
    return this.readFile(recordPath);
  }

  public async getBinaryData(
    collectionName: string,
    recordId: string,
  ): Promise<Buffer | null> {
    const binaryPath = this.getBinaryFilePath(collectionName, recordId);
    try {
      return await fs.readFile(binaryPath);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  public async updateRecord(
    collectionName: string,
    recordId: string,
    newData: any,
    binaryData?: Buffer,
  ): Promise<void> {
    const recordPath = this.getRecordFilePath(collectionName, recordId);
    const binaryPath = this.getBinaryFilePath(collectionName, recordId);
    const mutex = await this.getMutex(collectionName);
    await mutex.runExclusive(async () => {
      const existingRecord = await this.readFile(recordPath);
      if (!existingRecord) {
        throw new Error(
          `Record with ID ${recordId} not found in collection ${collectionName}`,
        );
      }

      const updatedRecord = { ...existingRecord, ...newData };
      await this.writeFile(recordPath, updatedRecord);

      if (binaryData) {
        await this.writeBinaryFile(binaryPath, binaryData);
      }
    });
  }

  public async deleteRecord(
    collectionName: string,
    recordId: string,
  ): Promise<void> {
    const recordPath = this.getRecordFilePath(collectionName, recordId);
    const binaryPath = this.getBinaryFilePath(collectionName, recordId);
    const mutex = await this.getMutex(collectionName);
    await mutex.runExclusive(async () => {
      const index = await this.getIndex(collectionName);
      const updatedIndex = index.filter((id: string) => id !== recordId);

      if (index.length === updatedIndex.length) {
        throw new Error(
          `Record with ID ${recordId} not found in collection ${collectionName}`,
        );
      }

      await fs.unlink(recordPath);
      try {
        await fs.unlink(binaryPath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      await this.updateIndex(collectionName, updatedIndex);
    });
  }
}

export const db = new Database(BASE_DIR);
