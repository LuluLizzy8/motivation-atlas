import { h } from '../../lib/dom';
import type { Minigame } from '../types';
import { choose, forest, FORKS, reveal, start, tick } from './game';
import './fork.css';

function mount(el: HTMLElement): () => void {
  let woods = forest();
  let state = start();
  let last = performance.now();
  const fog = h('input', { type: 'checkbox', checked: true, 'data-mechanic': 'mysterious-fog' });
  const story = h('p', { class: 'fork-story', 'aria-live': 'polite' });
  const progress = h('p', { class: 'tag' });
  const clock = h('p', { role: 'timer', 'aria-label': 'Time until creature catches you' });
  const meter = h('progress', { max: 28, value: 22, 'aria-label': 'Distance from creature' });
  const routes = h('div', { class: 'fork-routes' });
  const reflection = h('div', { class: 'fork-reflect' }, h('strong', {}, 'Then check it against your own play'), h('p', {}, 'What did you feel at each fork? Did hiding the destinations change your curiosity, hesitation, or fear? Replay this forest with fog switched, and compare.'));
  function advance() {
    const now = performance.now();
    state = tick(state, (now - last) / 1000);
    last = now;
  }
  const buttons = [0, 1].map((side) => {
    const button = h('button', { type: 'button', 'data-path': side });
    button.addEventListener('click', () => {
      advance();
      state = choose(state, woods[state.step][side]);
      render();
    });
    routes.append(button);
    return button;
  });
  function render() {
    progress.textContent = state.status === 'won' ? 'Home at last' : `Fork ${state.step + 1} of ${FORKS} · ${fog.checked ? 'Fog on' : 'Fog off'}`;
    if (story.textContent !== state.message) story.textContent = state.message;
    clock.textContent = state.status !== 'playing' ? (state.status === 'won' ? 'Safe inside.' : 'No time left.') : state.chasing ? `${Math.ceil(state.time)} seconds of distance · pursuit ×${state.speed.toFixed(1)}` : 'The woods are quiet. The chase has not started.';
    meter.value = state.time;
    meter.hidden = !state.chasing || state.status !== 'playing';
    buttons.forEach((button, side) => {
      const path = woods[state.step][side];
      const label = `${side === 0 ? 'Left' : 'Right'}: ${path.label}`;
      const detail = reveal(path, fog.checked, state.step);
      if (button.dataset.detail !== label + detail) {
        button.replaceChildren(h('strong', {}, label), h('span', {}, detail));
        button.dataset.detail = label + detail;
      }
      button.disabled = state.status !== 'playing';
    });
    reflection.hidden = state.status === 'playing';
  }
  const replay = h('button', { type: 'button' }, 'Replay this forest');
  const fresh = h('button', { type: 'button' }, 'New forest');
  function reset() { state = start(); last = performance.now(); render(); }
  replay.addEventListener('click', reset);
  fresh.addEventListener('click', () => { woods = forest(); reset(); });
  fog.addEventListener('change', () => { advance(); render(); });
  const root = h('section', { class: 'fork-game', 'aria-label': 'Fork woodland survival game' },
    h('p', { class: 'tag' }, 'Lost in the woods'),
    h('label', { class: 'fork-toggle' }, fog, ' Mysterious Fog — hide path outcomes'),
    h('p', { class: 'fork-help' }, 'Find home beyond ten forks. Tracks or rustling start the chase. Choose before your distance runs out. Dangerous paths cost time and speed up the creature; safe paths buy time. Use Tab and Enter, or tap a path.'),
    progress, story, clock, meter, routes, h('div', { class: 'fork-actions' }, replay, fresh), reflection);
  el.append(root);
  const timer = setInterval(() => { advance(); render(); }, 200);
  render();
  return () => { clearInterval(timer); root.remove(); };
}
export const fork: Minigame = { slug: 'fork', title: 'Fork', motivators: ['discovery'], author: 'saadsatter', mount };
