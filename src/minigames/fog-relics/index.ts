import { h } from '../../lib/dom';
import type { Minigame } from '../types';
import { LIMIT, MAPS, move, newGame, visible, type Direction } from './game';
import './style.css';

function mount(el: HTMLElement): () => void {
  let state = newGame(), fog = true, changed = false;
  const toggle = h('input', { type: 'checkbox', 'data-mechanic': 'discovery-fog' });
  toggle.checked = true;
  const board = h('div', { class: 'fb-board', role: 'group', 'aria-label': 'Expedition map' });
  const stats = h('p', { class: 'fb-stats' });
  const message = h('p', { role: 'status', 'aria-live': 'polite', class: 'fb-message' });
  const reflection = h('div', { class: 'fb-reflection', hidden: true });
  const history = h('div', { class: 'fb-history' });
  const controls = h('div', { class: 'fb-controls', 'aria-label': 'Movement controls' });
  const buttons: HTMLButtonElement[] = [];
  function step(direction: Direction) {
    const previous = state;
    state = move(state, direction);
    render();
    if (state === previous && state.status === 'playing') message.textContent = 'Blocked. Try another direction; no step used.';
    if (previous.status === 'playing' && state.status !== 'playing') {
      history.prepend(h('p', {}, `Map ${state.map + 1} · ${changed ? 'mixed visibility' : fog ? 'fog on' : 'fog off'} · ${state.steps} moves · ${state.revisits} revisits · ${state.collected.length}/3 relics · ${state.status === 'won' ? 'returned home' : 'expedition ended'}`));
    }
  }
  for (const [direction, label] of [['up','↑ North'],['left','← West'],['down','↓ South'],['right','→ East']] as [Direction,string][]) {
    const button = h('button', { type: 'button', 'aria-label': `Move ${direction}` }, label);
    button.addEventListener('click', () => step(direction)); controls.append(button); buttons.push(button);
  }
  const reset = h('button', { type: 'button' }, 'Restart this map');
  reset.addEventListener('click', () => { state = newGame(state.map); changed = false; render(); });
  const next = h('button', { type: 'button' }, 'Try other map');
  next.addEventListener('click', () => { state = newGame(1 - state.map); changed = false; render(); });
  toggle.addEventListener('change', () => { fog = toggle.checked; if (state.steps > 0) changed = true; render(); });
  const root = h('section', { class: 'fog-relics', 'aria-label': 'Fog Relics discovery game' },
    h('div', { class: 'fb-heading' }, h('span', { class: 'tag' }, 'A small expedition / Discovery'), h('p', {}, 'Find three relics. Bring them home. What lies beyond your lantern?')),
    h('label', { class: 'fb-toggle' }, toggle, ' Exploration fog'),
    h('p', { class: 'fb-hint' }, 'On: discover nearby tiles as you move. Off: see the whole map. Only visibility changes.'),
    stats, board, h('p', { class: 'fb-legend' }, '● You   ⌂ Home   ◇ Relic   ▧ Rock   ? Unknown'), message, controls,
    h('p', { class: 'fb-hint' }, 'Use the buttons, arrow keys or WASD while focused inside this game. Walls cost no moves.'),
    h('div', { class: 'fb-actions' }, reset, next), reflection,
    h('details', {}, h('summary', {}, 'Compare your expeditions'), h('p', {}, 'Play fog ON first. Then turn it OFF and try the other map. The maps are mirrored, so learning may still affect your second round. Records stay only until you leave this page.'), history));
  function render() {
    const layout = MAPS[state.map];
    stats.textContent = `MAP ${state.map + 1} / ${fog ? 'FOG ON' : 'FOG OFF'}   •   ${state.collected.length}/3 RELICS   •   ${state.steps}/${LIMIT} MOVES`;
    board.replaceChildren();
    for (let cell = 0; cell < 25; cell++) {
      let symbol = '·', kind = 'path', name = 'Open path';
      if (!visible(state, cell, fog)) { symbol = '?'; kind = 'unknown'; name = 'Unexplored'; }
      else if (layout.walls.includes(cell)) { symbol = '▧'; kind = 'wall'; name = 'Rock'; }
      else if (cell === layout.home) { symbol = '⌂'; kind = 'home'; name = 'Home'; }
      else if (layout.relics.includes(cell) && !state.collected.includes(cell)) { symbol = '◇'; kind = 'relic'; name = 'Relic'; }
      if (cell === state.position) { symbol = '●'; kind = 'player'; name = cell === layout.home ? 'You at home' : 'You'; }
      board.append(h('div', { class: `fb-cell fb-${kind}`, role: 'img', 'aria-label': `Row ${Math.floor(cell / 5) + 1}, column ${cell % 5 + 1}: ${name}` }, symbol));
    }
    message.textContent = state.status === 'won' ? 'Expedition complete. All three relics are home.' : state.status === 'ended' ? 'Expedition ended. What did you discover?' : state.collected.length === 3 ? 'All relics found. Return to ⌂ home.' : `Explore the island. ${3 - state.collected.length} relics still to find.`;
    for (const button of buttons) button.disabled = state.status !== 'playing';
    reflection.hidden = state.status === 'playing';
    if (!reflection.hidden) reflection.replaceChildren(h('h4', {}, 'Pause and reflect'), h('p', {}, 'What did you feel? How did you choose your route? Did changing the fog change your curiosity, frustration, or desire to explore?'), h('p', {}, `${state.revisits} revisits this round. Revisits describe your route; they are not a score for curiosity.`));
  }
  const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target instanceof HTMLInputElement) return;
    const direction = keys[event.key];
    if (direction) { event.preventDefault(); step(direction); }
  };
  root.addEventListener('keydown', onKey);
  render(); el.append(root);
  return () => { root.removeEventListener('keydown', onKey); root.remove(); };
}
export const fogRelics: Minigame = { slug: 'fog-relics', title: 'Fog Relics', motivators: ['discovery'], author: 'Hanxuan1003', mount };
