// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { create, step, visible, won, finished, type Direction } from '../src/minigames/relic-circuit/game';
import { relicCircuit } from '../src/minigames/relic-circuit';
describe('Relic Circuit', () => {
  it('hides distant tiles, reveals neighbors, and remembers exploration', () => {
    const initial = create();
    expect(visible(initial, 4, true)).toBe(false);
    expect(visible(initial, 4, false)).toBe(true);
    const moved = step(step(step(initial, 'right'), 'right'), 'right');
    expect(visible(moved, 4, true)).toBe(true);
    expect(visible(step(moved, 'left'), 4, true)).toBe(true);
    expect(initial.seen).toEqual([0, 1, 5]);
  });
  it('blocks walls without spending moves and supports a winning route', () => {
    expect(step(create(), 'up').moves).toBe(0);
    expect(step(step(create(), 'right'), 'down').moves).toBe(1);
    let state = create();
    const route = [...Array(4).fill('right'), ...Array(4).fill('left'), 'right', 'right', 'down', 'down', 'up', 'up', 'left', 'left', ...Array(4).fill('down'), ...Array(4).fill('up')] as Direction[];
    for (const direction of route) state = step(state, direction);
    expect(state.delivered.length).toBe(3);
    expect(won(state)).toBe(true);
    expect(step(state, 'right')).toBe(state);
    expect(finished({ ...create(), moves: 36 })).toBe(true);
  });
  it('carries only one relic and deposits it only at camp', () => {
    let state = create();
    for (const direction of ['right','right','right','right','left','left','down','down'] as Direction[]) state = step(state, direction);
    expect(state.carrying).toBe(4);
    expect(state.delivered).toEqual([]);
    expect(state.collected).toEqual([4]);
    for (const direction of ['up','up','left','left'] as Direction[]) state = step(state, direction);
    expect(state.carrying).toBeNull();
    expect(state.delivered).toEqual([4]);
    expect(won(state)).toBe(false);
  });
  it('toggle reveals the map without changing progress and restart restores fog', () => {
    const el = document.createElement('div');
    const cleanup = relicCircuit.mount(el);
    const toggle = el.querySelector('input')!;
    expect(el.querySelectorAll('.circuit-hidden').length).toBe(22);
    const before = el.querySelector('[role=status]')!.textContent;
    toggle.checked = false; toggle.dispatchEvent(new Event('change'));
    expect(el.querySelectorAll('.circuit-hidden').length).toBe(0);
    expect(el.querySelector('[role=status]')!.textContent).toBe(before);
    toggle.checked = true; toggle.dispatchEvent(new Event('change'));
    expect(el.querySelectorAll('.circuit-hidden').length).toBe(22);
    cleanup(); expect(el.childNodes.length).toBe(0);
  });
});
