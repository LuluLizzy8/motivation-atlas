export type Side = "player" | "bot";
export type Action = "undo" | "double" | "reveal" | "defense" | "shuffle";
export type Card = { id: string; kind: "number"; value: number } | { id: string; kind: Action };
export type Outcome = Side | "draw" | null;
export interface NumberPlay { card: Extract<Card, { kind: "number" }>; canceled: boolean; doubled: boolean }
export interface PlayerState { hand: Card[]; discard: Card[]; numbers: NumberPlay[]; defense: boolean }
export interface GameState {
  randomized: boolean;
  players: Record<Side, PlayerState>;
  active: Side;
  outcome: Outcome;
  unused: Card[];
  removed: Card[];
  /** Card IDs known to each observer; identities are shown only while still in the other hand. */
  revealed: Record<Side, string[]>;
  publicReveals: { actor: Side; owner: Side; card: Card }[];
  log: string[];
}
const ACTIONS: Action[] = ["undo", "double", "reveal", "defense", "shuffle"];
export const ACTION_TEXT: Record<Action, string> = {
  undo: "Cancel the opponent's latest number once. Removes its original points; an existing Double bonus remains.",
  double: "Add your latest uncanceled number's original value once more.",
  reveal: "Publicly reveal one random opponent hand card without taking it.",
  defense: "Block the opponent's next action card. Number cards do not consume protection.",
  shuffle: "Remove this card, then exchange both remaining hands.",
};
export const otherSide = (side: Side): Side => side === "player" ? "bot" : "player";
export const cardName = (card: Card): string => card.kind === "number" ? "Number " + card.value : card.kind[0].toUpperCase() + card.kind.slice(1);
export const cardEffect = (card: Card): string => card.kind === "number" ? "Add " + card.value + " points." : ACTION_TEXT[card.kind];
export function createCardPool(): Card[] {
  const numbers: Card[] = Array.from({ length: 12 }, (_, i) => i + 1).flatMap(value =>
    [0, 1].map(copy => ({ id: "number-" + value + "-" + copy, kind: "number" as const, value })));
  return [...numbers, ...ACTIONS.map(kind => ({ id: kind, kind }))];
}
export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
export function shufflePool(pool: readonly Card[], random: () => number): Card[] {
  const cards = [...pool];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
const playerState = (hand: Card[]): PlayerState => ({ hand, discard: [], numbers: [], defense: false });
export function stateFromHands(player: Card[], bot: Card[], randomized = true, unused: Card[] = []): GameState {
  return { randomized, players: { player: playerState(player), bot: playerState(bot) }, active: "player",
    outcome: null, unused, removed: [], revealed: { player: [], bot: [] }, publicReveals: [], log: [] };
}
export function createRandomizedGame(random = Math.random): GameState {
  // Rejection sampling preserves the requested constrained distribution.
  // An invalid injected RNG must fail explicitly rather than freezing the browser.
  for (let attempt = 0; attempt < 10000; attempt++) {
    const pool = shufflePool(createCardPool(), random);
    const player = pool.slice(0, 5), bot = pool.slice(5, 10);
    if ([player, bot].every(hand => hand.filter(card => card.kind === "number").length >= 3)) {
      return stateFromHands(player, bot, true, pool.slice(10));
    }
  }
  throw new Error("Could not deal valid hands; provide a varying random source.");
}
export function score(state: GameState, side: Side): number {
  return state.players[side].numbers.reduce((sum, play) =>
    sum + (play.canceled ? 0 : play.card.value) + (play.doubled ? play.card.value : 0), 0);
}
export function latestNumber(state: GameState, side: Side): NumberPlay | undefined { return state.players[side].numbers.at(-1); }
/** A blocked action still needs its normal prerequisite; Defense does not make illegal cards legal. */
export function illegalReason(state: GameState, side: Side, card: Card): string | null {
  if (state.outcome !== null) return "The game has ended.";
  if (!state.players[side].hand.some(held => held.id === card.id)) return "Card is not in hand.";
  const own = latestNumber(state, side), opponent = latestNumber(state, otherSide(side));
  switch (card.kind) {
    case "number": return null;
    case "undo": return !opponent || opponent.canceled ? "Opponent needs an uncanceled latest number." : null;
    case "double": return !own || own.canceled || own.doubled ? "You need an uncanceled, undoubled latest number." : null;
    case "reveal": return state.players[otherSide(side)].hand.length ? null : "Opponent has no cards to reveal.";
    case "defense": return state.players[side].defense ? "You are already protected." : null;
    case "shuffle": return null;
  }
}
export function legalCards(state: GameState, side: Side): Card[] { return state.players[side].hand.filter(card => illegalReason(state, side, card) === null); }
export function getWinner(state: GameState): Outcome {
  if (legalCards(state, "player").length || legalCards(state, "bot").length) return null;
  const player = score(state, "player"), bot = score(state, "bot");
  return player === bot ? "draw" : player > bot ? "player" : "bot";
}
export function chooseBotCard(state: GameState): { id: string | null; reason: string } {
  const cards = legalCards(state, "bot");
  const value = (card: Card): number => {
    const blocked = card.kind !== "number" && state.players.player.defense;
    if (blocked) return -1;
    switch (card.kind) {
      case "undo": return 100 + latestNumber(state, "player")!.card.value;
      case "double": return 50 + latestNumber(state, "bot")!.card.value;
      case "number": return 20 + card.value;
      case "defense": return 3;
      case "reveal": return 2;
      case "shuffle": return 1;
    }
  };
  let chosen: Card | undefined;
  for (const card of cards) if (!chosen || value(card) > value(chosen)) chosen = card;
  return { id: chosen?.id ?? null, reason: chosen
    ? chosen.kind !== "number" && state.players.player.defense ? "Bot uses a legal action to consume your Defense."
      : chosen.kind === "undo" ? "Bot reverses your latest number."
      : chosen.kind === "double" ? "Bot adds its available Double bonus."
      : chosen.kind === "number" ? "Bot plays its highest available number."
      : "Bot uses an available action."
    : "Bot has no legal card and passes." };
}
/** Immutable turn resolution; no draws or access to unused cards. */
export function playTurn(state: GameState, side: Side, id: string | null, random = Math.random, explanation = ""): GameState {
  if (state.outcome !== null || state.active !== side) return state;
  const card = state.players[side].hand.find(held => held.id === id);
  if (id === null ? legalCards(state, side).length > 0 : !card || illegalReason(state, side, card) !== null) return state;
  const next: GameState = {
    ...state, players: Object.fromEntries((["player", "bot"] as Side[]).map(key => [key, {
      ...state.players[key], hand: [...state.players[key].hand], discard: [...state.players[key].discard],
      numbers: state.players[key].numbers.map(play => ({ ...play })),
    }])) as Record<Side, PlayerState>,
    revealed: { player: [...state.revealed.player], bot: [...state.revealed.bot] },
    removed: [...state.removed], publicReveals: [...state.publicReveals], log: [...state.log],
  };
  const other = otherSide(side), own = next.players[side], opponent = next.players[other];
  let detail = "No legal cards; pass.";
  if (card) {
    own.hand = own.hand.filter(held => held.id !== card.id);
    if (card.kind === "shuffle") next.removed.push(card); else own.discard.push(card);
    if (card.kind !== "number" && opponent.defense) {
      opponent.defense = false;
      detail = "Blocked by opponent Defense; protection consumed.";
    } else switch (card.kind) {
      case "number":
        own.numbers.push({ card, canceled: false, doubled: false });
        detail = "Added " + card.value + " points."; break;
      case "undo":
        opponent.numbers.at(-1)!.canceled = true;
        detail = "Canceled the latest number's original " + opponent.numbers.at(-1)!.card.value + " points."; break;
      case "double":
        own.numbers.at(-1)!.doubled = true;
        detail = "Added " + own.numbers.at(-1)!.card.value + " bonus points."; break;
      case "reveal": {
        const target = opponent.hand[Math.floor(random() * opponent.hand.length)];
        if (!next.revealed[side].includes(target.id)) next.revealed[side].push(target.id);
        next.publicReveals.push({ actor: side, owner: other, card: target });
        detail = "Publicly revealed " + cardName(target) + " from " + (other === "player" ? "your" : "the bot's") + " hand; the card stays there.";
        break;
      }
      case "defense": own.defense = true; detail = "Defense activated."; break;
      case "shuffle": [own.hand, opponent.hand] = [opponent.hand, own.hand]; detail = "Exchanged all remaining hand cards."; break;
    }
    // Known identities cease being current hand information after play or transfer.
    for (const observer of ["player", "bot"] as Side[]) {
      next.revealed[observer] = next.revealed[observer].filter(known => next.players[otherSide(observer)].hand.some(held => held.id === known));
    }
  }
  next.log.push((side === "player" ? "You" : "Bot") + ": " + (card ? cardName(card) + ". " : "") + detail
    + " Scores: you " + score(next, "player") + ", bot " + score(next, "bot") + "." + (explanation ? " " + explanation : ""));
  next.active = other;
  next.outcome = getWinner(next);
  return next;
}

/** Fixed mode is an independent ten-card scenario, not a deal from the random pool. */
export function createFixedGame(): GameState {
  const hand = (side: Side): Card[] => [
    ...[1, 5, 11].map(value => ({ id: side + "-number-" + value, kind: "number" as const, value })),
    { id: side + "-undo", kind: "undo" }, { id: side + "-double", kind: "double" },
  ];
  return stateFromHands(hand("player"), hand("bot"), false);
}
export function createInitialGameState(randomized = true, random = Math.random): GameState {
  return randomized ? createRandomizedGame(random) : createFixedGame();
}
