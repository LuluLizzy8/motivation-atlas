import { h } from "../../lib/dom";
import type { Minigame } from "../types";
import { cardName, cardEffect, chooseBotCard, createInitialGameState, illegalReason, legalCards, playTurn, score } from "./game";
import "./card-clash.css";

function mount(el: HTMLElement): () => void {
  let state = createInitialGameState();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const toggle = h("input", { type: "checkbox", checked: true, "data-mechanic": "randomized-mode" });
  const mode = h("p", { class: "clash-mode" });
  const scores = h("div", { class: "clash-scores", "aria-live": "polite" });
  const status = h("p", { role: "status" });
  const defenses = h("p", { "data-defense": "" });
  const bot = h("p", { "data-bot-hand": "" });
  const revealed = h("ul", { "data-revealed": "", "aria-live": "polite" });
  const hand = h("div", { class: "clash-hand", "aria-label": "Your hand" });
  const discards = h("p", { "data-discards": "" });
  const log = h("ol", { class: "clash-log", "aria-label": "Action log", "aria-live": "polite" });
  const restart = h("button", { type: "button" }, "New Game");
  const root = h("section", { class: "card-clash" },
    h("h3", {}, "Card Clash"),
    h("p", {}, "Finish with more points than the bot. You go first; play one legal card per turn. There is no drawing and no target score. The match ends when neither side has a legal card."),
    h("label", {}, toggle, " Randomized Mode"),
    h("p", {}, "ON: five cards each from a shuffled 29-card pool, at least three numbers each. OFF: both start with Number 1, Number 5, Number 11, Undo, Double. Changes apply only with New Game."),
    mode, restart, scores, status, defenses, bot, h("h4", {}, "Public information"),
    h("p", {}, "Reveal results are visible to both sides. Each entry records the hand at the time of reveal; it is not a current hand list."), revealed,
    h("h4", {}, "Your hand"), hand,
    h("details", {}, h("summary", {}, "Action rules and interactions"),
      h("p", {}, "Undo removes only the original points from the opponent's latest number; an existing Double bonus remains. A canceled number cannot be doubled. Each number can be canceled and doubled at most once. Actions must meet their prerequisites even if Defense will block them."),
      h("p", {}, "Defense blocks the next opposing action, including Double, Reveal, Defense, or Shuffle; that action is consumed. Numbers leave protection active. Shuffle itself is removed even when blocked. Otherwise it exchanges only the cards still in hand.")),
    h("h4", {}, "Played cards (discard piles)"), discards,
    h("h4", {}, "Action log"), log,
    h("p", { class: "clash-reflect" }, "Then check it against your own play: What did you feel? Did randomized versus fixed starting hands change your plan, card order, or sense of competition? Play both modes and compare."));
  el.append(root);

  function render(): void {
    const snapshot = state;
    mode.textContent = "Current game: " + (state.randomized ? "Randomized" : "Fixed")
      + " · Next game: " + (toggle.checked ? "Randomized" : "Fixed")
      + (toggle.checked !== state.randomized ? " (pending; press New Game)" : "");
    scores.replaceChildren(h("strong", {}, "You: " + score(state, "player")), h("strong", {}, "Bot: " + score(state, "bot")));
    status.textContent = state.outcome === null
      ? state.active === "player" ? "Your turn" : "Bot's turn…"
      : (state.outcome === "draw" ? "Draw!" : state.outcome === "player" ? "You win!" : "Bot wins!") + " Neither side has a legal card.";
    defenses.textContent = "Defense · You: " + (state.players.player.defense ? "protected" : "inactive")
      + " · Bot: " + (state.players.bot.defense ? "protected" : "inactive");
    bot.textContent = "Bot hand: " + state.players.bot.hand.length + " hidden cards."
      + (state.randomized ? "" : " Known starting composition only: Number 1, Number 5, Number 11, Undo, Double.");

    revealed.replaceChildren(...(state.publicReveals.length ? state.publicReveals.map(entry => h("li", {},
      (entry.actor === "player" ? "You" : "Bot") + " used Reveal: " + cardName(entry.card)
      + " — in " + (entry.owner === "player" ? "your" : "the bot's") + " hand at reveal. " + cardEffect(entry.card)))
      : [h("li", {}, "No cards revealed yet.")]));
    const yourTurn = state.active === "player" && state.outcome === null;
    hand.replaceChildren(...state.players.player.hand.map(card => {
      const reason = illegalReason(state, "player", card);
      const button = h("button", { type: "button", class: "clash-card", "data-card": card.id },
        h("strong", {}, cardName(card)), h("span", {}, card.kind === "number" ? "Number" : "Action"),
        h("span", {}, cardEffect(card)),
        reason ? h("span", { class: "clash-unavailable" }, reason) : null);
      button.disabled = !yourTurn || reason !== null;
      button.addEventListener("click", () => { if (state === snapshot) act(card.id); });
      return button;
    }));
    if (yourTurn && !legalCards(state, "player").length) {
      const pass = h("button", { type: "button", "data-pass": "" }, "Pass (no legal cards)");
      pass.addEventListener("click", () => { if (state === snapshot) act(null); });
      hand.append(pass);
    }
    if (!state.players.player.hand.length) hand.append(h("p", {}, "No cards in hand."));
    const played = (side: "player" | "bot"): string => state.players[side].discard.map(card => {
      const history = state.players[side].numbers.find(play => play.card.id === card.id);
      return cardName(card) + (history?.canceled ? " [canceled]" : "") + (history?.doubled ? " [doubled]" : "");
    }).join(", ") || "none";
    discards.textContent = "You played: " + played("player") + ". Bot played: " + played("bot")
      + ". Removed from game: " + (state.removed.map(cardName).join(", ") || "none") + ".";
    log.replaceChildren(...state.log.map(entry => h("li", {}, entry)));
  }

  function act(id: string | null): void {
    if (state.active !== "player" || state.outcome !== null) return;
    const next = playTurn(state, "player", id);
    if (next === state) return;
    state = next;
    render();
    if (state.active === "bot" && state.outcome === null && timer === null) {
      timer = setTimeout(() => {
        timer = null;
        const choice = chooseBotCard(state);
        state = playTurn(state, "bot", choice.id, Math.random, choice.reason);
        render();
      }, 650);
    }
  }
  toggle.addEventListener("change", render);
  restart.addEventListener("click", () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    state = createInitialGameState(toggle.checked);
    render();
  });
  render();
  return () => { if (timer !== null) clearTimeout(timer); root.remove(); };
}
export const cardClash: Minigame = { slug: "card-clash", title: "Card Clash", motivators: ["chance"], author: "Annniway026", mount };
