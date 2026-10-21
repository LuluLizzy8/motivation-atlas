import { describe, expect, it } from 'vitest';
import { advance, highlightedPocketFor, newRound, shoot } from '../src/minigames/pocket-warrior/game';

describe('Pocket Warrior highlighted-pocket rule', () => {
  it('triples a pocketed target only when the enabled seeded pocket matches', () => {
    const seed = 42;
    const highlighted = highlightedPocketFor(seed, 0);

    function score(enabled: boolean, pocket: number) {
      const round = shoot(newRound(false, 0, { highlightedPocket: enabled, seed }), 'easy', 0, 0, 0);
      round.world.balls.forEach((ball) => { ball.vx = 0; ball.vy = 0; });
      const target = round.world.balls.find((ball) => ball.id === 'easy')!;
      target.sunk = true;
      target.pocket = pocket;
      return advance(round, 1).score;
    }

    expect(score(true, highlighted)).toBe(3);
    expect(score(true, (highlighted + 1) % 6)).toBe(1);
    expect(score(false, highlighted)).toBe(1);
  });
});
