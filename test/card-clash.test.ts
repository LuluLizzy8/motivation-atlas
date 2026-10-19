// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCardPool, createRandomizedGame, createFixedGame, createInitialGameState, stateFromHands, score, playTurn, legalCards, illegalReason, chooseBotCard, seededRandom, type Card, type Action, type GameState } from "../src/minigames/card-clash/game";

const number = (value: number, id = "n" + value): Card => ({ id, kind: "number", value });
const action = (kind: Action, id: string = kind): Card => ({ id, kind });
function setup(player: Card[], bot: Card[]): GameState { return stateFromHands(player, bot); }
function play(state: GameState, id: string | null): GameState { return playTurn(state, state.active, id, seededRandom(7)); }
function allOwned(state: GameState): string[] {
  return [...state.unused, ...state.removed, ...Object.values(state.players).flatMap(p => [...p.hand, ...p.discard])].map(c => c.id).sort();
}
describe("Card Clash randomized pool", () => {
  it("contains two of each number and exactly five unique actions, 29 unique IDs", () => {
    const pool = createCardPool();
    expect(pool).toHaveLength(29);
    expect(new Set(pool.map(c => c.id)).size).toBe(29);
    expect(pool.filter(c => c.kind === "number")).toHaveLength(24);
    for (let value = 1; value <= 12; value++) expect(pool.filter(c => c.kind === "number" && c.value === value)).toHaveLength(2);
    for (const kind of ["undo", "double", "reveal", "defense", "shuffle"]) expect(pool.filter(c => c.kind === kind)).toHaveLength(1);
  });
  it("reproducibly deals five without replacement and at least three numbers per side", () => {
    for (let seed = 0; seed < 150; seed++) {
      const s = createRandomizedGame(seededRandom(seed));
      expect(s).toEqual(createRandomizedGame(seededRandom(seed)));
      expect(s.active).toBe("player");
      expect(s.unused).toHaveLength(19);
      for (const p of Object.values(s.players)) {
        expect(p.hand).toHaveLength(5);
        expect(p.hand.filter(c => c.kind === "number").length).toBeGreaterThanOrEqual(3);
      }
      expect(allOwned(s)).toEqual(createCardPool().map(c => c.id).sort());
    }
    expect(createRandomizedGame(seededRandom(1)).players.player.hand).not.toEqual(createRandomizedGame(seededRandom(2)).players.player.hand);
  });
});
describe("number, Undo, and Double", () => {
  it("scores numbers for either side and has no score threshold", () => {
    let s = setup([number(12), number(11)], [number(1)]);
    s = play(s, "n12"); s = play(s, "n1"); s = play(s, "n11");
    expect(score(s, "player")).toBe(23);
    expect(s.outcome).toBe("player");
    expect(s.players.player.hand).toHaveLength(0);
  });
  it("Undo targets only the latest number and cannot cancel it twice or fall back to an older number", () => {
    let s = setup([number(5), number(7), number(3)], [number(1), action("undo"), action("undo", "undo2")]);
    s = play(s, "n5"); s = play(s, "n1"); s = play(s, "n7"); s = play(s, "undo");
    expect(score(s, "player")).toBe(5);
    expect(s.players.player.discard.map(c => c.id)).toEqual(["n5", "n7"]);
    expect(illegalReason(s, "bot", s.players.bot.hand[0])).toContain("uncanceled");
  });
  it("rejects Undo without history and Double without an eligible latest number", () => {
    const s = setup([action("double"), action("undo")], [number(1)]);
    expect(legalCards(s, "player")).toHaveLength(0);
    expect(play(s, "double")).toBe(s);
    expect(play(s, "undo")).toBe(s);
  });
  it("doubles once; Undo removes original points only and canceled numbers cannot be doubled", () => {
    let s = setup([number(5), action("double"), action("double", "double2")], [number(1), action("undo")]);
    s = play(s, "n5"); s = play(s, "n1"); s = play(s, "double");
    expect(score(s, "player")).toBe(10);
    expect(illegalReason(s, "player", s.players.player.hand[0])).toContain("undoubled");
    s = play(s, "undo");
    expect(score(s, "player")).toBe(5);
    expect(s.players.player.numbers[0]).toMatchObject({ canceled: true, doubled: true });
    let canceled = setup([number(5), action("double")], [action("undo"), number(2)]);
    canceled = play(canceled, "n5"); canceled = play(canceled, "undo");
    expect(play(canceled, "double")).toBe(canceled);
  });
});
describe("Reveal, Defense, and Shuffle", () => {
  it("Reveal selects reproducibly without consuming the opponent card and publicly records either side", () => {
    const s = setup([action("reveal"), number(1)], [number(5), number(7)]);
    const next = playTurn(s, "player", "reveal", () => 0.99);
    expect(next.revealed.player).toEqual(["n7"]);
    expect(next.players.bot.hand).toEqual(s.players.bot.hand);
    expect(next.players.player.discard).toEqual([action("reveal")]);
    expect(illegalReason(setup([action("reveal")], []), "player", action("reveal"))).toContain("no cards");
    const b = { ...setup([number(5)], [action("reveal")]), active: "bot" as const };
    const botReveal = play(b, "reveal");
    expect(botReveal.log[0]).toContain("Number 5");
    expect(botReveal.publicReveals).toEqual([{ actor: "bot", owner: "player", card: number(5) }]);
    expect(next.publicReveals).toEqual([{ actor: "player", owner: "bot", card: number(7) }]);
    expect(s.publicReveals).toEqual([]);
    expect(play(next, "n7").publicReveals).toEqual(next.publicReveals);
  });
  it("Defense survives numbers, blocks and consumes the next legal opposing action", () => {
    let s = setup([action("defense"), number(7), number(2)], [number(5), action("undo"), number(3)]);
    s = play(s, "defense"); s = play(s, "n5");
    expect(s.players.player.defense).toBe(true);
    s = play(s, "n7"); s = play(s, "undo");
    expect(score(s, "player")).toBe(7);
    expect(s.players.player.defense).toBe(false);
    expect(s.players.bot.discard.map(c => c.id)).toContain("undo");
    expect(s.log.at(-1)).toContain("Blocked");
  });
  it("does not allow stacking Defense and still validates prerequisites before a block", () => {
    const s = setup([action("defense")], [action("double"), number(1)]);
    s.players.player.defense = true;
    expect(play(s, "defense")).toBe(s);
    expect(illegalReason(s, "bot", action("double"))).not.toBeNull();
  });
  it.each(["reveal", "defense", "shuffle"] as const)("Defense blocks %s without resolving its effect", kind => {
    const s = setup([action(kind), number(1)], [number(2)]);
    s.players.bot.defense = true;
    const result = play(s, kind);
    expect(result.players.player.hand).toEqual([number(1)]);
    expect(result.players.bot.hand).toEqual([number(2)]);
    expect(result.players.player.defense).toBe(false);
    expect(result.revealed.player).toEqual([]);
    expect(result.publicReveals).toEqual([]);
    expect(result.players.bot.defense).toBe(false);
    expect(result.removed).toHaveLength(kind === "shuffle" ? 1 : 0);
    expect(allOwned(result)).toEqual(allOwned(s));
  });
  it("Shuffle removes itself, exchanges only remaining hands and clears stale reveals", () => {
    let s = setup([number(1), action("shuffle"), number(5)], [number(2), number(7)]);
    s = play(s, "n1"); s = play(s, "n2");
    s.revealed.player = ["n7"];
    const before = allOwned(s);
    const next = play(s, "shuffle");
    expect(next.players.player.hand).toEqual([number(7)]);
    expect(next.players.bot.hand).toEqual([number(5)]);
    expect(next.players.player.discard).toEqual([number(1)]);
    expect(next.players.bot.discard).toEqual([number(2)]);
    expect(next.removed).toEqual([action("shuffle")]);
    expect(next.revealed.player).toEqual([]);
    expect(allOwned(next)).toEqual(before);
    expect(s.players.player.hand).toHaveLength(2);
  });
});
describe("flow and deterministic bot", () => {
  it("rejects out-of-turn input, missing IDs and unnecessary passes", () => {
    const s = setup([number(1)], [number(2)]);
    expect(playTurn(s, "bot", "n2")).toBe(s);
    expect(play(s, "missing")).toBe(s);
    expect(play(s, null)).toBe(s);
    expect(play(s, "n1").active).toBe("bot");
  });
  it("passes with no legal card; a later number can make that card legal", () => {
    let s = setup([action("undo")], [number(7)]);
    s = play(s, null);
    expect(s.active).toBe("bot");
    expect(s.log.at(-1)).toContain("pass");
    s = play(s, "n7");
    expect(legalCards(s, "player")).toHaveLength(1);
    s = play(s, "undo");
    expect(s.outcome).toBe("draw");
  });
  it.each([[7, 2, "player"], [2, 7, "bot"], [5, 5, "draw"]] as const)("finishes on final scores %s/%s", (p, b, outcome) => {
    let s = setup([number(p, "p")], [number(b, "b")]);
    s = play(s, "p");
    expect(s.outcome).toBeNull();
    s = play(s, "b");
    expect(s.outcome).toBe(outcome);
    expect(play(s, null)).toBe(s);
    expect(play(s, "p")).toBe(s);
  });
  it("ends with unusable cards still held when neither side can act", () => {
    let s = setup([number(5), action("double")], [action("undo")]);
    s = play(s, "n5"); s = play(s, "undo");
    expect(s.outcome).toBe("draw");
    expect(s.players.player.hand).toHaveLength(1);
  });
  it("bot uses legal Undo, then Double, then the highest number, with hand-order ties", () => {
    let s = setup([number(5), number(1)], [action("undo"), action("double"), number(7), number(7, "copy")]);
    s = play(s, "n5");
    expect(chooseBotCard(s).id).toBe("undo");
    s = play(s, "undo"); s = play(s, "n1");
    expect(chooseBotCard(s).id).toBe("n7");
    s = play(s, "n7"); s = play(s, null);
    expect(chooseBotCard(s).id).toBe("double");
    expect(chooseBotCard(s)).toEqual(chooseBotCard(s));
  });
  it("complete seeded matches never draw, lose ownership, or loop after Shuffle or passes", () => {
    for (let seed = 0; seed < 100; seed++) {
      let s = createRandomizedGame(seededRandom(seed));
      const ids = allOwned(s), unused = s.unused;
      for (let step = 0; s.outcome === null; step++) {
        expect(step).toBeLessThan(22);
        const selected = s.active === "bot" ? chooseBotCard(s).id : legalCards(s, "player")[0]?.id ?? null;
        s = play(s, selected);
        expect(allOwned(s)).toEqual(ids);
        expect(s.unused).toEqual(unused);
      }
    }
  });
});



