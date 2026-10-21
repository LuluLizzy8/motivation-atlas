// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createGame, move, isVisible, canEnter, key, same, WIDTH, HEIGHT, START, SAILOR, SNAKE, LANDING, CROCODILE, SCENES, FISH, PLANTS, SIGNS, signAt, isWater, CAMERA_ROWS, cameraTop, type Game, type Point, type Direction } from '../src/minigames/glyph-adventure/game';
import { glyphAdventure } from '../src/minigames/glyph-adventure';
const steps: [Direction, number, number][] = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]];
function route(from: Point, to: Point): Direction[] {
  const queue: { p: Point; path: Direction[] }[] = [{ p: from, path: [] }];
  const seen = new Set([key(from)]);
  for (let i = 0; i < queue.length; i++) {
    const { p, path } = queue[i];
    if (same(p, to)) return path;
    for (const [direction, dx, dy] of steps) {
      const next = { x: p.x + dx, y: p.y + dy };
      if (!canEnter(next) || seen.has(key(next))) continue;
      seen.add(key(next)); queue.push({ p: next, path: [...path, direction] });
    }
  }
  throw Error(`Unreachable destination ${key(to)}`);
}
function travel(state: Game, to: Point): Game {
  return route(state.position, to).reduce((s, direction) => move(s, direction), state);
}

