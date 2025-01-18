import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UsePipes,
  DefaultValuePipe,
} from '@nestjs/common';
import { CreateTableDto } from './dto/create-collection.dto';
import { LocalStoreService } from './local-store.service';

@Controller()
export class LocalStoreController {
  constructor(private localStoreService: LocalStoreService) {}

  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @Post('create')
  async createTable(@Body() body: CreateTableDto) {
    return await this.localStoreService
      .createCollection(body.tableName)
      .then(() => {
        return 'Table created successfully';
      });
  }

  @Post(':table')
  async insertRecord(
    @Query('binary') binary: string,
    @Param('table') table: string,
    @Body() body: Record<any, any>,
  ) {
    const isActiveBoolean = binary === 'true';
    return await this.localStoreService.insertRecord(
      table,
      body,
      isActiveBoolean,
    );
  }

  @Put(':table/:id')
  async update(
    @Query('binary') binary: string,
    @Param('table') table: string,
    @Param('id') id: string,
    @Body() data: Record<string, any>,
  ) {
    const isActiveBoolean = binary === 'true';
    await this.localStoreService.updateRecord(table, id, data, isActiveBoolean);
  }

  @Get(':table')
  async find(
    @Param('table') table: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
  ) {
    return await this.localStoreService.getRecords(table, limit, skip);
  }

  @Get(':table/:id')
  findOne(@Param('id') id: string, @Param('table') table: string) {
    return this.localStoreService.getRecord(table, id);
  }

  @Delete(':table/:id')
  remove(@Param('id') id: string, @Param('table') table: string) {
    return this.localStoreService.deleteRecord(table, id);
  }
}
