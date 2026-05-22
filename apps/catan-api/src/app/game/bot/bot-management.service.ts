import { Injectable } from '@nestjs/common';
import { PlayerSeat } from '@catan/api-interfaces';
import { LobbyRuntime } from '../lobby/lobby-runtime';
import { BOT_SESSION_TOKEN_PREFIX } from './bot.config';

@Injectable()
export class BotManagementService {
  public fillLobbyWithBots(lobby: LobbyRuntime): void {
    let nextSeat = lobby.nextFreeSeat();
    while (nextSeat !== undefined) {
      const botSessionToken = `${BOT_SESSION_TOKEN_PREFIX}${nextSeat}`;
      if (lobby.findPlayerByToken(botSessionToken)) {
        break;
      }
      lobby.addPlayer(botSessionToken, this.getBotDisplayName(nextSeat), null, true);
      nextSeat = lobby.nextFreeSeat();
    }
  }

  public getBotDisplayName(seat: PlayerSeat): string {
    const namesBySeat: Record<PlayerSeat, string> = {
      [PlayerSeat.North]: 'Bot Nord',
      [PlayerSeat.East]: 'Bot Ost',
      [PlayerSeat.South]: 'Bot Sued',
      [PlayerSeat.West]: 'Bot West',
    };
    return namesBySeat[seat];
  }

  public isBotSessionToken(sessionToken: string): boolean {
    return sessionToken.startsWith(BOT_SESSION_TOKEN_PREFIX);
  }

  public resolveBotTradeAcceptorSessionToken(
    lobby: LobbyRuntime | undefined,
    toSeat: PlayerSeat,
  ): string | null {
    if (lobby === undefined) {
      return null;
    }
    const target = lobby.findPlayerBySeat(toSeat);
    if (!target || !this.isBotSessionToken(target.sessionToken)) {
      return null;
    }
    return target.sessionToken;
  }
}
