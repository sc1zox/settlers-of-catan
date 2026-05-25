export const BOT_SESSION_TOKEN_PREFIX = 'bot-';
/**
 * Delay between two consecutive bot actions on the same lobby. Long enough for
 * the client's arsenal fly-in animation to complete and call `revealPiece`
 * before the next placement spawns and starts its own flight (the arsenal can
 * only animate one figure at a time).
 */
export const BOT_ACTION_DELAY_MS = 700;
