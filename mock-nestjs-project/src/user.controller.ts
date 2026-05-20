import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';

@Controller('users')
export class UserController {
  @Get('me')
  @UseGuards(AuthGuard)
  async getProfile() {
    return { id: 1 };
  }
}
