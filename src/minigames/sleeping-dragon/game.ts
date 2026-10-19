/** Pure rules: a fair six-sided die, three trips, and one loss toggle. */
export const TRIPS = 3;
export const LOOT = [0, 0, 5, 10, 15, 20, 50] as const;

export interface TripResult {
  trip: number;
  outcome: "escaped" | "caught";
  attempts: number;
  haul: number;
  secured: number;
}

export interface HoardState {
  dropLoot: boolean;
  trip: number;
  carried: number;
  banked: number;
  attempts: number;
  lastRoll: number | null;
  phase: "stealing" | "between" | "finished";
  results: TripResult[];
}

export function newRound(dropLoot = true): HoardState {
  return { dropLoot, trip: 1, carried: 0, banked: 0, attempts: 0,
    lastRoll: null, phase: "stealing", results: [] };
}

function endTrip(state: HoardState, outcome: TripResult["outcome"]): HoardState {
  const secured = outcome === "caught" && state.dropLoot ? 0 : state.carried;
  return { ...state, carried: 0, banked: state.banked + secured,
    phase: state.trip === TRIPS ? "finished" : "between",
    results: [...state.results, { trip: state.trip, outcome, attempts: state.attempts,
      haul: state.carried, secured }] };
}

/** The UI supplies the die face, so tests never depend on luck. */
export function steal(state: HoardState, face: number): HoardState {
  if (!Number.isInteger(face) || face < 1 || face > 6) {
    throw new RangeError("A die face must be an integer from 1 to 6.");
  }
  if (state.phase !== "stealing") return state;
  const rolled = { ...state, attempts: state.attempts + 1, lastRoll: face };
  return face === 1 ? endTrip(rolled, "caught") : { ...rolled, carried: state.carried + LOOT[face] };
}

export function escape(state: HoardState): HoardState {
  if (state.phase !== "stealing" || state.carried === 0) return state;
  return endTrip(state, "escaped");
}

export function nextTrip(state: HoardState): HoardState {
  if (state.phase !== "between") return state;
  return { ...state, trip: state.trip + 1, carried: 0, attempts: 0,
    lastRoll: null, phase: "stealing" };
}
