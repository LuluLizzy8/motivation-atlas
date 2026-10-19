// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { choose, forest, FORKS, reveal, start, tick } from '../src/minigames/fork/game';
import { fork } from '../src/minigames/fork';
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const paths = forest(() => 0)[0];
it('fog hides outcomes while switching it off reveals the same path', () => {
  expect(reveal(paths[1], true, 0)).toBe('Destination hidden by fog');
  expect(reveal(paths[1], false, 0)).toContain('Creature tracks');
});
it('danger starts and accelerates pursuit; safety restores time and slows it', () => {
  const danger = choose(start(), paths[1]);
  expect(danger.chasing).toBe(true);
  expect(danger.time).toBe(16);
  expect(tick(danger, 2).time).toBe(13);
  const safe = choose(danger, paths[0]);
  expect(safe.time).toBe(21);
  expect(safe.speed).toBe(1);
  expect(tick(start(), 100).status).toBe('playing');
  expect(tick(danger, 100).status).toBe('lost');
});
it('safe paths reach home and terminal states cannot change', () => {
  let state = start();
  for (let i = 0; i < FORKS; i++) state = choose(state, paths[0]);
  expect(state.status).toBe('won');
  expect(tick(state, 100)).toEqual(state);
  expect(choose(state, paths[1])).toEqual(state);
  const final = { ...start(), step: FORKS - 1 };
  expect(choose(final, paths[1]).step).toBe(FORKS - 1);
  expect(choose(final, paths[1]).status).toBe('playing');
});
it('plays with buttons, reveals paths immediately, and clears its timer', () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const el = document.createElement('div');
  document.body.append(el);
  const unmount = fork.mount(el);
  el.querySelector<HTMLInputElement>('input')!.click();
  expect(el.textContent).toContain('Creature tracks');
  el.querySelector<HTMLButtonElement>('[data-path="1"]')!.click();
  expect(el.querySelector('[role="timer"]')!.textContent).toContain('16 seconds');
  unmount();
  expect(el.childNodes.length).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  el.remove();
});
