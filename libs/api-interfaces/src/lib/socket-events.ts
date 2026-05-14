import { ActionRejectCode } from './action-reject-code.enum';
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

export interface SessionBoundPayload {
  readonly sessionToken: string;
}

export interface JoinLobbyPayload {
  readonly lobbyId: string;
  readonly displayName: string;
}

export interface LobbyJoinedPayload {
  readonly lobbyId: string;
  readonly seat: PlayerSeat;
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

export enum GameSocketClientEvent {
  JoinLobby = 'game:joinLobby',
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
}

export enum GameSocketServerEvent {
  SessionBound = 'game:sessionBound',
  LobbyJoined = 'game:lobbyJoined',
  FullState = 'game:fullState',
  GameDelta = 'game:gameDelta',
  DiceRolled = 'game:diceRolled',
  TradeUpdated = 'game:tradeUpdated',
  ActionRejected = 'game:actionRejected',
}

export type {
  RollDicePayload,
  RobberDiscardPayload,
  MoveRobberPayload,
  FinishTradingPayload,
  EndTurnPayload,
  DiceRolledPayload,
};
