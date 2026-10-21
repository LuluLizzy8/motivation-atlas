import { h } from '../../lib/dom';
import type { Minigame } from '../types';
import { createGame, move, isVisible, signAt, SIGNS, SCENES, FISH, PLANTS, WIDTH, HEIGHT, CAMERA_ROWS, cameraTop, PLANT_DESCRIPTIONS, type Direction, type Sign } from './game';
import './glyph-adventure.css';

function mount(el: HTMLElement): () => void {
  let state = createGame();
  const fog = h('input', { type: 'checkbox', checked: true, 'data-mechanic': 'fog-and-mist' });
  const restart = h('button', { type: 'button' }, 'New voyage');
  const status = h('p', { role: 'status', class: 'glyph-status' });
  const progress = h('p', { class: 'glyph-progress' });
  const board = h('div', { class: 'glyph-board', role: 'grid', tabindex: 0,
    'aria-label': 'River map. Use arrow keys to steer your boat, or use the direction buttons above.',
    'aria-rowcount': HEIGHT, 'aria-colcount': WIDTH });
  const plantGlyphs = h('div', { class: 'glyph-collection', 'aria-label': 'Discovered plants' });
  const fishGlyphs = h('div', { class: 'glyph-collection', 'aria-label': 'Discovered fish' });
  const reflection = h('div', { class: 'glyph-reflection', hidden: true },
    h('h4', {}, 'Then check it against your own play'),
    h('p', {}, 'What did you feel at a fork in the river? Did Fog and mist change your curiosity, route, or sense of adventure? Try the other setting. A familiar river will naturally hold fewer surprises.'),
  );
  const controls = h('div', { class: 'glyph-controls', 'aria-label': 'Steer the boat' });
  const directions: [Direction, string][] = [['north', '↑'], ['west', '←'], ['south', '↓'], ['east', '→']];
  const buttons = directions.map(([direction, label]) => {
    const button = h('button', { type: 'button', class: `glyph-${direction}`, 'data-direction': direction, 'aria-label': `Move ${direction}` }, label);
    button.addEventListener('click', () => steer(direction));
    controls.append(button);
    return button;
  });
  const legend = h('div', { class: 'glyph-legend' }, ...(['boat', 'water', 'bank', 'sailor', 'landing'] as const).map((id) =>
    h('span', {}, h('span', { class: `glyph-symbol glyph-${id}`, 'aria-hidden': true }, SIGNS[id].glyph), id === 'landing' ? ' house' : ` ${SIGNS[id].name}`)));
  const root = h('section', { class: 'glyph-adventure', 'aria-label': 'glyph-adventure' },
    h('div', { class: 'glyph-toolbar' }, h('label', {}, fog, ' Fog and mist'), restart),
    h('p', { class: 'glyph-hint' }, 'Find the shipwrecked sailor. Bring them to the landing house. Arrow keys, direction buttons, or tap a neighboring square.'),
    progress, controls, board, status, legend,
    h('section', { class: 'glyph-collection-section' }, h('h4', {}, 'Plants along the river'), plantGlyphs),
    h('section', { class: 'glyph-collection-section' }, h('h4', {}, 'Fish in the river'), fishGlyphs),
    reflection,
  );
  function steer(direction: Direction) { state = move(state, direction); render(); }
  function render() {
    progress.textContent = `${state.passenger ? 'Sailor aboard' : 'Searching for the sailor'} · ${state.moves} moves · ${state.discoveries.length}/${SCENES.length} places discovered`;
    status.textContent = state.message;
    const top = cameraTop(state.position.y);
    board.replaceChildren(...Array.from({ length: CAMERA_ROWS }, (_, row) => {
      const y = top + row;
      return h('div', { role: 'row', class: 'glyph-row', 'aria-rowindex': y + 1 }, ...Array.from({ length: WIDTH }, (_, x) => {
        const point = { x, y };
        const visible = isVisible(state, point);
        const sign = visible ? signAt(state, point) : null;
        const name = sign ? SIGNS[sign].name : 'fog and mist';
        return h('span', { role: 'gridcell', class: `glyph-cell ${sign ? `glyph-${sign}` : 'glyph-mist'}${sign && FISH.some((f) => f.sign === sign) ? ' glyph-fish-kind' : ''}${sign && PLANTS.some((p) => p.sign === sign) ? ' glyph-plant' : ''}`,
          'aria-label': `Row ${y + 1}, column ${x + 1}: ${name}${sign === 'boat' && state.passenger ? ', sailor aboard' : ''}`,
          'aria-current': sign === 'boat' ? 'location' : undefined,
          'data-x': x, 'data-y': y, title: name }, sign ? SIGNS[sign].glyph : '·');
      }));
    }));
    function collection(signs: readonly { sign: Sign }[], found: string[], noun: string) {
      return signs.map(({ sign }, index) => {
        const known = found.includes(sign);
        return h('span', {
          class: `glyph-collection-slot ${known ? `glyph-symbol glyph-${sign} ${noun === 'plant' ? 'glyph-plant' : 'glyph-fish-kind'}` : 'glyph-undiscovered'}`,
          'aria-label': known ? (PLANT_DESCRIPTIONS[sign] ?? SIGNS[sign].name) : `Undiscovered ${noun} ${index + 1}`,
          title: known ? (PLANT_DESCRIPTIONS[sign] ?? SIGNS[sign].name) : undefined,
          tabindex: known ? 0 : undefined,
        }, known ? SIGNS[sign].glyph : '?');
      });
    }
    plantGlyphs.replaceChildren(...collection(PLANTS, state.plantsFound, 'plant'));
    fishGlyphs.replaceChildren(...collection(FISH, state.fishFound, 'fish'));
    for (const button of buttons) button.disabled = state.won;
    reflection.hidden = !state.won;
  }
  board.addEventListener('click', (event) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-x]');
    if (!cell) return;
    const dx = Number(cell.dataset.x) - state.position.x;
    const dy = Number(cell.dataset.y) - state.position.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) { status.textContent = 'Steer one square at a time, or use the direction buttons.'; return; }
    steer(dx === 1 ? 'east' : dx === -1 ? 'west' : dy === 1 ? 'south' : 'north');
    board.focus();
  });
  root.addEventListener('keydown', (event) => {
    if (event.target !== board) return;
    const direction = ({ ArrowUp: 'north', ArrowDown: 'south', ArrowLeft: 'west', ArrowRight: 'east' } as const)[event.key as 'ArrowUp'];
    if (direction) { event.preventDefault(); steer(direction); }
  });
  function reset() { state = createGame(fog.checked); render(); }
  restart.addEventListener('click', reset);
  fog.addEventListener('change', () => {
    reset();
    status.textContent = `New voyage with Fog and mist ${fog.checked ? 'on' : 'off'}. The river is the same; your view has changed.`;
  });
  render();
  el.append(root);
  return () => root.remove();
}
export const glyphAdventure: Minigame = {
  slug: 'glyph-adventure', title: 'Glyph Adventure', motivators: ['discovery'],
  author: 'anonymousanemone', mount,
};