describe("fixed scenario", () => {
  it("uses ten unique cards, identical five-card compositions, and no random calls", () => {
    const random = vi.fn(() => { throw new Error("Fixed mode must not use RNG"); });
    const s = createInitialGameState(false, random);
    expect(random).not.toHaveBeenCalled();
    expect(s).toEqual(createFixedGame());
    expect(s).toEqual(createFixedGame());
    expect(s.active).toBe("player");
    const describeHand = (cards: Card[]) => cards.map(c => c.kind === "number" ? c.value : c.kind);
    expect(describeHand(s.players.player.hand)).toEqual([1, 5, 11, "undo", "double"]);
    expect(describeHand(s.players.bot.hand)).toEqual([1, 5, 11, "undo", "double"]);
    expect(new Set(allOwned(s)).size).toBe(10);
    expect(s.unused).toEqual([]);
  });
  it("finishes without drawing and plays deterministically", () => {
    const run = () => {
      let s = createFixedGame();
      const ids = allOwned(s);
      for (let turn = 0; s.outcome === null; turn++) {
        expect(turn).toBeLessThan(22);
        const id = s.active === "bot" ? chooseBotCard(s).id : legalCards(s, "player")[0]?.id ?? null;
        s = play(s, id);
        expect(allOwned(s)).toEqual(ids);
      }
      return s;
    };
    expect(run()).toEqual(run());
  });
});

