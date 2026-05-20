import { Controller, Get, Post } from '@nestjs/common';

@Controller('items')
export class ItemController {
  @Get()
  async findAll() {
    return [];
  }

  @Post()
  async create() {
    return {};
  }
}
