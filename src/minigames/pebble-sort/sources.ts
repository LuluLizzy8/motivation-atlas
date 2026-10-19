import type { SortOptions } from "./game";

/** Items quoted verbatim from the course note; a test checks each one. */
export const SOURCES = {
  counter: "Turn-based play, and a move counter in place of a clock (Lazzaro 2004b, sec. 1c).",
  rhythm: "Rhythmic repetition, \"the meditative patterns of Tetris\" (Salen and Zimmerman 2003, ch. 24, \"Patterns of Pleasure\").",
  comfort: "Comfort: playing where \"one can exercise mastery with little risk\" (Koster 2013, p. 100).",
  pressure: "Time pressure and opponent play (Hunicke et al. 2004, p. 3).",
} as const;

export function dynamicsFor(options: SortOptions): string[] {
  if (options.moveCounter) return [SOURCES.counter, SOURCES.rhythm, SOURCES.comfort];
  return [
    "The clock turns the same sorting into a race. The note lists time pressure under Challenge, not Submission:",
    SOURCES.pressure,
  ];
}
