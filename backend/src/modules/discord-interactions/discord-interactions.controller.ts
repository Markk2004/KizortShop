import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { DiscordInteractionsService } from './discord-interactions.service';

@SkipThrottle()
@Controller('discord/interactions')
export class DiscordInteractionsController {
  private readonly logger = new Logger(DiscordInteractionsController.name);

  constructor(
    private readonly interactionsService: DiscordInteractionsService,
  ) {}

  @Post('ops')
  async handleOpsInteraction(
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
    @Headers('x-signature-ed25519') signature?: string,
    @Headers('x-signature-timestamp') timestamp?: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body), 'utf-8');

    if (!signature || !timestamp) {
      this.logger.warn('Interaction request missing signature headers');
      throw new UnauthorizedException('Missing interaction signature headers');
    }

    const isValid = this.interactionsService.verifySignature(
      signature,
      timestamp,
      rawBody,
    );

    if (!isValid) {
      this.logger.warn('Invalid interaction signature rejected');
      throw new UnauthorizedException('Invalid interaction signature');
    }

    const body = req.body;

    // Discord Interaction Type 1: PING (URL validation handshake)
    if (body.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    // Discord Interaction Type 2: APPLICATION_COMMAND
    if (body.type === 2) {
      const response = await this.interactionsService.handleCommand(body);
      return res.status(200).json(response);
    }

    return res.status(200).json({ type: 4, data: { content: 'Handled' } });
  }
}
