import { Controller, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../auth/decorators/auth.decorators';
import { IframeService } from './services/iframe.service';
import { GenerateIframeTokenDto } from './dto/generate-iframe-token.dto';

@Controller('v1/iframe')
export class IframeController {
  constructor(private readonly iframeService: IframeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  generate(@Body() dto: GenerateIframeTokenDto) {
    return this.iframeService.generate(dto);
  }

  @Post(':token/auth')
  @Public()
  @HttpCode(HttpStatus.OK)
  exchange(@Param('token') token: string) {
    return this.iframeService.exchange(token);
  }
}
