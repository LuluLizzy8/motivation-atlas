// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountMorning } from "../src/minigames/any-given-morning";
import { chooseReply, take, type Session } from "../src/minigames/any-given-morning/game";
import { COPY } from "../src/minigames/any-given-morning/text";
import { bindInput } from "../src/minigames/any-given-morning/input";
import { DEATHS } from "../src/minigames/any-given-morning/game";
import { drawEffects, playerPose, shake } from "../src/minigames/any-given-morning/effects";
import { createSession, startLife } from "../src/minigames/any-given-morning/game";
import { createSprites, GRIDS } from "../src/minigames/any-given-morning/sprites";
import { drawCarriedItems } from "../src/minigames/any-given-morning/render";
import { interact } from "../src/minigames/any-given-morning/game";
import { generateArea } from "../src/minigames/any-given-morning/world";

vi.setConfig({ testTimeout: 60_000 });

let el: HTMLDivElement, session: Session, unmount: (() => void) | undefined;
const get = <T extends HTMLElement = HTMLElement>(id: string) => el.querySelector<T>(`[data-testid="${id}"]`)!;
const state = () => get("any-given-morning").dataset.state;
const key = (value: string) => get("canvas").dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
const frames = (ms: number) => vi.advanceTimersByTime(ms);
function mount(reduced = false): void {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  unmount = mountMorning(el, { seed: 38, onSession: (value) => { session = value; } });
  // Vitest stubs CSS imports; load the shipped source for CSS regression checks.
  el.querySelector("style")!.textContent = readFileSync("src/minigames/any-given-morning/style.css", "utf8");
}
function die(): void { session.life!.deathAt = session.life!.elapsed + 0.05; frames(2800); }

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network call"); }));
  el = document.createElement("div"); document.body.append(el);
});
afterEach(() => {
  unmount?.(); unmount = undefined; el.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

describe("Any Given Morning browser mount", () => {
  it("keeps touch controls hidden outside coarse pointers and preserves 48px coarse targets", () => {
    mount();
    const style = el.querySelector("style")!;
    const rules = [...style.sheet!.cssRules];
    const touchRules = rules.filter((rule): rule is CSSStyleRule =>
      rule instanceof CSSStyleRule && rule.selectorText.split(",").some((selector) => selector.trim() === ".agm-touch"));
    expect(touchRules.length).toBeGreaterThan(0);
    for (const rule of touchRules) {
      if (rule.style.display) expect(rule.style.display).toBe("none");
    }
    const coarse = rules.find((rule): rule is CSSMediaRule =>
      rule instanceof CSSMediaRule && /\(pointer:\s*coarse\)/.test(rule.conditionText))!;
    const grid = [...coarse.cssRules].find((rule): rule is CSSStyleRule =>
      rule instanceof CSSStyleRule && rule.selectorText === ".agm-touch")!;
    expect(grid.style.display).toBe("grid");
    expect(grid.style.getPropertyValue("grid-template-columns")).toBe("repeat(3,48px) 1fr 56px");
    expect(grid.style.getPropertyValue("grid-template-rows")).toBe("48px 48px");
    const touch = el.querySelector<HTMLElement>(".agm-touch")!;
    expect(touch.hidden).toBe(true);
    get("start").click(); expect(touch.hidden).toBe(false);
    session.life!.deathAt = 0.05; frames(100);
    expect(state()).toBe("dying"); expect(touch.hidden).toBe(true);
    die(); expect(touch.hidden).toBe(true);
    const hidden = rules.find((rule): rule is CSSStyleRule =>
      rule instanceof CSSStyleRule && rule.selectorText.includes(".agm-touch[hidden]"))!;
    expect(hidden.style.display).toBe("none");
  });

  it("allows canvas scrolling except during play and dying", () => {
    mount();
    const rules = [...el.querySelector("style")!.sheet!.cssRules];
    const touchActions = rules.filter((rule): rule is CSSStyleRule =>
      rule instanceof CSSStyleRule && rule.selectorText.includes("canvas") && !!rule.style.getPropertyValue("touch-action"));
    expect(touchActions.map((rule) => [rule.selectorText, rule.style.getPropertyValue("touch-action")])).toEqual([
      [".agm canvas", "pan-y"],
      ['.agm[data-state="play"] canvas, .agm[data-state="dying"] canvas', "none"],
    ]);
  });

  it("fades the quiet first-life hint at six seconds and keeps it outside live announcements", () => {
    mount(); expect(get("first-life-hint").hidden).toBe(true);
    get("start").click();
    expect(get("first-life-hint").textContent).toBe("Someone nearby might need something.");
    expect(get("first-life-hint").hidden).toBe(false);
    expect(get("first-life-hint").closest("[aria-live]")).toBeNull();
    frames(5600); expect(Number(get("first-life-hint").style.opacity)).toBeLessThan(1);
    frames(600); expect(get("first-life-hint").hidden).toBe(true);
    die(); expect(get("dialogue").textContent).not.toContain(COPY.firstLifeHint);
    get("respawn").click(); expect(get("first-life-hint").hidden).toBe(true);
    key("Escape"); get("start").click(); expect(get("first-life-hint").hidden).toBe(false);
  });

  it("draws carried icons and removes them after giving or removing an item", () => {
    const commands: string[] = [];
    const ctx = new Proxy({}, { get: (_, name) => () => { commands.push(String(name)); }, set: () => true }) as CanvasRenderingContext2D;
    const sprites = { draw: vi.fn(), tile: vi.fn(), person: vi.fn(), dispose: vi.fn(), ready: Promise.resolve() };
    const life = startLife(createSession({ seed: 1, mortal: false }));
    for (let seed = 0; !life.world.npcs.some((npc) => npc.need === "hat"); seed++) life.world = generateArea(seed);
    const hat = life.world.items.find((item) => item.kind === "hat")!;
    Object.assign(life.player, hat); interact(life);
    drawCarriedItems(ctx, life, sprites, 100, 60);
    expect(sprites.draw.mock.calls.at(-1)?.slice(1)).toEqual(["hat", 95, 60, 8]);
    const farmer = life.world.npcs.find((npc) => npc.need === "hat")!;
    Object.assign(life.player, farmer); interact(life); chooseReply(life, 0);
    sprites.draw.mockClear(); drawCarriedItems(ctx, life, sprites, 100, 60);
    expect(sprites.draw.mock.calls.at(-1)?.[1]).toBe("seed");
    life.inventory.length = 0; sprites.draw.mockClear();
    life.inventory.push("apple", "stone", "letter", "grain", "water");
    drawCarriedItems(ctx, life, sprites, 100, 60);
    expect(sprites.draw.mock.calls.map((call) => call[1])).toEqual(["apple", "stone", "letter", "water_can"]);
    expect(sprites.tile.mock.calls[0].slice(1)).toEqual([74, 0, 0]);
    life.inventory.length = 0; sprites.draw.mockClear(); sprites.tile.mockClear();
    drawCarriedItems(ctx, life, sprites, 100, 60);
    expect(sprites.draw).not.toHaveBeenCalled(); expect(sprites.tile).not.toHaveBeenCalled();
  });
  it("works with null canvas, changes mortality and caption, and starts the selected mode", () => {
    mount();
    expect(state()).toBe("menu"); expect(get<HTMLInputElement>("mortality").checked).toBe(true);
    expect(el.textContent).toContain(COPY.mortalityOn);
    get("mortality").click();
    expect(el.textContent).toContain(COPY.mortalityOff); expect(session.state.mortal).toBe(false);
    get("start").click(); frames(100);
    expect(state()).toBe("play"); expect(session.life!.deathAt).toBeNull();
    expect(get("canvas").getAttribute("role")).toBe("img");
    expect(get("canvas").getAttribute("aria-label")).toContain("steps east");
    expect(document.activeElement).toBe(get("canvas"));
  });

  it("shows DYING, locks input, announces death and respawns with R", () => {
    mount(); get("start").click();
    session.life!.deathAt = 0.1; frames(250);
    expect(state()).toBe("dying"); const at = { ...session.life!.player };
    key("ArrowRight"); key("e"); frames(2600);
    expect(state()).toBe("dead"); expect(session.life!.player).toEqual(at);
    expect(get("dialogue").textContent).toContain("You lived");
    expect(el.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(el.textContent).toContain("Life 2 of 5");
    get("respawn").dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true }));
    expect(state()).toBe("play"); expect(session.life!.number).toBe(2);
    expect(session.state.history).toHaveLength(1);
  });

  it("ends five mortal lives in a ledger, preserves mode history and starts again", () => {
    mount(); get("start").click();
    for (let life = 0; life < 5; life++) { die(); expect(state()).toBe("dead"); get("respawn").click(); }
    expect(state()).toBe("ledger"); expect(el.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(el.querySelectorAll(".agm-life-card")).toHaveLength(5);
    el.querySelectorAll(".agm-life-card").forEach((card, i) => {
      expect(card.textContent).toContain(COPY.lifeNumber(i + 1, 5));
      expect(card.textContent).toContain(COPY.lived(session.state.history[i].seconds));
      expect(card.textContent).toContain(session.state.history[i].cause);
      expect(card.textContent).toContain(COPY.deedsHeading);
    });
    expect(el.textContent).toContain(COPY.reflectionTitle);
    expect(el.textContent).toContain(COPY.reflectionFeeling); expect(el.textContent).toContain(COPY.reflectionTime);
    expect(el.textContent).toContain(COPY.reflectionSwitch);
    get("mortality").click(); expect(session.state.mortal).toBe(true);
    get("again").click(); expect(state()).toBe("play");
    expect(session.state.mortal).toBe(false); expect(session.state.history).toHaveLength(0);
  });

  it("stays alive through one immortal minute and ends at 100 seconds", () => {
    mount(); get("mortality").click(); get("start").click(); frames(60100);
    expect(state()).toBe("play"); expect(session.life!.elapsed).toBeGreaterThan(60);
    frames(40100); expect(state()).toBe("ledger");
    expect(session.state.history[0].seconds).toBe(100); expect(session.state.history[0].died).toBe(false);
    expect(el.textContent).toContain(COPY.immortalMode);
  });

  it("moves smoothly, interacts through the polite region and returns to menu with Escape", () => {
    mount(); get("start").click(); const player = session.life!.player, before = player.x;
    key("d"); frames(200); expect(player.x).toBeGreaterThan(before);
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "d" })); frames(200);
    expect(player.vx).toBe(0);
    const npc = session.life!.world.npcs[0]; Object.assign(player, { x: npc.x, y: npc.y });
    key("e"); frames(50); expect(get("dialogue").textContent!.length).toBeGreaterThan(0);
    key("Escape"); expect(state()).toBe("menu"); expect(document.activeElement).toBe(get("start"));
  });

  it("shortens death in reduced motion and cancels every timer and listener on unmount", () => {
    mount(true); get("start").click(); session.life!.deathAt = 0.05; frames(1000);
    expect(state()).toBe("dead");
    const old = session, remove = vi.spyOn(window, "removeEventListener");
    unmount!(); unmount = undefined;
    expect(el.childNodes).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
    expect(remove.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining(["keyup", "blur"]));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" })); frames(5000);
    expect(old.state.lifeCount).toBe(1); expect(fetch).not.toHaveBeenCalled();
  });

  it("releases touch directions on cancellation and supports the keyboard A button", () => {
    const touch = document.createElement("div"); el.append(touch);
    const controls = bindInput(el, touch, () => "PLAY", vi.fn());
    const right = touch.querySelector('[data-direction="right"]')!;
    const event = (type: string) => { const e = new Event(type, { bubbles: true }); Object.defineProperty(e, "pointerId", { value: 1 }); right.dispatchEvent(e); };
    event("pointerdown"); expect(controls.read().x).toBe(1);
    event("pointercancel"); expect(controls.read().x).toBe(0);
    touch.querySelector<HTMLButtonElement>('[data-direction="interact"]')!.click();
    expect(controls.read().interact).toBe(true); expect(controls.read().interact).toBe(false);
    controls.dispose(); expect(touch.childNodes).toHaveLength(0);
  });

  it("ships 16px fallback grids and draws every death without random calls or timers", () => {
    for (const rows of Object.values(GRIDS)) { expect(rows).toHaveLength(16); rows.forEach((row) => expect(row).toHaveLength(16)); }
    const commands: string[] = [];
    const ctx = new Proxy({}, { get: (_, name) => () => { commands.push(String(name)); }, set: () => true }) as CanvasRenderingContext2D;
    const sprites = { tile: vi.fn(), draw: vi.fn(), person: vi.fn(), dispose: vi.fn(), ready: Promise.resolve() };
    const life = startLife(createSession({ seed: 1, mortal: true }));
    for (const death of DEATHS) {
      life.death = death; life.telegraph = true; life.round.screen = "PLAY"; life.elapsed = life.deathAt! - 0.2;
      drawEffects(ctx, life, sprites, false);
      life.round.screen = "DYING"; life.dyingElapsed = 1.5;
      drawEffects(ctx, life, sprites, false); drawEffects(ctx, life, sprites, true);
      expect(shake(life, true)).toEqual({ x: 0, y: 0 }); expect(playerPose(life).alpha).toBeGreaterThanOrEqual(0);
    }
    expect(commands.length).toBeGreaterThan(100);
    const library = createSprites(); library.draw(ctx, "alligator", 0, 0); library.dispose();
    expect(fetch).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
});


