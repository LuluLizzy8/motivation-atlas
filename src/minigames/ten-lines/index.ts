import { h, s } from "../../lib/dom";
import type { Minigame } from "../types";
import {
  cells, COLS, dealer, fallIntervalMs, hardDrop, landing, level, move, newGame, rotate, ROWS, spawn, stars, step,
  type Kind, type TenLinesOptions, type TenLinesState,
} from "./game";
import { loadLog, LOG_LIMIT, recordOf, saveLog, settingsLabel, summarize, type GameRecord, type Placement } from "./log";
import { dynamicsFor } from "./sources";
import "./ten-lines.css";

const SHOWN_GAMES = 8;
const KEYS: Record<string, "left" | "right" | "rotate" | "down" | "drop" | "pause"> = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "rotate", ArrowDown: "down", " ": "drop", p: "pause", P: "pause",
};

/** The browser's storage, or nothing where it is switched off. */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function mount(el: HTMLElement): () => void {
  let options: TenLinesOptions = { rising: true, target: 10 };
  let draw = dealer();
  let state: TenLinesState = newGame(options, draw(), draw());
  let phase: "ready" | "running" | "paused" | "over" = "ready";
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Play time, not counting pauses: what was banked, plus the stretch running now.
  let bankedMs = 0;
  let runningSince: number | null = null;
  // What the play log will keep about the game in progress.
  let startedAt = "";
  let placements: Placement[] = [];
  let records: GameRecord[] = loadLog(storage());

  const squares = Array.from({ length: COLS * ROWS }, () => h("div", { class: "tl-cell" }));
  const board = h("div", { class: "tl-board", tabindex: 0, role: "img", "data-board": "" }, ...squares);
  const nextSquares = Array.from({ length: 8 }, () => h("div", { class: "tl-cell" }));
  const lines = h("span", { class: "tl-stat-value", "data-lines": "" });
  const speed = h("span", { class: "tl-stat-value", "data-level": "" });
  const clock = h("span", { class: "tl-stat-value", "data-time": "" });
  const status = h("p", { class: "tl-status", "data-status": "", "aria-live": "polite" });
  const control = (name: string, label: string, text: string) =>
    h("button", { type: "button", class: "tl-btn", "data-control": name, "aria-label": label }, text);
  const leftBtn = control("left", "Move left", "←");
  const rightBtn = control("right", "Move right", "→");
  const rotateBtn = control("rotate", "Rotate", "↻");
  const downBtn = control("down", "Move down one row", "↓");
  const dropBtn = control("drop", "Drop to the bottom", "Drop");
  const newBtn = h("button", { type: "button", class: "tl-btn wide", "data-new": "" }, "Start");
  const pauseBtn = h("button", { type: "button", class: "tl-btn wide secondary", "data-pause": "" }, "Pause");
  const rising = h("input", { type: "checkbox", "data-mechanic": "rising-difficulty", checked: true });
  const logCount = h("span", { "data-log-count": "" });
  const logBody = h("div", { class: "tl-log-body", "data-log": "" });
  const downloadBtn = h("button", { type: "button", class: "tl-btn wide secondary", "data-log-download": "" }, "Download log");
  const clearBtn = h("button", { type: "button", class: "tl-btn wide secondary", "data-log-clear": "" }, "Clear log");
  const spark = s("svg", { class: "tl-spark", viewBox: "0 0 300 60", role: "img", "aria-label": "How tall the stack stood after each piece" });
  const speedText = h("p", { class: "tl-note", "data-speed": "" });
  const dynamics = h("ul", { class: "tl-dynamics", "data-dynamics": "" });

  const root = h("div", { class: "tl" },
    h("div", { class: "tl-play" },
      h("div", { class: "tl-stats" },
        h("div", { class: "tl-stat" }, h("span", { class: "tl-stat-name" }, "Lines"), lines),
        h("div", { class: "tl-stat" }, h("span", { class: "tl-stat-name" }, "Speed"), speed),
        h("div", { class: "tl-stat" }, h("span", { class: "tl-stat-name" }, "Time"), clock),
        h("div", { class: "tl-stat" }, h("span", { class: "tl-stat-name" }, "Next"), h("div", { class: "tl-next", "aria-hidden": "true" }, ...nextSquares)),
      ),
      board, status,
      h("div", { class: "tl-controls" }, leftBtn, rotateBtn, rightBtn, downBtn, dropBtn),
      h("div", { class: "tl-actions" }, newBtn, pauseBtn),
      h("p", { class: "tl-note" }, "Keyboard: arrow keys to move, up to rotate, space to drop, P to pause."),
    ),
    h("fieldset", { class: "tl-mechanics" },
      h("legend", {}, "The mechanic, applied when you start a new game"),
      h("label", {}, rising, " Rising difficulty: pieces fall a fifth faster every 2 lines you clear. Off, they keep their starting speed."),
    ),
    h("section", { class: "tl-panel" },
      h("h4", {}, "What the sources say emerges"),
      spark,
      h("p", { class: "tl-note" }, "The height of your stack after each piece. The top line is where the game ends."),
      speedText, dynamics,
    ),
    h("section", { class: "tl-reflect" },
      h("h4", {}, "Then check it against your own play"),
      h("ul", {},
        h("li", {}, "What did you feel as the last lines came down, and when you cleared the tenth or topped out?"),
        h("li", {}, "Turn rising difficulty off and play again. Notice what changed: in what you did, and in how it felt."),
        h("li", {}, "Did your experience match what the sources say emerges? Where did it differ?"),
      ),
    ),
    h("details", { class: "tl-log" },
      h("summary", {}, "Play log: ", logCount),
      h("p", { class: "tl-note" }, `Every game you play here is recorded: the toggle's setting, the result, and where each piece landed. The last ${LOG_LIMIT} games are kept in this browser only; nothing is sent anywhere.`),
      logBody,
      h("div", { class: "tl-actions" }, downloadBtn, clearBtn),
    ),
  );
  el.append(root);

  const elapsedMs = () => bankedMs + (runningSince === null ? 0 : Date.now() - runningSince);
  const seconds = () => Math.floor(elapsedMs() / 1000);

  function message(): string {
    const left = options.target - state.lines;
    const togo = `${left} ${left === 1 ? "line" : "lines"} to go`;
    if (state.over === "won") {
      const earned = stars(seconds());
      return `Ten lines in ${seconds()} seconds: ${"★".repeat(earned)}${"☆".repeat(3 - earned)} (${earned} of 3 stars). Play again for a better mark, or flip the toggle and see how it feels.`;
    }
    if (state.over === "lost") return `The stack reached the top with ${togo}. Try again, or flip the toggle and see how it feels.`;
    if (phase === "ready") return "Clear 10 lines before the stack reaches the top. Press Start.";
    if (phase === "paused") return `Paused, with ${togo}.`;
    return state.lastEvent === "cleared" && options.rising && state.lines % 2 === 0 ? `${togo}. The pieces fall faster now.` : `${togo}.`;
  }

  function drawBoard(): void {
    const falling = new Set(state.over ? [] : cells(state.piece).map(([x, y]) => y * COLS + x));
    const ghost = new Set(phase === "running" ? cells(landing(state)).map(([x, y]) => y * COLS + x) : []);
    squares.forEach((square, i) => {
      const kind: Kind | null = falling.has(i) ? state.piece.kind : state.board[Math.floor(i / COLS)][i % COLS];
      square.setAttribute("data-kind", kind ?? "");
      square.classList.toggle("tl-ghost", kind === null && ghost.has(i));
    });
    const preview = spawn(state.next);
    const top = Math.min(...cells(preview).map(([, y]) => y));
    const shown = new Set(cells(preview).map(([x, y]) => (y - top) * 4 + (x - preview.x)));
    nextSquares.forEach((square, i) => square.setAttribute("data-kind", shown.has(i) && !state.over ? state.next : ""));
    board.setAttribute("aria-label", `Playing field, ${COLS} columns by ${ROWS} rows. The stack is ${state.heightHistory.at(-1)} rows tall.`);
  }

  function drawSpark(): void {
    const history = state.heightHistory;
    const x = (i: number) => (history.length === 1 ? 2 : (i / (history.length - 1)) * 296 + 2);
    const y = (rows: number) => 58 - (rows / ROWS) * 56;
    spark.replaceChildren(
      s("line", { x1: 0, y1: 2, x2: 300, y2: 2, class: "tl-ceiling" }),
      s("polyline", { points: history.map((rows, i) => `${x(i)},${y(rows)}`).join(" "), class: "tl-height-line" }),
    );
  }

  function table(head: string[], rows: string[][]): HTMLElement {
    return h("div", { class: "tl-table" }, h("table", {},
      h("thead", {}, h("tr", {}, ...head.map((text) => h("th", { scope: "col" }, text)))),
      h("tbody", {}, ...rows.map((row) => h("tr", {}, ...row.map((text) => h("td", {}, text))))),
    ));
  }

  function drawLog(): void {
    logCount.textContent = `${records.length} ${records.length === 1 ? "game" : "games"}`;
    if (records.length === 0) {
      logBody.replaceChildren(h("p", { class: "tl-note" }, "No games yet."));
      return;
    }
    const result = (r: GameRecord) => (r.outcome === "won" ? `Won, ${r.stars} of 3 stars` : r.outcome === "lost" ? "Topped out" : "Left unfinished");
    logBody.replaceChildren(
      h("h5", {}, "Toggle on and off"),
      table(["Setting", "Games", "Won", "Average lines", "Best time"],
        summarize(records).map((g) => [g.label, String(g.games), String(g.won), String(g.averageLines), g.bestSeconds === null ? "none yet" : `${g.bestSeconds}s`])),
      h("h5", {}, "Most recent games"),
      table(["Started", "Setting", "Result", "Lines", "Time", "Pieces"],
        records.slice(-SHOWN_GAMES).reverse().map((r) => [
          new Date(r.startedAt).toLocaleString(), settingsLabel(r.options), result(r), String(r.lines), `${r.seconds}s`, String(r.placements.length),
        ])),
    );
  }

  /** Close the game in progress and add it to the log. A game with no piece placed is not worth keeping. */
  function logGame(outcome: GameRecord["outcome"]): void {
    if (placements.length > 0) records = saveLog(storage(), [...records, recordOf(startedAt, state, seconds(), placements, outcome)]);
    placements = [];
    drawLog();
  }

  function render(): void {
    drawBoard();
    drawSpark();
    lines.textContent = `${Math.min(state.lines, options.target)}/${options.target}`;
    speed.textContent = String(level(state) + 1);
    clock.textContent = `${seconds()}s`;
    status.textContent = message();
    newBtn.textContent = phase === "ready" ? "Start" : "New game";
    pauseBtn.textContent = phase === "paused" ? "Resume" : "Pause";
    // aria-disabled instead of disabled, as in Pig: a disabled button drops keyboard focus.
    pauseBtn.setAttribute("aria-disabled", String(phase === "ready" || phase === "over"));
    for (const btn of [leftBtn, rightBtn, rotateBtn, downBtn, dropBtn]) btn.setAttribute("aria-disabled", String(phase !== "running"));
    speedText.textContent = `A piece now falls one row every ${(fallIntervalMs(state) / 1000).toFixed(2)} seconds.`;
    dynamics.replaceChildren(...dynamicsFor(options).map((text) => h("li", {}, text)));
  }

  function stopTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function schedule(): void {
    stopTimer();
    if (phase !== "running") return;
    timer = setTimeout(() => {
      timer = null;
      apply(step(state, draw()));
    }, fallIntervalMs(state));
  }

  function apply(next: TenLinesState): void {
    const landed = next.heightHistory !== state.heightHistory;
    if (landed) {
      const { kind, rot, x, y } = landing(state);
      placements.push({ t: Math.round(elapsedMs()), kind, rot, x, y, cleared: next.lines - state.lines, height: next.heightHistory.at(-1) ?? 0 });
    }
    state = next;
    if (state.over) {
      bankedMs = elapsedMs();
      runningSince = null;
      phase = "over";
      stopTimer();
      logGame(state.over);
    }
    render();
    // A fresh piece gets a full interval before it falls; a move or a turn leaves the clock alone.
    if (phase === "running" && (timer === null || landed)) schedule();
  }

  function pause(): void {
    if (phase === "running") {
      bankedMs = elapsedMs();
      runningSince = null;
      phase = "paused";
      stopTimer();
    } else if (phase === "paused") {
      runningSince = Date.now();
      phase = "running";
      schedule();
    }
    render();
  }

  const whilePlaying = (act: (current: TenLinesState) => TenLinesState) => () => {
    if (phase === "running") apply(act(state));
  };
  const actions = {
    left: whilePlaying((current) => move(current, -1)),
    right: whilePlaying((current) => move(current, 1)),
    rotate: whilePlaying(rotate),
    down: whilePlaying((current) => step(current, draw())),
    drop: whilePlaying((current) => hardDrop(current, draw())),
    pause,
  };

  leftBtn.addEventListener("click", actions.left);
  rightBtn.addEventListener("click", actions.right);
  rotateBtn.addEventListener("click", actions.rotate);
  downBtn.addEventListener("click", actions.down);
  dropBtn.addEventListener("click", actions.drop);
  pauseBtn.addEventListener("click", pause);
  newBtn.addEventListener("click", () => {
    if (phase === "running" || phase === "paused") logGame("abandoned");
    options = { ...options, rising: rising.checked };
    draw = dealer();
    state = newGame(options, draw(), draw());
    startedAt = new Date().toISOString();
    placements = [];
    bankedMs = 0;
    runningSince = Date.now();
    phase = "running";
    render();
    schedule();
    board.focus({ preventScroll: true });
  });
  root.addEventListener("keydown", (event) => {
    const action = KEYS[event.key];
    // The toggle keeps its own keys, and space on a button already presses it.
    if (!action || event.target instanceof HTMLInputElement) return;
    if (event.key === " " && event.target instanceof HTMLButtonElement) return;
    if (phase !== "running" && action !== "pause") return;
    event.preventDefault();
    actions[action]();
  });
  downloadBtn.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }));
    h("a", { href: url, download: "ten-lines-log.json" }).click();
    URL.revokeObjectURL(url);
  });
  clearBtn.addEventListener("click", () => {
    records = saveLog(storage(), []);
    drawLog();
  });
  const onHidden = () => { if (document.hidden && phase === "running") pause(); };
  document.addEventListener("visibilitychange", onHidden);

  render();
  drawLog();
  return () => {
    if (phase === "running" || phase === "paused") logGame("abandoned");
    stopTimer();
    document.removeEventListener("visibilitychange", onHidden);
    root.remove();
  };
}

export const tenLines: Minigame = { slug: "ten-lines", title: "Ten Lines: the climb gets steeper", motivators: ["challenge"], author: "rohitr4547", mount };
