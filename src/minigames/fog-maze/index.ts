import { h } from '../../lib/dom';
import type { Minigame } from '../types';
import { LANDMARKS, MAP, move, newGame, tile, type Direction } from './game';
import './maze.css';

function mount(el: HTMLElement): () => void {
  let state = newGame();
  const fog = h('input', { type: 'checkbox', checked: true, 'data-mechanic': 'fog-of-war' });
  const status = h('p', { role: 'status', class: 'fog-status' });
  const board = h('div', { class: 'fog-board', role: 'img', 'aria-label': 'Maze map. Use the direction buttons to explore.' });
  const nearby = h('p');
  const restart = h('button', { type: 'button' }, 'Replay this maze');
  const controls = h('div', { class: 'fog-controls' });
  const buttons: HTMLButtonElement[] = [];
  for (const [direction, label] of [['up', '↑ North'], ['left', '← West'], ['down', '↓ South'], ['right', '→ East']] as const) {
    const button = h('button', { type: 'button', 'data-direction': direction }, label);
    button.addEventListener('click', () => step(direction));
    controls.append(button);
    buttons.push(button);
  }
  const root = h('section', { class: 'fog-maze', 'aria-label': 'Fog maze game' },
    h('p', { class: 'tag' }, 'A small expedition'),
    h('label', {}, fog, ' Fog of war — reveal nearby tiles as you move'),
    h('p', {}, 'Find all three landmarks, then reach the exit. Switch fog at any time; explored tiles stay visible.'),
    board, status, nearby, controls, restart,
    h('p', { class: 'fog-legend' }, '● You · ◆ Landmark · E Exit · S Start · ? Unexplored · ▪ Wall'),
    h('section', { class: 'fog-reflect' },
      h('h4', {}, 'Then check it against your own play'),
      h('p', {}, 'What did you feel before turning an unexplored corner? Replay with fog changed. Did you explore differently, or feel more curious? How did remembering the maze affect your second trip?'),
    ),
  );
  function render(): void {
    board.replaceChildren(...Array.from({ length: MAP.length * 9 }, (_, i) => {
      const visible = !fog.checked || state.seen.includes(i);
      const cell = tile(i);
      const landmark = !!LANDMARKS[cell] && !state.collected.includes(cell);
      const text = !visible ? '?' : state.position === i ? '●' : cell === '#' ? '▪' : landmark ? '◆' : cell === 'E' || cell === 'S' ? cell : '';
      return h('span', { class: `fog-cell ${!visible ? 'unknown' : cell === '#' ? 'wall' : state.position === i ? 'player' : landmark ? 'landmark' : 'path'}`, 'aria-hidden': 'true' }, text);
    }));
    const found = state.collected.map(key => LANDMARKS[key]);
    status.textContent = state.won
      ? `Expedition complete in ${state.steps} steps! Change fog and replay to compare.`
      : `${state.collected.length}/3 landmarks · ${state.steps} steps. ${found.length ? `Found: ${found.join(', ')}.` : 'Your expedition begins.'}${tile(state.position) === 'E' ? ' Find the remaining landmarks, then return here.' : ''}`;
    const surroundings = (['up', 'left', 'down', 'right'] as Direction[]).map(direction => {
      const offset = { up: -9, left: -1, down: 9, right: 1 }[direction];
      const cell = tile(state.position + offset);
      return `${direction}: ${cell === '#' ? 'wall' : LANDMARKS[cell] && !state.collected.includes(cell) ? LANDMARKS[cell] : cell === 'E' ? 'exit' : 'passage'}`;
    });
    nearby.textContent = `Row ${Math.floor(state.position / 9) + 1}, column ${state.position % 9 + 1}. ${surroundings.join('; ')}.`;
    for (const button of buttons) button.setAttribute('aria-disabled', String(state.won));
  }
  function step(direction: Direction): void {
    const next = move(state, direction);
    const blocked = next === state && !state.won;
    state = next;
    render();
    if (blocked) status.textContent += ' A wall blocks that direction.';
  }
  root.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as Record<string, Direction>)[event.key];
    if (direction) { event.preventDefault(); step(direction); }
  });
  fog.addEventListener('change', render);
  restart.addEventListener('click', () => { state = newGame(); render(); });
  el.append(root);
  render();
  return () => root.remove();
}

export const fogMaze: Minigame = { slug: 'fog-maze', title: 'Fog maze: a small expedition', motivators: ['discovery'], author: 'ScarlettLeon7', mount };
