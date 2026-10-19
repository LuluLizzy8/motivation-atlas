// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAPS, LIMIT, move, newGame, visible, type Direction } from '../src/minigames/fog-relics/game';
import { fogRelics } from '../src/minigames/fog-relics';

describe('Fog Relics', () => {
  it('changes only visibility: hidden tiles are revealed progressively and retained', () => {
    const state = newGame();
    expect(visible(state, 0, true)).toBe(false);
    expect(visible(state, 0, false)).toBe(true);
    let next = state;
    for (let i = 0; i < 4; i++) next = move(next, 'up');
    expect(visible(next, 0, true)).toBe(true);
    expect(visible(next, 20, true)).toBe(true);
    expect(state.steps).toBe(0);
    expect(state.collected).toEqual([]);
    expect(next.collected).toEqual([0]);
  });
  it('blocks rocks and map edges without spending moves', () => {
    const s = newGame();
    expect(move(s, 'left')).toBe(s);
    expect(move(s, 'down')).toBe(s);
    const above = move(s, 'up');
    expect(move(above, 'right')).toBe(above);
  });
  it('collects once, wins only on returning home, and stops after a win on both maps', () => {
    const route: Direction[] = [...Array(4).fill('up'), ...Array(4).fill('right'), ...Array(4).fill('down'), ...Array(4).fill('left')];
    for (const map of [0, 1]) {
      let s = newGame(map);
      for (const [i, d] of route.entries()) {
        s = move(s, map === 1 ? d === 'left' ? 'right' : d === 'right' ? 'left' : d : d);
        if (i < route.length - 1) expect(s.status).toBe('playing');
      }
      expect(s.status).toBe('won'); expect(s.collected.length).toBe(3); expect(s.steps).toBe(16);
      expect(move(s, 'up')).toBe(s);
    }
  });
  it('ends at the move limit and never duplicates a relic', () => {
    let s = newGame();
    for (let i = 0; i < LIMIT; i++) s = move(s, i % 2 === 0 ? 'right' : 'left');
    expect(s.status).toBe('ended'); expect(s.steps).toBe(LIMIT); expect(move(s,'up')).toBe(s);
    s = newGame();
    for (let i = 0; i < 4; i++) s = move(s,'up');
    s = move(move(s,'right'),'left'); expect(s.collected).toEqual([0]);
  });
  it('does not leak hidden contents in accessible labels and toggles without resetting progress', () => {
    const el = document.createElement('div'); document.body.append(el); const clean = fogRelics.mount(el);
    expect(el.querySelectorAll('.fb-relic').length).toBe(0);
    const toggle = el.querySelector('input')!;
    toggle.click(); expect(el.querySelectorAll('.fb-relic').length).toBe(3);
    const button = el.querySelector<HTMLButtonElement>('[aria-label="Move up"]')!;
    button.click(); expect(el.querySelector('.fb-stats')!.textContent).toContain('1/40');
    toggle.click(); expect(el.querySelector('.fb-stats')!.textContent).toContain('1/40');
    button.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp',bubbles:true}));
    expect(el.querySelector('.fb-stats')!.textContent).toContain('2/40');
    clean(); expect(el.childNodes.length).toBe(0); el.remove();
  });
});