describe('glyph-adventure rules', () => {
  it('Fog and mist hide distant signs, reveal nearby spaces, and remember exploration', () => {
    let fog = createGame(true);
    const clear = createGame(false);
    expect(isVisible(fog, SAILOR)).toBe(false);
    expect(isVisible(clear, SAILOR)).toBe(true);
    const firstView = [...fog.explored];
    fog = travel(fog, SAILOR);
    expect(isVisible(fog, SAILOR)).toBe(true);
    for (const p of firstView) expect(fog.explored).toContain(p);
    // The toggle changes information, not the river or rescue rules.
    const directions = route(clear.position, SAILOR);
    const clearAtSailor = directions.reduce((s, d) => move(s, d), clear);
    expect(clearAtSailor.position).toEqual(fog.position);
    expect(clearAtSailor.moves).toBe(fog.moves);
    expect(clearAtSailor.passenger).toBe(true);
  });
  it('finds six different fish by approaching them, without counting repeat visits', () => {
    for (const fog of [true, false]) {
      let state = createGame(fog);
      expect(state.fishFound).toHaveLength(0);
      for (const fish of FISH) {
        state = travel(state, fish.point);
        expect(state.fishFound).toContain(fish.sign);
      }
      expect(state.fishFound).toHaveLength(6);
      state = travel(state, FISH[0].point);
      expect(state.fishFound).toHaveLength(6);
      expect(createGame(fog).fishFound).toHaveLength(0);
    }
  });
  it('records plants only when approached and resets their collection with a new voyage', () => {
    for (const fog of [true, false]) {
      let state = createGame(fog);
      expect(state.plantsFound).toHaveLength(0);
      state = travel(state, { x: 1, y: 6 });
      expect(state.plantsFound).toContain('lotusPool');
      const found = [...state.plantsFound];
      state = travel(state, { x: 1, y: 5 });
      state = travel(state, { x: 1, y: 6 });
      for (const sign of found) expect(state.plantsFound).toContain(sign);
      expect(new Set(state.plantsFound).size).toBe(state.plantsFound.length);
      for (const plant of PLANTS) {
        const neighbors: Point[] = [];
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
          if (canEnter({ x, y }) && Math.abs(x - plant.point.x) + Math.abs(y - plant.point.y) <= 2) neighbors.push({ x, y });
        }
        expect(neighbors.length).toBeGreaterThan(0);
        state = travel(state, neighbors[0]);
        expect(state.plantsFound).toContain(plant.sign);
      }
      expect(state.plantsFound).toHaveLength(PLANTS.length);
      expect(createGame(fog).plantsFound).toHaveLength(0);
    }
  });
  it('plants retain their underlying water or land movement rules', () => {
    const state = createGame(false);
    expect(PLANTS.some((p) => isWater(p.point))).toBe(true);
    expect(PLANTS.some((p) => !isWater(p.point))).toBe(true);
    for (const plant of PLANTS) {
      expect(signAt(state, plant.point)).toBe(plant.sign);
      expect(canEnter(plant.point)).toBe(isWater(plant.point));
    }
    expect(SIGNS.water.gardiner).toBe('N35A');
    expect(SIGNS.bank.gardiner).toBe('N19');
  });
  it('describes fish, water plants, and the turtle when the boat enters their squares', () => {
    let state = createGame();
    for (const fish of FISH) {
      state = travel(state, fish.point);
      expect(state.message.toLowerCase()).toContain(SIGNS[fish.sign].name.toLowerCase());
    }
    for (const plant of PLANTS.filter((p) => isWater(p.point))) {
      state = travel(state, plant.point);
      expect(state.message.toLowerCase()).toContain(SIGNS[plant.sign].name);
    }
    state = travel(state, { x: 11, y: 6 });
    expect(state.message).toContain('turtle');
    state = travel(state, { x: 5, y: 6 });
    const blocked = move(state, 'east');
    expect(blocked.position).toEqual(state.position);
    expect(blocked.message).toContain('papyrus clump');
    expect(blocked.message).toContain('cannot pass onto land');
  });
  it('shifts the lower river left, keeps the right edge land, and places I15 beside the sailor', () => {
    const state = createGame(false);
    expect(START).toEqual({ x: 2, y: 15 });
    expect(SAILOR).toEqual({ x: 10, y: 13 });
    expect(SNAKE).toEqual({ x: SAILOR.x + 1, y: SAILOR.y + 1 });
    expect(signAt(state, SNAKE)).toBe('snake');
    expect(SIGNS.snake.gardiner).toBe('I15');
    for (let y = HEIGHT - 8; y < HEIGHT; y++) {
      expect(signAt(state, { x: WIDTH - 1, y })).toBe('bank');
      expect(isWater({ x: WIDTH - 1, y })).toBe(false);
    }
    const besideSnake = travel(state, { x: SAILOR.x, y: SNAKE.y });
    expect(move(besideSnake, 'east').message).toBe('A giant serpent of 30 cubits, where his beard alone is two cubits. His body is covered in gold and eyebrows of lapis.');
    expect(move(besideSnake, 'east').position).toEqual(besideSnake.position);
  });
  it('banks and the crocodile block movement without spending moves', () => {
    const start = createGame();
    expect(move(start, 'west').position).toEqual(start.position);
    const nearCroc = travel(start, { x: CROCODILE.x - 1, y: CROCODILE.y });
    const blocked = move(nearCroc, 'east');
    expect(blocked.position).toEqual(nearCroc.position);
    expect(blocked.moves).toBe(nearCroc.moves);
    expect(blocked.message).toContain('crocodile');
    expect(canEnter({ x: -1, y: 0 })).toBe(false);
    expect(canEnter({ x: WIDTH, y: HEIGHT })).toBe(false);
  });
  it('the landing only finishes the voyage after rescuing the sailor', () => {
    for (const fog of [true, false]) {
      let state = travel(createGame(fog), LANDING);
      expect(state.won).toBe(false);
      state = travel(state, SAILOR);
      expect(state.passenger).toBe(true);
      state = travel(state, LANDING);
      expect(state.won).toBe(true);
      expect(move(state, 'south')).toBe(state);
    }
  });
  it('every scene can be approached, including a route around the crocodile', () => {
    let state = createGame();
    for (const scene of SCENES) {
      state = travel(state, scene.id === 'crocodile' ? { x: CROCODILE.x - 1, y: CROCODILE.y } : scene.point);
      expect(state.discoveries).toContain(scene.id);
    }
    expect(state.won).toBe(true);
    expect(new Set(state.discoveries).size).toBe(SCENES.length);
  });
});

