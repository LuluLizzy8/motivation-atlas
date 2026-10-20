import { h, s } from "../../lib/dom";
import type { Minigame } from "../types";
import { BUILDINGS, DEFAULT_OPTIONS, FARM, PLOTS, RECOVERY_SECONDS, WIDTH, interact, newGame, step, tick, type HarvestState } from "./game";
import "./buildavillage.css";

// Original tiny pixel drawings: path geometry only, with the Atlas theme colors.
function sprite(kind: string): SVGSVGElement {
  if (kind === "sleep") return s("svg", { viewBox: "0 0 16 16", class: "harvest-sprite", "aria-hidden": "true", "shape-rendering": "crispEdges" },
    s("path", { d: "M1 10h5v4H1z", class: "harvest-pixel-warm" }),
    s("path", { d: "M6 10h8v4H6zM5 12h1v2H5z", class: "harvest-pixel-blue" }),
    s("path", { d: "M2 11h2v1H2zM14 12h1v2h-1z", class: "harvest-pixel-ink" }),
    s("path", { d: "M8 3h4v1h-1v1h-1v1h2v1H8V6h1V5h1V4H8z", class: "harvest-pixel-light" }),
  );
  if (kind === "farmer") return s("svg", { viewBox: "0 0 16 16", class: "harvest-sprite", "aria-hidden": "true", "shape-rendering": "crispEdges" },
    s("path", { d: "M5 4h6v5H5zM3 10h2v3H3zM11 10h2v3h-2z", class: "harvest-pixel-warm" }),
    s("path", { d: "M5 2h6v1h1v2H4V3h1zM3 4h10v1H3z", class: "harvest-pixel-leaf" }),
    s("path", { d: "M6 6h1v1H6zM9 6h1v1H9zM7 8h2v1H7z", class: "harvest-pixel-ink" }),
    s("path", { d: "M4 9h8v4h-1v1H5v-1H4z", class: "harvest-pixel-blue" }),
    s("path", { d: "M5 9h1v2H5zM10 9h1v2h-1zM7 11h2v1H7z", class: "harvest-pixel-light" }),
    s("path", { d: "M5 14h2v1H4v-1zM9 14h2v1H9z", class: "harvest-pixel-ink" }),
  );
  const art: Record<string, [string, string][]> = {
    tree: [["M7 9h2v6H7z", "warm"], ["M6 1h4v2h2v2h2v5h-2v2H4v-2H2V5h2V3h2z", "leaf"], ["M5 4h3v2H5z", "light"]],
    rock: [["M4 6h7v2h2v5H3V9h1z", "stone"], ["M5 7h5v2H5z", "light"]],
    stump: [["M5 11h6v3H5zM6 10h4v1H6z", "warm"]],
    tent: [
      ["M1 14h14v1H1zM2 12h1v2H2zM13 12h1v2h-1z", "ink"],
      ["M7 2h2v2h1v2h1v2h1v2h1v3H3v-3h1V8h1V6h1V4h1z", "roof"],
      ["M7 5h1v8H5v-2h1V8h1z", "light"], ["M8 6h1v3h1v4H8zM8 1h1v2H8z", "ink"],
    ],
    hut: [
      ["M2 7h12v7H2z", "warm"], ["M1 14h14v1H1z", "ink"],
      ["M6 1h4v1h2v2h2v2h1v2H1V6h1V4h2V2h2z", "leaf"],
      ["M3 9h3v3H3z", "blue"], ["M4 9h1v3H4zM3 10h3v1H3z", "light"],
      ["M9 9h3v5H9zM2 8h12v1H2zM2 12h5v1H2zM13 10h1v1h-1z", "ink"], ["M10 11h1v1h-1zM4 4h7v1H4z", "light"],
    ],
    house: [
      ["M2 7h12v8H2z", "light"], ["M1 14h14v1H1zM11 1h2v4h-2z", "stone"],
      ["M7 1h2v1h2v2h2v2h2v2H1V6h2V4h2V2h2z", "roof"], ["M5 4h6v1H5zM3 6h10v1H3z", "warm"],
      ["M3 9h3v3H3zM10 9h3v3h-3z", "blue"], ["M4 9h1v3H4zM11 9h1v3h-1zM3 10h3v1H3zM10 10h3v1h-3z", "stone"],
      ["M7 10h2v5H7z", "ink"], ["M8 12h1v1H8zM6 15h4v1H6z", "warm"],
    ],
    castle: [
      ["M1 4h4v11H1zM11 4h4v11h-4zM5 7h6v8H5zM6 5h1v2H6zM9 5h1v2H9z", "stone"],
      ["M1 4V2h1v2h2V2h1v3H1zM11 4V2h1v2h2V2h1v3h-4z", "light"],
      ["M2 7h2v3H2zM12 7h2v3h-2zM7 11h2v4H7zM6 12h4v3H6z", "ink"],
      ["M2 11h2v1H2zM12 11h2v1h-2zM5 9h2v1H5zM9 9h2v1H9zM1 14h14v1H1z", "light"],
      ["M7 12h2v3H7zM7 1h1v4H7zM8 1h3v2H8z", "roof"],
    ],
  };
  return s("svg", { viewBox: "0 0 16 16", class: "harvest-sprite", "aria-hidden": "true", "shape-rendering": "crispEdges" },
    ...(art[kind] ?? []).map(([d, color]) => s("path", { d, class: `harvest-pixel-${color}` })));
}

