import { Injectable } from '@nestjs/common';
import { ActionRejectCode, PlayerSeat } from '@catan/api-interfaces';
import { DemoBotService } from './demo-bot.service';
import { CLOCKWISE_SEATS, LobbyRuntime } from './lobby-runtime';

@Injectable()
export class TurnFlowService {
  public constructor(private readonly demoBots: DemoBotService) {}

  public getActiveTurnSeats(lobby: LobbyRuntime): PlayerSeat[] {
    return this.demoBots.getActiveTurnSeats(lobby);
  }

  public firstTurnSeat(lobby: LobbyRuntime): PlayerSeat {
    const activeSeats = this.getActiveTurnSeats(lobby);
    if (activeSeats.length === 0) {
      return CLOCKWISE_SEATS[0];
    }
    return activeSeats[0];
  }

  public nextSeat(lobby: LobbyRuntime, currentSeat: PlayerSeat): PlayerSeat {
    const activeSeats = this.getActiveTurnSeats(lobby);
    const currentIndex = activeSeats.indexOf(currentSeat);
    if (currentIndex < 0) {
      return this.firstTurnSeat(lobby);
    }
    const nextIndex = (currentIndex + 1) % activeSeats.length;
    return activeSeats[nextIndex];
  }

  public applySetupForwardTransition(lobby: LobbyRuntime, placedBySeat: PlayerSeat): void {
    lobby.setupPlacementsBySeat[placedBySeat] += 1;
    const activeSeats = this.getActiveTurnSeats(lobby);
    const currentIndex = activeSeats.indexOf(placedBySeat);
    const isLastForwardSeat = currentIndex >= 0 && currentIndex === activeSeats.length - 1;
    if (isLastForwardSeat) {
      lobby.fsm.onSetupForwardCompleted();
      lobby.currentSeat = placedBySeat;
      return;
    }
    if (currentIndex < 0) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    lobby.currentSeat = activeSeats[currentIndex + 1];
  }

  public applySetupBackwardTransition(lobby: LobbyRuntime, placedBySeat: PlayerSeat): void {
    lobby.setupPlacementsBySeat[placedBySeat] += 1;
    const activeSeats = this.getActiveTurnSeats(lobby);
    const currentIndex = activeSeats.indexOf(placedBySeat);
    if (currentIndex < 0) {
      throw new Error(ActionRejectCode.NotYourTurn);
    }
    const isBackwardDone = currentIndex === 0;
    if (isBackwardDone) {
      lobby.currentSeat = activeSeats[0];
      lobby.fsm.onSetupCompleted();
      return;
    }
    lobby.currentSeat = activeSeats[currentIndex - 1];
  }
}
