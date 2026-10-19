export const COLUMNS = 3;
export const PLOT_COUNT = 12;
export const LIMIT_MS = 35000;
export const FLOWER_TYPES = ["daisy", "poppy", "bellflower"] as const;
export type FlowerType = typeof FLOWER_TYPES[number];
export type GardenPlot =
  | { readonly stage: "empty"; readonly flower: null }
  | { readonly stage: "planted" | "bloomed"; readonly flower: FlowerType };

export interface GardenState {
  plots: readonly GardenPlot[];
  selectedFlower: FlowerType;
  timed: boolean;
  status: "ready" | "playing" | "complete" | "timeout";
  deadline: number | null;
  endedAt: number | null;
  lastAction: { kind: "plant" | "water"; plots: readonly number[] } | null;
}

export function createGarden(timed = false): GardenState {
  return {
    plots: Array.from({ length: PLOT_COUNT }, () => ({ stage: "empty", flower: null })),
    selectedFlower: "daisy", timed, status: "ready", deadline: null, endedAt: null, lastAction: null,
  };
}

/** Timestamps come from the caller's monotonic clock; rules never schedule work. */
export function startGarden(state: GardenState, now: number): GardenState {
  if (state.status !== "ready") return state;
  return { ...state, status: "playing", deadline: state.timed ? now + LIMIT_MS : null };
}

export function selectFlower(state: GardenState, flower: FlowerType): GardenState {
  if ((state.status !== "ready" && state.status !== "playing") || !FLOWER_TYPES.includes(flower)
    || state.selectedFlower === flower) return state;
  return { ...state, selectedFlower: flower };
}

export function advanceGarden(state: GardenState, now: number): GardenState {
  if (state.status !== "playing" || state.deadline === null || now < state.deadline) return state;
  return { ...state, status: "timeout", endedAt: state.deadline };
}

function validPlot(plot: number): boolean {
  return Number.isInteger(plot) && plot >= 0 && plot < PLOT_COUNT;
}

export function adjacentPlots(plot: number): number[] {
  if (!validPlot(plot)) return [];
  const neighbors: number[] = [];
  if (plot >= COLUMNS) neighbors.push(plot - COLUMNS);
  if (plot + COLUMNS < PLOT_COUNT) neighbors.push(plot + COLUMNS);
  if (plot % COLUMNS > 0) neighbors.push(plot - 1);
  if (plot % COLUMNS < COLUMNS - 1) neighbors.push(plot + 1);
  return neighbors;
}

/** Take one snapshot of the direct neighbors: a ripple never recurses. */
export function waterTargets(state: GardenState, plot: number): number[] {
  if (!validPlot(plot) || state.plots[plot].stage !== "planted") return [];
  return [plot, ...adjacentPlots(plot)].filter(index => state.plots[index].stage === "planted");
}

export function tendPlot(state: GardenState, plot: number, now: number): GardenState {
  const next = advanceGarden(state, now);
  if (next.status !== "playing" || !validPlot(plot) || next.plots[plot].stage === "bloomed") return next;
  if (next.plots[plot].stage === "empty") {
    return {
      ...next,
      plots: next.plots.map((p, index) => index === plot ? { stage: "planted", flower: next.selectedFlower } : p),
      lastAction: { kind: "plant", plots: [plot] },
    };
  }
  const targets = waterTargets(next, plot);
  const plots = next.plots.map(p => p);
  for (const index of targets) {
    const flower = plots[index].flower!;
    plots[index] = { stage: "bloomed", flower };
  }
  const complete = plots.every(p => p.stage === "bloomed");
  return {
    ...next, plots, lastAction: { kind: "water", plots: targets },
    status: complete ? "complete" : "playing", endedAt: complete ? now : null,
  };
}

export function remainingMs(state: GardenState, now: number): number | null {
  if (!state.timed) return null;
  if (state.deadline === null) return LIMIT_MS;
  return Math.max(0, state.deadline - (state.endedAt ?? now));
}
