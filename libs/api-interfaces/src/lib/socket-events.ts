import { ActionRejectCode } from './action-reject-code.enum';
import { BonusAwardKind } from './bonus-award.enum';
import type { LiveKitCredentialsPayload } from './livekit.dto';
import { PlayerSeat } from './player-seat.enum';
import { ResourceType } from './resource-type.enum';
import {
  DiceRolledPayload,
  EndTurnPayload,
  FinishTradingPayload,
  MoveRobberPayload,
  RobberDiscardPayload,
  RollDicePayload,
} from './turn-flow.dto';

export interface ActionRejectedPayload {
  readonly code: ActionRejectCode;
  readonly message: string;
}

export interface BonusAwardedPayload {
  readonly lobbyId: string;
  readonly kind: BonusAwardKind;
  readonly recipientSeat: PlayerSeat;
}

export interface JoinLobbyPayload {
  readonly lobbyCode: string;
  readonly displayName: string;
}

export interface CreateLobbyPayload {
  readonly lobbyCode: string;
  readonly displayName: string;
}

export interface LobbyJoinedPayload {
  readonly lobbyId: string;
  readonly lobbyCode: string;
  readonly seat: PlayerSeat;
  readonly liveKit?: LiveKitCredentialsPayload;
  readonly lobbyIdleRecycled?: boolean;
}

export interface BuildSettlementPayload {
  readonly lobbyId: string;
  readonly vertexId: string;
}

export interface BuildRoadPayload {
  readonly lobbyId: string;
  readonly edgeId: string;
}

export interface BuildCityPayload {
  readonly lobbyId: string;
  readonly vertexId: string;
}

export interface BuyDevCardPayload {
  readonly lobbyId: string;
}

export interface PlayKnightPayload {
  readonly lobbyId: string;
  readonly q: number;
  readonly r: number;
  readonly victimSeat?: PlayerSeat;
}

export interface PlayMonopolyPayload {
  readonly lobbyId: string;
  readonly resource: ResourceType;
}

export interface PlayYearOfPlentyPayload {
  readonly lobbyId: string;
  readonly first: ResourceType;
  readonly second: ResourceType;
}

export interface PlayRoadBuildingPayload {
  readonly lobbyId: string;
  readonly firstEdgeId: string;
  readonly secondEdgeId?: string;
}

export interface BankTradePayload {
  readonly lobbyId: string;
  readonly giveResource: ResourceType;
  readonly giveAmount: number;
  readonly receiveResource: ResourceType;
}

export interface StartLobbyPayload {
  readonly lobbyId: string;
}

export interface LeaveLobbyPayload {
  readonly lobbyId: string;
}

export interface FillLobbyWithBotsPayload {
  readonly lobbyId: string;
}

export interface KickAndReplaceWithBotPayload {
  readonly lobbyId: string;
  readonly seat: PlayerSeat;
}

export enum LobbyTerminationReason {
  SummaryTimeout = 'summary_timeout',
}

export interface LobbyTerminatedPayload {
  readonly lobbyId: string;
  readonly reason: LobbyTerminationReason;
}

export enum GameSocketClientEvent {
  CreateLobby = 'game:createLobby',
  JoinLobby = 'game:joinLobby',
  LeaveLobby = 'game:leaveLobby',
  FillLobbyWithBots = 'game:fillLobbyWithBots',
  StartLobby = 'game:startLobby',
  RollDice = 'game:rollDice',
  RobberDiscard = 'game:robberDiscard',
  MoveRobber = 'game:moveRobber',
  FinishTrading = 'game:finishTrading',
  EndTurn = 'game:endTurn',
  BuildSettlement = 'game:buildSettlement',
  BuildRoad = 'game:buildRoad',
  BuildCity = 'game:buildCity',
  BuyDevCard = 'game:buyDevCard',
  PlayKnight = 'game:playKnight',
  PlayMonopoly = 'game:playMonopoly',
  PlayYearOfPlenty = 'game:playYearOfPlenty',
  PlayRoadBuilding = 'game:playRoadBuilding',
  BankTrade = 'game:bankTrade',
  TradePropose = 'game:tradePropose',
  TradeAccept = 'game:tradeAccept',
  TradeReject = 'game:tradeReject',
  TradeCounter = 'game:tradeCounter',
  TradeWithdrawCounter = 'game:tradeWithdrawCounter',
  TradeFinalize = 'game:tradeFinalize',
  KickAndReplaceWithBot = 'game:kickAndReplaceWithBot',
}

export enum GameSocketServerEvent {
  LobbyJoined = 'game:lobbyJoined',
  FullState = 'game:fullState',
  DiceRolled = 'game:diceRolled',
  TradeUpdated = 'game:tradeUpdated',
  BonusAwarded = 'game:bonusAwarded',
  ActionRejected = 'game:actionRejected',
  LobbyTerminated = 'game:lobbyTerminated',
}

export type {
  RollDicePayload,
  RobberDiscardPayload,
  MoveRobberPayload,
  FinishTradingPayload,
  EndTurnPayload,
  DiceRolledPayload,
};