function mount(el: HTMLElement): () => void {
  let state = newGame();
  let startedAt: number | null = null;
  let roundStarted = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let tutorialEnabled = true;
  let awaitingTutorial = false;
  let tutorialCompleteUntil: number | null = null;
  const day = h("p", { class: "harvest-day" });
  const moon = s("svg", { viewBox: "0 0 16 16", class: "harvest-moon", "aria-hidden": "true", "shape-rendering": "crispEdges" },
    s("path", { d: "M8 1h3v2H8v2H6v6h2v2h3v2H7v-1H5v-2H3V5h2V3h3zM13 3h2v2h-2z", fill: "currentColor" }));
  const nightHeading = h("div", { class: "harvest-night-heading", hidden: true }, moon, h("span", {}, "A little rest until morning"));
  const clock = h("progress", { class: "harvest-clock", max: DEFAULT_OPTIONS.secondsPerDay, value: DEFAULT_OPTIONS.secondsPerDay, "aria-label": "Time until night" });
  const resources = h("p", { class: "harvest-resources", "data-resources": "" });
  const player = h("span", { class: "harvest-player" }, sprite("farmer"));
  const shade = h("div", { class: "harvest-night-shade", hidden: true });
  const confetti = h("div", { class: "harvest-confetti", hidden: true, "aria-hidden": "true" },
    ...Array.from({ length: 44 }, (_, i) => h("span", {
      class: `harvest-confetti-piece harvest-confetti-${i % 6}`,
      style: `left: ${(i * 37) % 96}%; animation-delay: ${-i * 0.31}s; --harvest-fall-duration: ${3.6 + i % 7 * 0.43}s; --harvest-flutter-duration: ${0.75 + i % 9 * 0.13}s; --harvest-drift: ${(i * 53) % 140 - 70}px; --harvest-sway: ${i % 2 ? 24 : -24}px`,
    }, h("span", { class: `harvest-confetti-paper harvest-confetti-shape-${i % 4}` }))));
  const victory = h("p", { class: "harvest-victory", role: "status", hidden: true }, "Town complete! All four buildings finished.");
  const popup = h("div", { class: "harvest-popup", role: "alert", hidden: true });
  const transition = h("div", { class: "harvest-transition", role: "status", hidden: true });
  const tutorialTitle = h("strong", { class: "harvest-tutorial-title" });
  const tutorialText = h("p", { class: "harvest-tutorial-text" });
  const tutorial = h("aside", { class: "harvest-tutorial", "data-tutorial": "", "aria-live": "polite", "aria-atomic": "true" }, tutorialTitle, tutorialText);
  const tutorialComplete = h("div", { class: "harvest-tutorial-complete", role: "status", hidden: true }, "Tutorial complete!");
  const confirmTutorial = h("button", { type: "button", class: "harvest-btn" }, "Confirm");
  const skipTutorial = h("button", { type: "button", class: "harvest-btn" }, "Skip");
  const intro = h("div", { class: "harvest-intro", role: "dialog", "aria-modal": "true", "aria-label": "Start tutorial?", hidden: true },
    h("div", { class: "harvest-intro-card" }, h("strong", {}, "Start tutorial?"),
      h("p", {}, "Learn to gather and build."),
      h("div", { class: "harvest-intro-actions" }, confirmTutorial, skipTutorial)));
  const tiles = [...FARM].map((_, i) => h("div", { class: "harvest-tile", role: "img", "data-tile": i }));
  const map = h("div", { class: "harvest-map", tabindex: 0, role: "group", "aria-label": "Farm. Arrow keys or WASD to walk. Stand on a resource or plot and press E to gather or build." }, ...tiles, player, shade, confetti, transition, victory, tutorial, popup, tutorialComplete, intro);
  const gatherBtn = h("button", { type: "button", class: "harvest-btn harvest-build", "data-gather": "" });
  const goal = h("p", { class: "harvest-objective", "data-objective": "" });
  const status = h("p", { class: "harvest-status", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const summary = h("section", { class: "harvest-panel", "data-summary": "", hidden: true });
  const keep = h("input", { type: "checkbox", checked: true, "data-mechanic": "sustenance" });
  const mode = h("p", { class: "harvest-hint" });
  const newBtn = h("button", { type: "button", class: "harvest-btn" }, "Start round");
  const directions = h("div", { class: "harvest-directions", "aria-label": "Walk in a direction" });
  for (const [label, dx, dy, icon] of [
    ["Up", 0, -1, "↑"], ["Left", -1, 0, "←"], ["Down", 0, 1, "↓"], ["Right", 1, 0, "→"],
  ] as const) {
    const button = h("button", { type: "button", class: "harvest-btn", "aria-label": `Move ${label.toLowerCase()}` }, icon);
    button.addEventListener("click", () => act((s) => step(s, dx, dy)));
    directions.append(button);
  }
  const root = h("div", { class: "harvest-game" },
    h("fieldset", { class: "harvest-panel" },
      h("legend", {}, "Mechanic"),
      h("label", { class: "harvest-toggle" }, keep, " Keep everything overnight"), mode,
    ),
    h("div", { class: "harvest-board" },
      h("p", { class: "harvest-eyebrow" }, "A tiny town. Five short days."), nightHeading, day, clock, resources,
      h("div", { class: "harvest-start" }, newBtn), goal, map,
      h("p", { class: "harvest-hint" }, "Walk with arrows / WASD or the direction buttons. Stand ON a resource or a named plot, then press E to gather or build. Build the four plots in any order."),
      directions, h("div", { class: "harvest-gather" }, gatherBtn), status,
    ),
    summary,
    h("section", { class: "harvest-panel" },
      h("h4", { class: "harvest-heading" }, "Then check it against your own play"),
      h("p", {}, "How did it feel when night came? Did you care about the buildings the same way with keep on and keep off? Play once with each setting and compare."),
    ),
  );
  el.append(root);

  function render(): void {
    const objective = state.structures.findIndex((built) => !built);
    const next = BUILDINGS[objective];
    const currentPlot = PLOTS.indexOf(state.player);
    const night = state.phase === "night";
    const cycle = state.options.secondsPerDay + state.options.secondsPerNight;
    const remaining = state.over ? 0 : (night ? cycle : state.options.secondsPerDay) - state.elapsed % cycle;
    const inDay = state.elapsed % cycle;
    const stageSeconds = state.options.secondsPerNight / 3;
    const dusk = !state.over && !night && remaining <= state.options.secondsPerNight;
    const dawn = !state.over && !night && state.day > 1 && inDay < stageSeconds * 2;
    const morningSoon = !state.over && night && remaining <= stageSeconds;
    const darkness = state.won ? 0.55 : night ? morningSoon ? 0.65 : 0.8
      : dusk ? Math.ceil((state.options.secondsPerNight + 1 - remaining) / stageSeconds) * 0.18
      : dawn ? 0.45 - Math.floor(inDay / stageSeconds) * 0.2 : 0;
    day.textContent = roundStarted && startedAt === null ? "Day 1 of 5 · Tutorial · clock paused"
      : state.won ? `Town complete · Day ${state.day} · ${state.elapsed}s played`
      : `Day ${state.day} of ${state.options.days} · ${night ? "Night" : "Daytime"} · ${remaining}s until ${night ? "morning" : "night"}`;
    clock.max = night ? state.options.secondsPerNight : state.options.secondsPerDay;
    clock.value = remaining;
    nightHeading.hidden = !night;
    shade.hidden = darkness === 0;
    shade.style.opacity = String(darkness);
    transition.hidden = !dusk && !dawn && !morningSoon;
    transition.textContent = dusk ? `Night is approaching · ${remaining}s`
      : morningSoon ? `Morning is approaching · ${remaining}s` : dawn ? "Good morning · the sun is rising" : "";
    intro.hidden = !awaitingTutorial;
    tutorialComplete.hidden = awaitingTutorial || state.over || tutorialCompleteUntil === null || state.elapsed >= tutorialCompleteUntil;
    tutorial.hidden = !tutorialEnabled || awaitingTutorial || state.bestBuilt > 0 || state.over || night || dusk || dawn;
    const woodReady = state.wood >= BUILDINGS[0].wood;
    const needsStone = woodReady && state.stone < BUILDINGS[0].stone;
    const tentReady = !state.structures[0] && woodReady && !needsStone;
    const onTree = FARM[state.player] === "T" && state.patches[state.player] > 0;
    const onRock = FARM[state.player] === "R" && state.patches[state.player] > 0;
    const title = tentReady ? "4 · Walk onto the Tent plot"
      : needsStone ? onRock ? "3 · Press E to mine" : "3 · Find a rock"
      : onTree ? "2 · Press E to gather" : "1 · Find a tree";
    const text = tentReady ? currentPlot === 0 ? "You're ON the Tent plot. Press E to build!" : "Go ONTO the highlighted Tent plot. Press E to build."
      : needsStone ? onRock ? "Stone: 0/1. Press E or Mine rock below." : "Tent needs 1 stone too. Stand ON a highlighted rock."
      : onTree ? `Wood: ${state.wood}/3. Press E or Chop tree below.`
      : "WASD / arrows to walk. Stand on a tree.";
    if (tutorialTitle.textContent !== title) tutorialTitle.textContent = title;
    if (tutorialText.textContent !== text) tutorialText.textContent = text;
    tutorial.classList.toggle("harvest-tutorial-build-step", tentReady);
    confetti.hidden = !state.won;
    victory.hidden = !state.won;
    player.classList.toggle("harvest-celebrate", state.won);
    player.replaceChildren(sprite(night ? "sleep" : "farmer"));
    player.setAttribute("aria-label", night ? "Farmer sleeping" : "Farmer awake");
    directions.querySelectorAll("button").forEach((button) => button.setAttribute("aria-disabled", String(night || state.over)));
    resources.textContent = `${state.wood} wood · ${state.stone} stone`;
    map.setAttribute("aria-label", `Farm. Farmer at row ${Math.floor(state.player / WIDTH) + 1}, column ${state.player % WIDTH + 1}. Arrows or WASD to walk; E to gather or build.`);
    player.style.left = `${state.player % WIDTH * 100 / WIDTH}%`;
    player.style.top = `${Math.floor(state.player / WIDTH) * 100 / (FARM.length / WIDTH)}%`;
    tiles.forEach((tile, i) => {
      const plot = PLOTS.indexOf(i);
      let kind = state.patches[i] ? FARM[i] === "T" ? "tree" : "rock" : FARM[i] === "T" ? "stump" : "";
      if (plot >= 0) kind = BUILDINGS[plot].name.toLowerCase();
      tile.className = `harvest-tile${plot >= 0 ? " harvest-plot" : ""}`;
      if (!tutorial.hidden && !tentReady && state.patches[i] > 0 && (needsStone ? FARM[i] === "R" : !onTree && FARM[i] === "T")) tile.classList.add("harvest-tree-hint");
      if (i === state.player && state.patches[i]) tile.classList.add("harvest-underfoot");
      if (plot >= 0 && !state.structures[plot]) tile.classList.add("harvest-empty-plot");
      if (plot === objective && plot >= 0) tile.classList.add("harvest-plot-target");
      const label = plot >= 0 ? `${BUILDINGS[plot].name} plot: ${state.structures[plot] ? "built" : "empty"}; costs ${BUILDINGS[plot].wood} wood, ${BUILDINGS[plot].stone} stone`
        : state.patches[i] ? `${kind}, ${state.patches[i]} ${FARM[i] === "T" ? "wood" : "stone"} left` : kind === "stump" ? "Tree stump" : "Ground";
      const recovering = state.recoverAt[i] > 0;
      const recovery = recovering ? Math.max(0, state.recoverAt[i] - state.elapsed) : 0;
      const resourceTile = FARM[i] === "T" || FARM[i] === "R";
      const description = label + (recovering ? `; fully recovers in ${recovery}s` : "");
      tile.setAttribute("aria-label", `${description}, row ${Math.floor(i / WIDTH) + 1}, column ${i % WIDTH + 1}${i === state.player ? ", farmer here" : ""}`);
      tile.title = description;
      tile.replaceChildren(...(kind ? [sprite(kind)] : []), ...(plot >= 0 ? [h("span", { class: "harvest-plot-name", "aria-hidden": "true" }, BUILDINGS[plot].name)] : []), ...(resourceTile ? [
        h("span", { class: "harvest-health", "aria-hidden": "true" },
          h("span", { class: "harvest-health-fill", style: `width: ${state.patches[i] / 3 * 100}%` })),
        h("span", { class: "harvest-recovery", "aria-hidden": "true" },
          h("span", { class: "harvest-recovery-fill", style: `width: ${recovering ? (1 - recovery / RECOVERY_SECONDS) * 100 : 0}%` })),
      ] : []));
    });
    const health = state.patches[state.player];
    const recovery = Math.max(0, state.recoverAt[state.player] - state.elapsed);
    gatherBtn.textContent = currentPlot >= 0 ? `${state.structures[currentPlot] ? "Built: " : "Build "}${BUILDINGS[currentPlot].name} (E)`
      : health ? `${FARM[state.player] === "T" ? "Chop tree" : "Mine rock"} · ${health}/3 (E)`
      : recovery ? `Recovering · ${recovery}s` : "Stand on a tree or rock to gather";
    gatherBtn.setAttribute("aria-disabled", String(state.over || night || (currentPlot >= 0 ? state.structures[currentPlot] : !health)));
    goal.textContent = next ? `Next objective: Build ${next.name} (${next.wood} wood, ${next.stone} stone) · ${state.built}/4 built`
      : "Town complete: all four plots built!";
    popup.hidden = state.lastEvent !== "cannot-build" || night || state.over;
    if (!popup.hidden && state.lastBuilding !== null) {
      const missing = BUILDINGS[state.lastBuilding];
      popup.textContent = `Not enough materials for ${missing.name}! Need ${Math.max(0, missing.wood - state.wood)} more wood and ${Math.max(0, missing.stone - state.stone)} more stone.`;
    }
    if (state.won) {
      status.textContent = "All four buildings complete! The clock has stopped. Your farmer is celebrating. Try the other overnight rule with New round.";
    } else if (state.over) {
      status.textContent = `Five days finished. ${state.options.keep ? "You kept your town." : "The last night cleared your town."}`;
    } else if (night) {
      status.textContent = `${state.options.keep ? "Night falls… you kept everything." : "Night falls… your town and resources reset."} Sleeping; morning in ${remaining}s.`;
    } else if (!roundStarted) {
      status.textContent = "Move to start, or press Start round. Arrows / WASD work while any game control has focus.";
    } else if (state.lastEvent === "night-kept" || state.lastEvent === "night-reset") {
      status.textContent = state.options.keep ? "Night falls… you kept everything. Trees and rocks are replenished."
        : "Night falls… it's all gone. Trees and rocks are replenished; your best town is remembered.";
    } else if (state.lastEvent === "build" && state.lastBuilding !== null) {
      status.textContent = `${BUILDINGS[state.lastBuilding].name} built!`;
    } else if (state.lastEvent === "cannot-build") {
      status.textContent = popup.textContent;
    } else if (state.lastEvent === "chop" || state.lastEvent === "mine") {
      status.textContent = `Gathered 1 ${state.lastEvent === "chop" ? "wood" : "stone"}. ${health ? `${health}/3 left; gather again whenever you like.` : "Patch depleted. Watch its recovery bar refill."}`;
    } else {
      status.textContent = "Each bar shows resources left (up to 3). The thin bar counts down to full recovery after 12 seconds.";
    }
    mode.textContent = `${state.options.secondsPerDay}-second days + ${state.options.secondsPerNight}-second nights · up to ${state.options.days * cycle} seconds. Current rule: ${state.options.keep ? "keep everything" : "reset each night"}. Changes apply on New round.`;
    newBtn.textContent = roundStarted ? "New round" : "Start round";
    summary.hidden = !state.over;
    if (state.over) summary.replaceChildren(
      h("h4", { class: "harvest-heading" }, state.won ? "Your town is complete!" : "Five days of work"),
      h("p", {}, `Best building reached: ${state.bestBuilt ? BUILDINGS[state.bestBuilt - 1].name : "None yet"}`),
      h("p", {}, `Resources gathered: ${state.gathered} · Time: ${state.elapsed} seconds`),
    );
  }

  function stopClock(): void {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }
  function sync(): void {
    if (startedAt === null) return;
    state = tick(state, (performance.now() - startedAt) / 1000);
    if (state.over) stopClock();
  }
  function act(rule: (s: HarvestState) => HarvestState): void {
    if (awaitingTutorial) return;
    if (!roundStarted) startRound();
    sync();
    const wasWon = state.won;
    const firstBuilding = state.bestBuilt === 0;
    state = rule(state);
    if (tutorialEnabled && firstBuilding && state.lastEvent === "build") {
      tutorialCompleteUntil = state.elapsed + 4;
      beginClock();
    }
    if (state.over) stopClock();
    render();
    if (state.won && !wasWon) {
      map.focus({ preventScroll: true });
      map.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
  }
  root.addEventListener("keydown", (event) => {
    if (awaitingTutorial) {
      if (event.key === "Tab") {
        event.preventDefault();
        (document.activeElement === confirmTutorial ? skipTutorial : confirmTutorial).focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        chooseTutorial(false);
      }
      return;
    }
    if (event.target instanceof HTMLInputElement || event.ctrlKey || event.metaKey || event.altKey) return;
    const keys: Record<string, [number, number]> = {
      arrowup: [0, -1], w: [0, -1], arrowleft: [-1, 0], a: [-1, 0],
      arrowdown: [0, 1], s: [0, 1], arrowright: [1, 0], d: [1, 0],
    };
    const direction = keys[event.key.toLowerCase()];
    if (event.key.toLowerCase() === "e" || event.key === " " && event.target === map) {
      event.preventDefault();
      act((s) => interact(s, s.player));
      return;
    }
    if (!direction) return;
    event.preventDefault();
    act((s) => step(s, ...direction));
  });
  gatherBtn.addEventListener("click", () => act((s) => interact(s, s.player)));
  function beginClock(): void {
    if (timer !== null) return;
    startedAt = performance.now() - state.elapsed * 1000;
    timer = setInterval(() => {
      const before = state;
      sync();
      if (state !== before) render();
    }, 250);
  }
  function startRound(): void {
    stopClock();
    tutorialCompleteUntil = null;
    state = newGame({ ...DEFAULT_OPTIONS, keep: keep.checked });
    roundStarted = true;
    startedAt = null;
    if (!tutorialEnabled) beginClock();
    render();
  }
  function chooseTutorial(enabled: boolean): void {
    tutorialEnabled = enabled;
    awaitingTutorial = false;
    startRound();
    map.focus();
  }
  confirmTutorial.addEventListener("click", () => chooseTutorial(true));
  skipTutorial.addEventListener("click", () => chooseTutorial(false));
  newBtn.addEventListener("click", () => {
    stopClock();
    state = newGame({ ...DEFAULT_OPTIONS, keep: keep.checked });
    startedAt = null;
    roundStarted = false;
    awaitingTutorial = true;
    tutorialCompleteUntil = null;
    render();
    confirmTutorial.focus({ preventScroll: true });
    map.scrollIntoView?.({ block: "center", behavior: "smooth" });
  });
  render();
  return () => { stopClock(); root.remove(); };
}

export const buildAVillage: Minigame = {
  slug: "buildavillage", title: "Build a Village!", motivators: ["progress"], author: "jessicafu232", mount,
};
