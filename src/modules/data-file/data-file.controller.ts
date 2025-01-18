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
} from '@nestjs/common';

@Controller()
export class MyTableController {
  constructor() {}

  @Post('create')
  createTable(@Body() createTableDto: any) {}

  @Get('myTable')
  findAll() {}

  @Get('myTable')
  findPage(
    @Query('limit', ParseIntPipe) limit: number,
    @Query('skip', ParseIntPipe) skip: number,
  ) {}

  @Get('myTable/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {}

  @Post('myTable')
  create(@Body() createMyTableDto) {}

  @Delete('myTable/:id')
  remove(@Param('id', ParseIntPipe) id: number) {}

  @Put('myTable/:id')
  update(@Param('id', ParseIntPipe) id: number) {}
}
