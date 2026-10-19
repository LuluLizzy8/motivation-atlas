export type Path = { label: string; danger: boolean };
export type State = { step: number; time: number; speed: number; chasing: boolean; status: 'playing' | 'won' | 'lost'; message: string };
export const FORKS = 10;
const safe = ['A trail beside a stream', 'A gap between silver birches', 'A path over dry stones', 'A trail beneath the stars', 'A break in the brambles'];
const risky = ['A shortcut through dark pines', 'A tunnel beneath tangled roots', 'A trail through deep mud', 'A hollow between fallen trees', 'A path into thick ferns'];
export function forest(random: () => number = Math.random): Path[][] {
  return Array.from({ length: FORKS }, (_, i) => {
    const pair = [{ label: safe[i % 5], danger: false }, { label: risky[i % 5], danger: true }];
    return random() < .5 ? pair : pair.reverse();
  });
}
export function start(): State {
  return { step: 0, time: 22, speed: 1, chasing: false, status: 'playing', message: 'You are lost in the woods. Two paths split into the mist. Somewhere beyond the trees is home.' };
}
export function tick(s: State, seconds: number): State {
  if (!s.chasing || s.status !== 'playing') return s;
  const time = Math.max(0, s.time - Math.max(0, seconds) * s.speed);
  return { ...s, time, status: time === 0 ? 'lost' : 'playing', message: time === 0 ? 'The creature catches and eats you. The forest falls quiet.' : s.message };
}
export function choose(s: State, path: Path): State {
  if (s.status !== 'playing') return s;
  if (s.step === FORKS - 1 && !path.danger) return { ...s, status: 'won', message: 'Lamplight. Your own door. You reach home and bolt it behind you. You made it.' };
  const chasing = s.chasing || path.danger || s.step >= 1;
  const time = chasing ? Math.min(28, Math.max(0, s.time + (path.danger ? -6 : 5))) : s.time;
  const message = path.danger
    ? (s.step % 2 ? 'A creature stirs in the shadows.' : 'Fresh creature tracks cross the trail.') + ' It gains ground: −6 seconds, faster pursuit. Another fork lies ahead.'
    : chasing ? 'Rustling follows you, but a stream masks your footsteps. +5 seconds, slower pursuit. Another fork lies ahead.' : 'A quiet clearing opens ahead. No sign of home yet. You reach another fork.';
  return { step: Math.min(FORKS - 1, s.step + 1), time, speed: path.danger ? Math.min(2.5, s.speed + .5) : Math.max(1, s.speed - .5), chasing, status: time === 0 ? 'lost' : 'playing', message: time === 0 ? 'You run into the creature. It catches and eats you.' : message };
}
export function reveal(path: Path, fog: boolean, step: number): string {
  if (fog) return 'Destination hidden by fog';
  if (!path.danger) return step === FORKS - 1 ? 'Home → safety' : 'Quiet clearing → another fork · +5 seconds during chase; slower pursuit';
  return (step % 2 ? 'Creature' : 'Creature tracks') + ' → another fork · −6 seconds; faster pursuit';
}