describe("Any Given Morning M4 controls", () => {
  it("opens the give menu with E, gives with a number, and keeps inventory accessible", () => {
    mount(); get("start").click();
    const life = session.life!;
    life.world = generateArea(4, [], "seaside");
    const npc = life.world.npcs.find((person) => person.archetype === "lighthouse_keeper")!;
    Object.assign(life.player, npc); take(life, "oil");
    key("e"); frames(50);
    expect(get("conversation").hidden).toBe(false);
    expect(get("conversation").textContent).toContain("Just talk");
    expect(get("inventory").textContent).toContain("Oil");
    key("1"); frames(50);
    expect(npc.done).toBe(true); expect(life.inventory).toEqual(["note"]);
    expect(get("inventory").textContent).toContain("Song sheet");
    expect(el.querySelectorAll("[data-mechanic]")).toHaveLength(0);
  });

  it("uses arrows and E for replies and accepts button taps for gifts or just talk", () => {
    mount(); get("mortality").click(); get("start").click();
    const life = session.life!; life.world = generateArea(4, [], "seaside");
    const npc = life.world.npcs[0]; Object.assign(life.player, npc);
    key("e"); frames(50); const first = life.dialogue;
    key("ArrowDown"); key("e"); frames(50);
    expect(life.dialogue).not.toBe(first); expect(npc.node).toBe(2);
    get("close-conversation").click(); take(life, "stone"); key("e"); frames(50);
    const talk = [...get("conversation").querySelectorAll("button")].find((button) => button.textContent!.includes("Just talk"))!;
    talk.click(); expect(life.conversation?.kind).toBe("talk");
    get("close-conversation").click(); key("e"); frames(50);
    get("conversation").querySelector<HTMLButtonElement>('[data-choice="0"]')!.click(); frames(50);
    expect(npc.wrongGifts).toBe(1); expect(life.inventory).toEqual([]);
    expect(life.deeds).toEqual([]);
  });

  it("shows finished and half-done quests in the ledger", () => {
    mount(); get("mortality").click(); get("start").click();
    const life = session.life!; life.world = generateArea(4, [], "seaside");
    life.world.npcs[0].quest = "finished"; life.world.npcs[1].quest = "delivery";
    frames(100100);
    expect(state()).toBe("ledger"); expect(el.textContent).toContain("Finished:"); expect(el.textContent).toContain("Half done:");
  });

  it("uses Fullscreen API and handles refusal with F and a window fill fallback", async () => {
    mount(); const root = get("any-given-morning");
    const request = vi.fn().mockRejectedValue(new Error("refused"));
    Object.defineProperty(root, "requestFullscreen", { value: request });
    get("fullscreen").click(); await Promise.resolve(); await Promise.resolve();
    expect(root.classList.contains("agm-full-window")).toBe(true); expect(request).toHaveBeenCalledOnce();
    key("f"); await Promise.resolve(); expect(root.classList.contains("agm-full-window")).toBe(false);
    request.mockResolvedValue(undefined);
    get("start").click(); key("f"); await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    expect(root.querySelectorAll("[data-mechanic]")).toHaveLength(0);
  });

  it("exits fallback full-window mode from DEAD and LEDGER with the same 44px toggle", async () => {
    mount(); const root = get("any-given-morning");
    Object.defineProperty(root, "requestFullscreen", { value: vi.fn().mockRejectedValue(new Error("refused")) });
    get("start").click(); get("fullscreen").click();
    await Promise.resolve(); await Promise.resolve();
    die(); expect(state()).toBe("dead"); expect(root.classList.contains("agm-full-window")).toBe(true);
    get("fullscreen").click(); await Promise.resolve();
    expect(root.classList.contains("agm-full-window")).toBe(false);
    for (let life = 1; life < 5; life++) { get("respawn").click(); die(); }
    get("fullscreen").click(); await Promise.resolve(); await Promise.resolve();
    get("respawn").click(); expect(state()).toBe("ledger");
    expect(root.classList.contains("agm-full-window")).toBe(true);
    const toggle = get("fullscreen");
    expect(getComputedStyle(toggle).minHeight).toBe("44px");
    expect(getComputedStyle(toggle).minWidth).toBe("44px");
    toggle.click(); await Promise.resolve();
    expect(root.classList.contains("agm-full-window")).toBe(false);
  });
});
