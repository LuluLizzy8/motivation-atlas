import { h } from '../../lib/dom';
import type { Minigame } from '../types';
import { BOARD, RELICS, LIMIT, create, step, visible, finished, won, type Direction } from './game';
import './style.css';

function mount(el: HTMLElement): () => void {
  let state = create();
  const fog = h('input', { type: 'checkbox', 'data-mechanic': 'fog-of-war' });
  fog.checked = true;
  const status = h('p', { role: 'status', 'aria-live': 'polite' });
  const board = h('div', { class: 'circuit-board', 'aria-label': 'Circuit map' });
  const controls = h('div', { class: 'circuit-controls' });
  const buttons: HTMLButtonElement[] = [];
  const root = h('section', { class: 'relic-circuit', 'aria-label': 'Relic Circuit' },
    h('label', {}, fog, ' Fog of war: reveal nearby tiles as you move'),
    h('p', {}, 'Deliver 3 relics (*) to camp (C) within 36 moves. Carry only one at a time: return to camp to unload before collecting another. You are @. Walls are #; unexplored tiles are ?. Use direction buttons or arrow keys while the game is focused.'),
    board, status, controls,
  );
  const reflection = h('p', {}, 'After each round: what did you feel? Did revealing the map change your route, curiosity, or sense of surprise? Try both settings; your experience may differ from the source.');
  const reset = h('button', { type: 'button' }, 'Restart same circuit');
  reset.addEventListener('click', () => { state = create(); render(); });
  root.append(reset, reflection);
  function move(direction: Direction): void { state = step(state, direction); render(); }
  for (const direction of ['up', 'left', 'down', 'right'] as Direction[]) {
    const button = h('button', { type: 'button' }, direction[0].toUpperCase() + direction.slice(1));
    button.addEventListener('click', () => move(direction));
    buttons.push(button); controls.append(button);
  }
  root.addEventListener('keydown', event => {
    const direction = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as const)[event.key as 'ArrowUp'];
    if (direction && event.target !== fog) { event.preventDefault(); move(direction); }
  });
  fog.addEventListener('change', render);
  function render(): void {
    board.replaceChildren();
    for (let i = 0; i < 25; i++) {
      const shown = visible(state, i, fog.checked);
      const symbol = !shown ? '?' : state.position === i ? '@' : i === 0 ? 'C' : BOARD[Math.floor(i / 5)][i % 5] === '#' ? '#' : RELICS.includes(i) && !state.collected.includes(i) ? '*' : '·';
      const name = ({ '?': 'unexplored', '@': 'you', C: 'camp', '#': 'wall', '*': 'relic', '·': 'path' })[symbol];
      board.append(h('span', { class: `circuit-cell${shown ? '' : ' circuit-hidden'}`, 'aria-label': `Row ${Math.floor(i / 5) + 1}, column ${i % 5 + 1}: ${name}` }, symbol));
    }
    status.textContent = `${state.delivered.length}/3 delivered · ${state.moves}/${LIMIT} moves. ${won(state) ? 'Home with every relic! Round complete.' : finished(state) ? 'Nightfall! Round complete. Restart to try another route.' : state.carrying !== null ? 'Carrying 1 relic — return to camp to unload. Other relics stay on the map until your bag is empty.' : 'Bag empty — find your next relic.'}`;
    for (const button of buttons) button.disabled = finished(state);
  }
  render(); el.append(root);
  return () => root.remove();
}
export const relicCircuit: Minigame = { slug: 'relic-circuit', title: 'Relic Circuit', motivators: ['discovery'], author: 'nc3244', mount };
