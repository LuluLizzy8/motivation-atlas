import { h } from "../../lib/dom";
import type { Minigame } from "../types";
import { hold, newGame, partnerOf, pass, rescue, roll, rollDie, type LifelineOptions, type LifelineState, type PlayerIndex } from "./game";
import "./lifeline.css";

const FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function name(player: PlayerIndex): string {
  return `Player ${player + 1}`;
}

function mount(el: HTMLElement): () => void {
  let options: LifelineOptions = { lifeline: true, target: 60, turns: 8 };
  let state: LifelineState = newGame(options);

  const score = h("span", { class: "lifeline-score", "data-score": "" }, "0");
  const turnCount = h("span", { class: "lifeline-turns", "data-turns": "" });
  const lines = [h("span", { class: "lifeline-line" }), h("span", { class: "lifeline-line" })];
  const die = h("div", { class: "lifeline-die", "aria-live": "polite" }, "–");
  const status = h("p", { class: "lifeline-status", "data-status": "", "aria-live": "polite" });
  const turn = h("span", { "data-turn": "" }, "0");
  const rollBtn = h("button", { type: "button", class: "lifeline-btn", "data-roll": "" }, "Roll");
  const holdBtn = h("button", { type: "button", class: "lifeline-btn", "data-hold": "" }, "Hold ", turn);
  const question = h("p", { class: "lifeline-question" });
  const throwBtn = h("button", { type: "button", class: "lifeline-btn", "data-rescue": "" }, "Throw lifeline");
  const passBtn = h("button", { type: "button", class: "lifeline-btn secondary", "data-pass": "" }, "Pass");
  const prompt = h("div", { class: "lifeline-prompt", hidden: true }, question, h("div", { class: "lifeline-actions" }, throwBtn, passBtn));
  const toggle = h("input", { type: "checkbox", "data-mechanic": "lifeline", checked: true });
  const newBtn = h("button", { type: "button", class: "lifeline-btn secondary", "data-new": "" }, "New game");

  const root = h("div", { class: "lifeline" },
    h("div", { class: "lifeline-board" },
      h("div", { class: "lifeline-team" }, h("span", { class: "lifeline-name" }, `Team score, goal ${options.target}`), score, turnCount),
      h("div", { class: "lifeline-players" },
        h("div", { class: "lifeline-player" }, h("span", {}, name(0)), lines[0]),
        h("div", { class: "lifeline-player" }, h("span", {}, name(1)), lines[1]),
      ),
      die, status,
      h("div", { class: "lifeline-actions" }, rollBtn, holdBtn),
      prompt,
    ),
    h("fieldset", { class: "lifeline-mechanics" },
      h("legend", {}, "Mechanic, applied when you start a new game"),
      h("label", {}, toggle, " Lifeline: when a player rolls a 1, their partner may spend their one lifeline to save the lost points"),
      newBtn,
    ),
    h("section", { class: "lifeline-reflect" },
      h("h4", {}, "Then check it against your own play"),
      h("ul", {},
        h("li", {}, "When your partner rolled a 1, what did you feel, and what did you do?"),
        h("li", {}, "Play once with the lifeline and once without. Did you roll, hold, or talk differently?"),
        h("li", {}, "Did it feel like one team, or two people taking turns?"),
      ),
    ),
  );
  el.append(root);

  function message(): string {
    if (state.outcome === "won") return `The team reached ${options.target} in ${state.turnsTaken} turns. Change the mechanic and play again.`;
    if (state.outcome === "lost") return `Out of turns at ${state.score} of ${options.target}. Change the mechanic and play again.`;
    const player = name(state.current);
    if (state.pendingRescue > 0) return `${player} rolled a 1.`;
    if (state.lastEvent === "rolled") return `${player}'s turn. Turn total ${state.turnTotal}. Roll again or hold.`;
    const before = {
      start: "", held: "", rolled: "",
      busted: "A 1. The points are gone. ",
      rescued: "Lifeline thrown. The points are saved. ",
      passed: "No lifeline. The points are gone. ",
    }[state.lastEvent];
    return `${before}${player}'s turn.`;
  }

  function render(): void {
    score.textContent = String(state.score);
    turnCount.textContent = `Turn ${Math.min(state.turnsTaken + 1, options.turns)} of ${options.turns}`;
    lines.forEach((line, i) => {
      line.hidden = !options.lifeline;
      line.textContent = state.lifelines[i] ? "lifeline ready" : "lifeline used";
    });
    die.textContent = state.lastRoll ? FACES[state.lastRoll] : "–";
    die.setAttribute("aria-label", state.lastRoll ? `Rolled ${state.lastRoll}` : "No roll yet");
    turn.textContent = String(state.turnTotal);
    status.textContent = message();
    const rolling = state.outcome === null && state.pendingRescue === 0;
    rollBtn.setAttribute("aria-disabled", String(!rolling));
    holdBtn.setAttribute("aria-disabled", String(!rolling || state.turnTotal === 0));
    prompt.hidden = rolling || state.outcome !== null;
    question.textContent = `${name(partnerOf(state.current))}: throw ${name(state.current)} a lifeline? (+${state.pendingRescue})`;
  }

  function act(next: (s: LifelineState) => LifelineState): void {
    state = next(state);
    render();
  }

  rollBtn.addEventListener("click", () => act((s) => roll(s, rollDie())));
  holdBtn.addEventListener("click", () => act(hold));
  throwBtn.addEventListener("click", () => act(rescue));
  passBtn.addEventListener("click", () => act(pass));
  newBtn.addEventListener("click", () => {
    options = { ...options, lifeline: toggle.checked };
    act(() => newGame(options));
  });

  render();
  return () => root.remove();
}

export const lifeline: Minigame = { slug: "lifeline", title: "Lifeline: save your partner", motivators: ["fellowship"], author: "jace-hong", mount };
