export enum ActionRejectCode {
  WrongPhase = 'wrong_phase',
  NotYourTurn = 'not_your_turn',
  InsufficientResources = 'insufficient_resources',
  IllegalPlacement = 'illegal_placement',
  LobbyFull = 'lobby_full',
  UnknownLobby = 'unknown_lobby',
  PlayerNotInLobby = 'player_not_in_lobby',
  UnknownTrade = 'unknown_trade',
  TradeNotOpen = 'trade_not_open',
}
