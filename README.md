# LocalStore: A Simple File-Based Data Store for NestJS

LocalStore is a lightweight, file-based data storage solution designed for NestJS applications. It provides a simple API for managing collections and records, storing data locally as either JSON or YAML files. It's ideal for development, testing, or small-scale applications where a full-fledged database might be overkill.

## Features

*   **Collection Management:**
    *   Create and delete collections (similar to tables in a database).
*   **Record Operations:**
    *   Insert, retrieve, update, and delete records (similar to rows in a database).
*   **Data Formats:**
    *   Supports storing data in JSON or YAML format.
*   **Binary Data:**
    *   Handles binary data storage.
*   **Concurrency Control:**
    *   Uses `async-mutex` to manage concurrent access to collections, preventing data corruption.
*   **Indexing:**
    *   Maintains an index file for each collection to optimize record retrieval.
*   **Error Handling:**
    *   Provides robust error handling and logging.
*   **NestJS Integration:**
    *   Built as a NestJS module, making it easy to integrate into your NestJS projects.

## Installation

1.  Install the required dependencies:

    ```bash
    npm install --save @nestjs/config js-yaml async-mutex
    ```

2.  Add the following packages into your project if they are not included:

    ```bash
    npm install --save @nestjs/common @nestjs/core
    ```

## Usage

### Configuration

LocalStore uses the `@nestjs/config` module for configuration. You'll need to set the following environment variables:

*   **`STORAGE_PATH`** (optional): The base directory where data files will be stored. Defaults to `storage`.
*   **`SDD_STORE_TYPE`** (optional): The data storage format. Can be either `json` or `yaml`. Defaults to `json`.

You can configure these variables in a `.env` file or directly in your environment.

**Example `.env` file:**


### LocalStoreService

The core functionality is provided by the `LocalStore` class. Here's a breakdown of its methods:

#### `createCollection(collectionName: string): Promise<void>`

Creates a new collection.

*   `collectionName`: The name of the collection to create.

#### `deleteCollection(collectionName: string): Promise<void>`

Deletes a collection and all its records.

*   `collectionName`: The name of the collection to delete.

#### `insertRecord(collectionName: string, record: any, isBinary: boolean): Promise<string>`

Inserts a new record into a collection.

*   `collectionName`: The name of the collection.
*   `record`: The data to insert (an object for JSON/YAML or a Buffer for binary data).
*   `isBinary`: `true` if the record is binary data, `false` otherwise.
*   Returns: The ID of the newly inserted record.

#### `getRecord(collectionName: string, recordId: string): Promise<any | Buffer | null>`

Retrieves a record by its ID.

*   `collectionName`: The name of the collection.
*   `recordId`: The ID of the record to retrieve.
*   Returns: The record data (an object or a Buffer) or `null` if not found.

#### `getRecords(collectionName: string, limit?: number, skip?: number): Promise<Array<any | Buffer>>`

Retrieves multiple records from a collection.

*   `collectionName`: The name of the collection.
*   `limit` (optional): The maximum number of records to retrieve.
*   `skip` (optional): The number of records to skip.
*   Returns: An array of records (objects or Buffers).

#### `updateRecord(collectionName: string, recordId: string, newData: any, isBinary: boolean): Promise<void>`

Updates an existing record.

*   `collectionName`: The name of the collection.
*   `recordId`: The ID of the record to update.
*   `newData`: The new data for the record (an object for JSON/YAML or a Buffer for binary).
*   `isBinary`:  `true` if `newData` is a Buffer (binary), `false` otherwise
*   Returns: `void`

#### `deleteRecord(collectionName: string, recordId: string): Promise<void>`

Deletes a record by its ID.

*   `collectionName`: The name of the collection.
*   `recordId`: The ID of the record to delete.
*   Returns: `void`

### LocalStoreController

The `LocalStoreController` exposes REST API endpoints for interacting with the `LocalStoreService`.

#### Endpoints

*   **`POST /create`**
    *   Creates a new collection.
    *   Body: `{ "tableName": "your_collection_name" }`
*   **`POST /:table`**
    *   Inserts a new record into the specified collection.
    *   `table`: The name of the collection.
    *   `binary` (query parameter): `true` if inserting binary data, `false` otherwise.
    *   Body: The record data (JSON object or binary).
*   **`PUT /:table/:id`**
    *   Updates a record in the specified collection.
    *   `table`: The name of the collection.
    *   `id`: The ID of the record to update.
    *   `binary` (query parameter): `true` if updating with binary data, `false` otherwise.
    *   Body: The updated record data (JSON object or binary).
*   **`GET /:table`**
    *   Retrieves records from the specified collection.
    *   `table`: The name of the collection.
    *   `limit` (query parameter, optional): The maximum number of records to retrieve (defaults to 10).
    *   `skip` (query parameter, optional): The number of records to skip (defaults to 0).
*   **`GET /:table/:id`**
    *   Retrieves a single record by its ID.
    *   `table`: The name of the collection.
    *   `id`: The ID of the record.
*   **`DELETE /:table/:id`**
    *   Deletes a record from the specified collection.
    *   `table`: The name of the collection.
    *   `id`: The ID of the record to delete.

## Example Usage (Controller)

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { LocalStoreService } from './local-store.service';

@Controller('data')
export class DataController {
  constructor(private readonly localStoreService: LocalStoreService) {}

  @Post('create-collection')
  async createCollection(@Body('name') name: string) {
    await this.localStoreService.createCollection(name);
    return { message: `Collection "${name}" created successfully.` };
  }

  @Post('insert-record')
  async insertRecord(
    @Body('collection') collection: string,
    @Body('data') data: any,
    @Body('isBinary') isBinary: boolean,
  ) {
    const recordId = await this.localStoreService.insertRecord(
      collection,
      data,
      isBinary,
    );
    return { message: 'Record inserted successfully.', recordId };
  }
}