describe('glyph-adventure interface', () => {
  it('tracks only eleven vertical rows and clamps to the map edges', () => {
    expect(cameraTop(0)).toBe(0);
    expect(cameraTop(8)).toBe(3);
    expect(cameraTop(HEIGHT - 1)).toBe(HEIGHT - CAMERA_ROWS);
    const host = document.createElement('div');
    const unmount = glyphAdventure.mount(host);
    const board = host.querySelector<HTMLElement>('[role=grid]')!;
    const firstRow = () => Number(board.querySelector('[role=row]')!.getAttribute('aria-rowindex'));
    expect(board.querySelectorAll('[role=row]')).toHaveLength(CAMERA_ROWS);
    expect(board.querySelectorAll('[role=gridcell]')).toHaveLength(CAMERA_ROWS * WIDTH);
    expect(firstRow()).toBe(7);
    for (const direction of route(START, { x: 3, y: 3 })) host.querySelector<HTMLButtonElement>(`[data-direction="${direction}"]`)!.click();
    expect(firstRow()).toBe(1);
    expect(board.querySelector('.glyph-boat')!.getAttribute('data-y')).toBe('3');
    expect(board.querySelectorAll('[role=gridcell]')).toHaveLength(CAMERA_ROWS * WIDTH);
    unmount();
  });
  it('conceals hidden labels, supports focused arrow keys, resets the mode, and unmounts', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const unmount = glyphAdventure.mount(host);
    const board = host.querySelector<HTMLElement>('[role=grid]')!;
    const sailor = () => host.querySelector<HTMLElement>(`[data-x="${SAILOR.x}"][data-y="${SAILOR.y}"]`)!;
    expect(host.querySelectorAll('.glyph-legend > span')).toHaveLength(5);
    expect(host.textContent).not.toContain('Voyage journal');
    expect(host.querySelector('details')).toBeNull();
    expect(host.textContent).toContain('Plants along the river');
    expect(host.textContent).toContain('Fish in the river');
    expect(host.querySelectorAll('.glyph-collection-slot')).toHaveLength(17);
    expect(host.querySelectorAll('.glyph-undiscovered')).toHaveLength(17);
    expect(sailor().textContent).toBe('·');
    expect(sailor().getAttribute('aria-label')).not.toContain('sailor');
    expect(sailor().title).toBe('fog and mist');
    board.focus();
    board.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(host.querySelector('.glyph-progress')!.textContent).toContain('1 moves');
    const toggle = host.querySelector<HTMLInputElement>('[data-mechanic]')!;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(sailor().textContent).toBe('𓀌');
    expect(host.querySelector('.glyph-progress')!.textContent).toContain('0 moves');
    const routeToPool = route(START, { x: 1, y: 6 });
    for (const direction of routeToPool) host.querySelector<HTMLButtonElement>(`[data-direction="${direction}"]`)!.click();
    const collectedLotus = host.querySelector<HTMLElement>('[aria-label="Discovered plants"] .glyph-lotusPool')!;
    expect(collectedLotus.textContent).toBe(SIGNS.lotusPool.glyph);
    expect(collectedLotus.title).toContain('Lotus flowers');
    expect(collectedLotus.tabIndex).toBe(0);
    expect(host.querySelector('.glyph-undiscovered')!.hasAttribute('title')).toBe(false);
    expect(host.querySelectorAll('.glyph-undiscovered').length).toBeLessThan(17);
    host.querySelector<HTMLButtonElement>('.glyph-toolbar button')!.click();
    expect(host.querySelectorAll('.glyph-undiscovered')).toHaveLength(17);
    // Arrow keys on the checkbox must retain their native behavior.
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(host.querySelector('.glyph-progress')!.textContent).toContain('0 moves');
    unmount();
    expect(host.childNodes).toHaveLength(0);
    host.remove();
  });
});
