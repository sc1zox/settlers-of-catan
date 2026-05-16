import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { HttpApiRelativePath, SwaggerApiTag } from '@catan/api-interfaces';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { RequestId } from './http/decorators/request-id.decorator';
import { Public } from './http/decorators/public.decorator';
import { SessionToken } from './http/decorators/session-token.decorator';
import { PingDto } from './http/dto/ping.dto';
import { BearerSessionGuard } from './http/guards/bearer-session.guard';

@ApiTags(SwaggerApiTag.System)
@Controller()
export class AppController {
  public constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ description: 'Service metadata' })
  public getData(): { message: string } {
    return this.appService.getData();
  }

  @Post(HttpApiRelativePath.SessionPing)
  @HttpCode(200)
  @UseGuards(BearerSessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate body and echo bearer session token context' })
  @ApiBody({ type: PingDto })
  @ApiOkResponse({ description: 'Echo payload' })
  public pingSession(
    @Body() body: PingDto,
    @SessionToken() sessionToken: string,
    @RequestId() requestId: string,
  ): { echo: string; tokenPreview: string; serverRequestId: string } {
    return {
      echo: body.message,
      tokenPreview: sessionToken.slice(0, 8),
      serverRequestId: requestId,
    };
  }
}
