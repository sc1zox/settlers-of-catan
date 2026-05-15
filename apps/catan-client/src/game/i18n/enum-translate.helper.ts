import {
  ActionRejectCode,
  BuildKind,
  GamePhase,
  PlayerSeat,
  ResourceType,
} from '@catan/api-interfaces';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TileType } from '@catan/shared-game-field';
import { TranslateInstantFn } from '../../shared/i18n/translate-instant-fn';
import { PlayerColor } from '../players/player-color.enum';

export class EnumTranslate {
  private constructor() {}

  public static seatKey(seat: PlayerSeat): string {
    switch (seat) {
      case PlayerSeat.North:
        return 'seat.north';
      case PlayerSeat.East:
        return 'seat.east';
      case PlayerSeat.South:
        return 'seat.south';
      case PlayerSeat.West:
        return 'seat.west';
    }
  }

  public static translateSeat(t: TranslateInstantFn, seat: PlayerSeat): string {
    return t(marker(EnumTranslate.seatKey(seat)));
  }

  public static phaseKey(phase: GamePhase): string {
    switch (phase) {
      case GamePhase.LobbyWaiting:
        return 'phase.lobbyWaiting';
      case GamePhase.SetupForward:
        return 'phase.setupForward';
      case GamePhase.SetupBackward:
        return 'phase.setupBackward';
      case GamePhase.Rolling:
        return 'phase.rolling';
      case GamePhase.RobberDiscard:
        return 'phase.robberDiscard';
      case GamePhase.RobberMove:
        return 'phase.robberMove';
      case GamePhase.Trading:
        return 'phase.trading';
      case GamePhase.Building:
        return 'phase.building';
      case GamePhase.EndTurn:
        return 'phase.endTurn';
      case GamePhase.Finished:
        return 'phase.finished';
    }
  }

  public static translatePhase(t: TranslateInstantFn, phase: GamePhase): string {
    return t(marker(EnumTranslate.phaseKey(phase)));
  }

  public static resourceTypeKey(type: ResourceType): string {
    switch (type) {
      case ResourceType.Wood:
        return 'resource.wood';
      case ResourceType.Brick:
        return 'resource.brick';
      case ResourceType.Wheat:
        return 'resource.wheat';
      case ResourceType.Wool:
        return 'resource.wool';
      case ResourceType.Ore:
        return 'resource.ore';
    }
  }

  public static translateResourceType(t: TranslateInstantFn, type: ResourceType): string {
    return t(marker(EnumTranslate.resourceTypeKey(type)));
  }

  public static tileKey(tileType: TileType): string {
    switch (tileType) {
      case TileType.Forest:
        return 'tile.forest';
      case TileType.Fields:
        return 'tile.fields';
      case TileType.Pasture:
        return 'tile.pasture';
      case TileType.Hills:
        return 'tile.hills';
      case TileType.Mountains:
        return 'tile.mountains';
      case TileType.Desert:
        return 'tile.desert';
      case TileType.Water:
        return 'tile.water';
    }
  }

  public static translateTile(t: TranslateInstantFn, tileType: TileType): string {
    return t(marker(EnumTranslate.tileKey(tileType)));
  }

  public static playerColorKey(color: PlayerColor): string {
    switch (color) {
      case PlayerColor.Red:
        return 'playerColor.red';
      case PlayerColor.Blue:
        return 'playerColor.blue';
      case PlayerColor.White:
        return 'playerColor.white';
      case PlayerColor.Orange:
        return 'playerColor.orange';
    }
  }

  public static translatePlayerColor(t: TranslateInstantFn, color: PlayerColor): string {
    return t(marker(EnumTranslate.playerColorKey(color)));
  }

  public static rejectKey(code: ActionRejectCode): string {
    switch (code) {
      case ActionRejectCode.WrongPhase:
        return 'reject.wrongPhase';
      case ActionRejectCode.NotYourTurn:
        return 'reject.notYourTurn';
      case ActionRejectCode.LobbyNotEnoughPlayers:
        return 'reject.lobbyNotEnoughPlayers';
      case ActionRejectCode.InsufficientResources:
        return 'reject.insufficientResources';
      case ActionRejectCode.IllegalPlacement:
        return 'reject.illegalPlacement';
      case ActionRejectCode.InvalidPayload:
        return 'reject.invalidPayload';
      case ActionRejectCode.LobbyFull:
        return 'reject.lobbyFull';
      case ActionRejectCode.UnknownLobby:
        return 'reject.unknownLobby';
      case ActionRejectCode.PlayerNotInLobby:
        return 'reject.playerNotInLobby';
      case ActionRejectCode.UnknownTrade:
        return 'reject.unknownTrade';
      case ActionRejectCode.TradeNotOpen:
        return 'reject.tradeNotOpen';
      case ActionRejectCode.NoDevCardAvailable:
        return 'reject.noDevCardAvailable';
      case ActionRejectCode.DevCardNotOwned:
        return 'reject.devCardNotOwned';
      case ActionRejectCode.DevCardAlreadyPlayed:
        return 'reject.devCardAlreadyPlayed';
      case ActionRejectCode.DevCardBoughtThisTurn:
        return 'reject.devCardBoughtThisTurn';
      case ActionRejectCode.InvalidBankTrade:
        return 'reject.invalidBankTrade';
      case ActionRejectCode.VictimRequired:
        return 'reject.victimRequired';
      case ActionRejectCode.RobberSameTile:
        return 'reject.robberSameTile';
      case ActionRejectCode.GameFinished:
        return 'reject.gameFinished';
    }
  }

  public static translateReject(t: TranslateInstantFn, code: ActionRejectCode): string {
    return t(marker(EnumTranslate.rejectKey(code)));
  }

  public static lobbyWaitingForPlayerKey(): string {
    return 'lobby.waitingForPlayer';
  }

  public static translateLobbyWaitingForPlayer(t: TranslateInstantFn): string {
    return t(marker(EnumTranslate.lobbyWaitingForPlayerKey()));
  }

  public static genericPlayerKey(): string {
    return 'shell.genericPlayer';
  }

  public static translateGenericPlayer(t: TranslateInstantFn): string {
    return t(marker(EnumTranslate.genericPlayerKey()));
  }

  public static buildKindConfirmKey(kind: BuildKind): string {
    switch (kind) {
      case BuildKind.Settlement:
        return 'buildConfirm.settlement';
      case BuildKind.Road:
        return 'buildConfirm.road';
      case BuildKind.City:
        return 'buildConfirm.city';
    }
  }

  public static translateBuildKindConfirm(t: TranslateInstantFn, kind: BuildKind): string {
    return t(marker(EnumTranslate.buildKindConfirmKey(kind)));
  }
}
