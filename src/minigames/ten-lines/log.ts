import { fallIntervalMs, stars, type Board, type Kind, type TenLinesOptions, type TenLinesState } from "./game";

/** Where one piece came to rest. With the others in order, these replay the whole game. */
export interface Placement {
  /** Milliseconds of play before it landed. */
  t: number;
  kind: Kind; rot: number; x: number; y: number;
  /** Lines it cleared, and how tall the stack stood afterwards. */
  cleared: number; height: number;
}
export interface GameRecord {
  startedAt: string;
  options: TenLinesOptions;
  outcome: "won" | "lost" | "abandoned";
  lines: number;
  seconds: number;
  stars: number | null;
  /** Milliseconds per row when the game ended. */
  fallMs: number;
  placements: Placement[];
  /** The field at the end, top row first: a letter for each filled square, a dot for each empty one. */
  board: string[];
}
export interface SettingSummary { label: string; games: number; won: number; averageLines: number; bestSeconds: number | null }

/** The log lives in the player's own browser. Nothing is sent anywhere. */
export const LOG_KEY = "motivation-atlas:ten-lines:log";
export const LOG_LIMIT = 50;

export function boardRows(board: Board): string[] {
  return board.map((row) => row.map((c) => c ?? ".").join(""));
}

export function recordOf(startedAt: string, s: TenLinesState, seconds: number, placements: Placement[], outcome: GameRecord["outcome"]): GameRecord {
  return {
    startedAt, options: s.options, outcome, lines: s.lines, seconds,
    stars: outcome === "won" ? stars(seconds) : null,
    fallMs: fallIntervalMs(s), placements, board: boardRows(s.board),
  };
}

export function settingsLabel(o: TenLinesOptions): string {
  return o.rising ? "Rising difficulty on" : "Rising difficulty off";
}

/** One row for the toggle on and one for it off, in the order first played. */
export function summarize(records: GameRecord[]): SettingSummary[] {
  const groups = new Map<string, GameRecord[]>();
  for (const r of records) groups.set(settingsLabel(r.options), [...(groups.get(settingsLabel(r.options)) ?? []), r]);
  return [...groups].map(([label, games]) => {
    const wins = games.filter((g) => g.outcome === "won");
    return {
      label, games: games.length, won: wins.length,
      averageLines: Math.round((games.reduce((sum, g) => sum + g.lines, 0) / games.length) * 10) / 10,
      bestSeconds: wins.length > 0 ? Math.min(...wins.map((g) => g.seconds)) : null,
    };
  });
}

export function loadLog(storage: Pick<Storage, "getItem"> | null): GameRecord[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(LOG_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as GameRecord[]) : [];
  } catch {
    return [];
  }
}

/** Keep the most recent games and write them back. Storage that is full or blocked is not an error. */
export function saveLog(storage: Pick<Storage, "setItem"> | null, records: GameRecord[]): GameRecord[] {
  const kept = records.slice(-LOG_LIMIT);
  try {
    storage?.setItem(LOG_KEY, JSON.stringify(kept));
  } catch {
    // The game goes on without a saved log.
  }
  return kept;
}
