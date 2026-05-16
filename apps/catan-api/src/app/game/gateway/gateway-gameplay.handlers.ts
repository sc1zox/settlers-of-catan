import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  BuildCityPayload,
  BuildRoadPayload,
  BuildSettlementPayload,
  BuyDevCardPayload,
  EndTurnPayload,
  MoveRobberPayload,
  PlayKnightPayload,
  PlayMonopolyPayload,
  PlayRoadBuildingPayload,
  PlayYearOfPlentyPayload,
  RobberDiscardPayload,
  RollDicePayload,
} from '@catan/api-interfaces';
import { BuildSocketFacade } from '../build/build-socket.facade';
import { DevCardsSocketFacade } from '../dev-cards/dev-cards-socket.facade';
import { RobberSocketFacade } from '../robber/robber-socket.facade';
import { TurnSocketFacade } from '../match-flow/turn-socket.facade';
import { GatewaySocketSessionService } from './gateway-common.services';

@Injectable()
export class GatewayGameplayHandlers {
  public constructor(
    private readonly sessions: GatewaySocketSessionService,
    private readonly buildSocket: BuildSocketFacade,
    private readonly robberSocket: RobberSocketFacade,
    private readonly turnSocket: TurnSocketFacade,
    private readonly devCardsSocket: DevCardsSocketFacade,
  ) {}

  public buildSettlement(server: Server, client: Socket, payload: BuildSettlementPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.buildSocket.buildSettlement(payload.lobbyId, sessionToken, payload.vertexId, server);
  }

  public buildRoad(server: Server, client: Socket, payload: BuildRoadPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.buildSocket.buildRoad(payload.lobbyId, sessionToken, payload.edgeId, server);
  }

  public buildCity(server: Server, client: Socket, payload: BuildCityPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.buildSocket.buildCity(payload.lobbyId, sessionToken, payload.vertexId, server);
  }

  public buyDevCard(server: Server, client: Socket, payload: BuyDevCardPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.devCardsSocket.buyDevCard(payload.lobbyId, sessionToken, server);
  }

  public playKnight(server: Server, client: Socket, payload: PlayKnightPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.robberSocket.playKnight(
      payload.lobbyId,
      sessionToken,
      payload.q,
      payload.r,
      payload.victimSeat,
      server,
    );
  }

  public playMonopoly(server: Server, client: Socket, payload: PlayMonopolyPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.devCardsSocket.playMonopoly(payload.lobbyId, sessionToken, payload.resource, server);
  }

  public playYearOfPlenty(server: Server, client: Socket, payload: PlayYearOfPlentyPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.devCardsSocket.playYearOfPlenty(
      payload.lobbyId,
      sessionToken,
      payload.first,
      payload.second,
      server,
    );
  }

  public playRoadBuilding(server: Server, client: Socket, payload: PlayRoadBuildingPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.buildSocket.playRoadBuilding(
      payload.lobbyId,
      sessionToken,
      payload.firstEdgeId,
      payload.secondEdgeId,
      server,
    );
  }

  public rollDice(server: Server, client: Socket, payload: RollDicePayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.turnSocket.rollDice(payload.lobbyId, sessionToken, server);
  }

  public robberDiscard(server: Server, client: Socket, payload: RobberDiscardPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.robberSocket.submitRobberDiscard(payload.lobbyId, sessionToken, payload.discard, server);
  }

  public moveRobber(server: Server, client: Socket, payload: MoveRobberPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.robberSocket.moveRobber(
      payload.lobbyId,
      sessionToken,
      payload.q,
      payload.r,
      payload.victimSeat,
      server,
    );
  }

  public endTurn(server: Server, client: Socket, payload: EndTurnPayload): void {
    const sessionToken = this.sessions.requireSessionToken(client);
    this.turnSocket.endTurn(payload.lobbyId, sessionToken, server);
  }
}