import { cardClash } from "../src/minigames/card-clash";
import { minigamesFor } from "../src/minigames/registry";
import { readFileSync } from "node:fs";
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });
describe("Atlas interface", () => {
  function mount() {
    vi.useFakeTimers();
    const el = document.createElement("div");
    document.body.append(el);
    const unmount = cardClash.mount(el);
    const toggle = el.querySelector<HTMLInputElement>("[data-mechanic]")!;
    const restart = [...el.querySelectorAll("button")].find(b => b.textContent === "New Game")!;
    const playFirst = () => el.querySelector<HTMLButtonElement>("[data-card]:not(:disabled), [data-pass]")!.click();
    return { el, unmount, toggle, restart, playFirst };
  }
  it("registers and exposes exactly one mechanic; mode changes apply only to a new game", () => {
    expect(minigamesFor("chance")).toContain(cardClash);
    expect(minigamesFor("competition")).not.toContain(cardClash);
    const { el, unmount, toggle, restart } = mount();
    expect(el.querySelectorAll("[data-mechanic]")).toHaveLength(1);
    const hand = el.querySelector(".clash-hand")!.textContent;
    toggle.click();
    expect(el.querySelector(".clash-hand")!.textContent).toBe(hand);
    expect(el.querySelector(".clash-mode")!.textContent).toContain("pending");
    restart.click();
    expect(el.querySelector(".clash-mode")!.textContent).toContain("Current game: Fixed");
    expect([...el.querySelectorAll("[data-card] strong")].map(e => e.textContent)).toEqual(["Number 1", "Number 5", "Number 11", "Undo", "Double"]);
    expect(el.querySelector<HTMLButtonElement>('[data-card="player-undo"]')!.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('[data-card="player-double"]')!.disabled).toBe(true);
    expect(el.querySelector("[data-bot-hand]")!.textContent).toContain("Known starting composition only");
    unmount();
  });
  it("rejects stale or duplicate clicks, preserves a running game when toggled, and clears timers", () => {
    const { el, unmount, toggle, restart, playFirst } = mount();
    toggle.click(); restart.click();
    const old = el.querySelector<HTMLButtonElement>("[data-card]")!;
    old.click(); old.dispatchEvent(new Event("click"));
    expect(el.querySelectorAll(".clash-log li")).toHaveLength(1);
    expect([...el.querySelectorAll<HTMLButtonElement>("[data-card]")].every(b => b.disabled)).toBe(true);
    const scores = el.querySelector(".clash-scores")!.textContent;
    toggle.click();
    expect(el.querySelector(".clash-scores")!.textContent).toBe(scores);
    vi.advanceTimersByTime(650);
    expect(el.querySelectorAll(".clash-log li")).toHaveLength(2);
    old.dispatchEvent(new Event("click"));
    expect(el.querySelectorAll(".clash-log li")).toHaveLength(2);
    playFirst(); restart.click();
    expect(vi.getTimerCount()).toBe(0);
    expect(el.querySelectorAll(".clash-log li")).toHaveLength(0);
    playFirst(); unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(el.childNodes).toHaveLength(0);
  });
  it("plays a fixed match to a visible result and disables all remaining cards", () => {
    const { el, unmount, toggle, restart, playFirst } = mount();
    toggle.click(); restart.click();
    let steps = 0;
    while (!/win!|wins!|Draw!/.test(el.querySelector('[role="status"]')!.textContent!)) {
      expect(steps++).toBeLessThan(22);
      playFirst();
      vi.advanceTimersByTime(650);
    }
    expect([...el.querySelectorAll<HTMLButtonElement>("[data-card]")].every(b => b.disabled)).toBe(true);
    expect(el.textContent).toContain("What did you feel?");
    unmount();
  });
  it("quotes the course note exactly and includes supplied playtest observations", () => {
    const note = readFileSync("content/player-motivations.md", "utf8");
    expect(note).toContain('"clear feedback about who is winning,"');
    const readme = readFileSync("src/minigames/card-clash/README.md", "utf8");
    expect(readme).toContain("During playtesting, Fixed Mode produced a more predictable strategic experience.");
    expect(readme).toContain("Randomized Mode created a stronger sense of uncertainty and suspense");
  });
});
