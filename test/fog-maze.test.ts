// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAP, move, newGame, tile, type Direction } from '../src/minigames/fog-maze/game';
import { fogMaze } from '../src/minigames/fog-maze';

describe('Fog maze', () => {
  it('blocks walls, reveals adjacent tiles, and retains exploration', () => {
    const start = newGame();
    expect(move(start, 'up')).toBe(start);
    const next = move(start, 'right');
    expect(next.steps).toBe(1);
    expect(next.seen).toEqual(expect.arrayContaining(start.seen));
    expect(next.seen).toContain(12);
    expect(start.seen).not.toContain(12);
  });

  it('has reachable landmarks and an exit that requires all three', () => {
    function route(from: number, target: string): Direction[] {
      const queue: { position: number; path: Direction[] }[] = [{ position: from, path: [] }];
      const visited = new Set([from]);
      while (queue.length) {
        const current = queue.shift()!;
        if (tile(current.position) === target) return current.path;
        for (const [direction, offset] of Object.entries({ up: -9, down: 9, left: -1, right: 1 })) {
          const position = current.position + offset;
          if (tile(position) !== '#' && !visited.has(position)) {
            visited.add(position);
            queue.push({ position, path: [...current.path, direction as Direction] });
          }
        }
      }
      throw new Error(`Unreachable ${target}`);
    }
    expect(MAP.every(row => row.length === 9)).toBe(true);
    let state = newGame();
    for (const direction of route(state.position, 'E')) state = move(state, direction);
    expect(state.won).toBe(false);
    for (const target of ['A', 'B', 'C', 'A', 'E']) {
      for (const direction of route(state.position, target)) state = move(state, direction);
    }
    expect(state.collected).toHaveLength(3);
    expect(state.won).toBe(true);
    expect(move(state, 'left')).toBe(state);
  });

  it('supports buttons, keyboard, fog switching, replay, and cleanup', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const cleanup = fogMaze.mount(host);
    const fog = host.querySelector<HTMLInputElement>('input')!;
    const east = host.querySelector<HTMLButtonElement>('[data-direction="right"]')!;
    east.click();
    east.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(host.querySelector('[role="status"]')!.textContent).toContain('2 steps');
    expect(host.querySelectorAll('.unknown').length).toBeGreaterThan(0);
    fog.checked = false;
    fog.dispatchEvent(new Event('change'));
    expect(host.querySelectorAll('.unknown')).toHaveLength(0);
    expect(host.querySelector('[role="status"]')!.textContent).toContain('2 steps');
    [...host.querySelectorAll('button')].find(button => button.textContent === 'Replay this maze')!.click();
    expect(host.querySelector('[role="status"]')!.textContent).toContain('0 steps');
    expect(fog.checked).toBe(false);
    cleanup();
    expect(host.childNodes).toHaveLength(0);
    host.remove();
  });
});
