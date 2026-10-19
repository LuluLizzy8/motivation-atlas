import { h } from "../../lib/dom";
import type { Minigame } from "../types";
import {
  BOARD_SIZE,
  TOTAL_ROUNDS,
  guessTile,
  newGame,
  nextRound,
  samePosition,
  type FishGameState,
  type GuessFeedback,
  type Position,
} from "./game";
import "./find-the-fish.css";

const CLUE_MARKS: Record<GuessFeedback, string> = {
  found: "🐟",
  strong: "🐟",
  faint: "🐾",
  none: "💨",
  unguided: "—",
};

const CLUE_LABELS: Record<GuessFeedback, string> = {
  found: "Fish found",
  strong: "Very strong scent",
  faint: "Faint scent",
  none: "No fish smell",
  unguided: "Empty tile",
};

function feedbackMessage(feedback: GuessFeedback | null): string {
  if (feedback === "found") return "You found the dried fish! 🐱🐟";
  if (feedback === "strong") return "🐟 Very strong scent! The fish is nearby!";
  if (feedback === "faint") return "🐾 A faint scent... Keep exploring!";
  if (feedback === "none") return "💨 No fish smell around here.";
  if (feedback === "unguided") return "Nothing here. Keep searching!";
  return "Choose a mystery tile to begin the search.";
}

function positionFor(index: number): Position {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

function mount(el: HTMLElement): () => void {
  let state: FishGameState = newGame(true);

  const roundValue = h("strong", { "data-round": "" }, "1 of 3");
  const guessValue = h("strong", { "data-guesses": "" }, "0");
  const totalValue = h("span", { "data-total-guesses": "" }, "0 total");
  const toggle = h("input", {
    type: "checkbox",
    checked: true,
    "data-mechanic": "scent-hints",
    "aria-describedby": "fish-toggle-help",
  });
  const modeText = h("strong", { class: "fish-mode", "data-mode": "" }, "ON");
  const feedback = h("p", { class: "fish-feedback", role: "status", "aria-live": "polite", "data-feedback": "" });
  const board = h("div", { class: "fish-grid", role: "group", "aria-label": "Four by four search grid" });
  const actionButton = h("button", { type: "button", class: "fish-action", hidden: true, "data-action": "" }, "Next round");
  const result = h("p", { class: "fish-result", hidden: true, "data-result": "" });
  const reflection = h("section", { class: "fish-reflect", hidden: true, "data-reflection": "" },
    h("h4", {}, "Then check it against your own play"),
    h("ul", {},
      h("li", {}, "Did scent hints change how you chose your next tile?"),
      h("li", {}, "Which mode made you feel more curious or engaged?"),
      h("li", {}, "Did having clues make the search more enjoyable or less mysterious?"),
    ),
  );

  const tiles = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const position = positionFor(index);
    const tile = h("button", {
      type: "button",
      class: "fish-tile",
      "data-tile": String(index),
      "aria-label": `Hidden tile, row ${position.row + 1}, column ${position.col + 1}`,
    }, h("span", { "aria-hidden": "true" }, "?"));
    tile.addEventListener("click", () => {
      const next = guessTile(state, position);
      if (next === state) return;
      state = next;
      render();
      if (state.phase !== "playing") actionButton.focus();
    });
    board.append(tile);
    return tile;
  });

  const root = h("div", { class: "find-fish" },
    h("div", { class: "fish-intro" },
      h("div", { class: "fish-cat", "aria-hidden": "true" }, "🐱"),
      h("div", {},
        h("h3", {}, "Find the Fish"),
        h("p", {}, "A curious cat, sixteen hiding places, and one very fragrant prize."),
      ),
    ),
    h("label", { class: "fish-toggle" },
      h("span", {}, h("strong", {}, "Scent Hints"), h("small", { id: "fish-toggle-help" }, "Changing this restarts all 3 rounds.")),
      h("span", { class: "fish-switch" }, toggle, h("span", { class: "fish-track", "aria-hidden": "true" })),
      modeText,
    ),
    h("div", { class: "fish-stats", "aria-label": "Game progress" },
      h("span", {}, "Round ", roundValue),
      h("span", {}, "Guesses ", guessValue),
      totalValue,
    ),
    board,
    feedback,
    result,
    actionButton,
    reflection,
  );
  el.append(root);

  function renderTile(tile: HTMLButtonElement, index: number): void {
    const position = positionFor(index);
    const reveal = state.revealed.find((entry) => samePosition(entry.position, position));
    const unavailable = Boolean(reveal) || state.phase !== "playing";
    tile.disabled = unavailable;
    tile.className = `fish-tile${reveal ? ` is-revealed clue-${reveal.feedback}` : ""}`;
    const mark = tile.firstElementChild;
    if (mark) mark.textContent = reveal ? CLUE_MARKS[reveal.feedback] : "?";
    tile.setAttribute("aria-label", reveal
      ? `${CLUE_LABELS[reveal.feedback]}, row ${position.row + 1}, column ${position.col + 1}`
      : `Hidden tile, row ${position.row + 1}, column ${position.col + 1}`);
  }

  function render(): void {
    roundValue.textContent = `${state.round} of ${TOTAL_ROUNDS}`;
    guessValue.textContent = String(state.roundGuesses);
    totalValue.textContent = `${state.totalGuesses} total`;
    modeText.textContent = state.scentHints ? "ON" : "OFF";
    feedback.textContent = feedbackMessage(state.lastFeedback);
    tiles.forEach(renderTile);

    const finishedRound = state.phase === "round-won";
    const complete = state.phase === "complete";
    actionButton.hidden = state.phase === "playing";
    actionButton.textContent = complete ? "Play again" : "Next round";
    result.hidden = !complete;
    reflection.hidden = !complete;
    if (complete) {
      const breakdown = state.completedRoundGuesses.map((guesses, index) => `R${index + 1}: ${guesses}`).join(" · ");
      result.textContent = `Search complete in ${state.totalGuesses} guesses (${breakdown}). Try the other mode and compare.`;
    } else if (finishedRound) {
      result.textContent = "";
    }
  }

  toggle.addEventListener("change", () => {
    state = newGame(toggle.checked);
    render();
    feedback.textContent = `Scent Hints ${toggle.checked ? "ON" : "OFF"}. A fresh game has started.`;
  });

  actionButton.addEventListener("click", () => {
    if (state.phase === "round-won") {
      state = nextRound(state);
    } else if (state.phase === "complete") {
      state = newGame(toggle.checked);
    }
    render();
    tiles[0].focus();
  });

  render();
  return () => root.remove();
}

export const findTheFish: Minigame = {
  slug: "find-the-fish",
  title: "Find the Fish: Scent Hints",
  motivators: ["discovery"],
  author: "zhstella",
  mount,
};
