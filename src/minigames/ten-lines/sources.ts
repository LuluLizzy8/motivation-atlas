import type { TenLinesOptions } from "./game";

/** Items quoted verbatim from the Challenge section of the note; a test checks each one. */
export const SOURCES = {
  rising: "Difficulty that rises as the player's ability grows (Malone 1980, p. 54) or as the player progresses through the game (Przybylski et al. 2010, p. 155).",
  timePressure: "Time pressure and opponent play (Hunicke et al. 2004, p. 3).",
  sameButDifferent: "The \"same-but-different\": a simple core mechanic that produces a new outcome each time it is played, which is how Quake can be \"easy to learn but difficult to master\" (Salen and Zimmerman 2003, ch. 24, \"Sculpting Desire\").",
} as const;

export function dynamicsFor(options: TenLinesOptions): string[] {
  const out: string[] = [];
  if (options.rising) out.push(SOURCES.rising, SOURCES.timePressure);
  else out.push("With the speed fixed, the tenth line asks no more of you than the first. Compare how the last lines feel with rising speed on.");
  out.push(SOURCES.sameButDifferent);
  return out;
}
