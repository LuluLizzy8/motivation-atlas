import { h, s } from "../../lib/dom";
import type { Minigame } from "../types";
import { escape, LOOT, newRound, nextTrip, steal, TRIPS, type HoardState } from "./game";
import "./hoard.css";

// Original vector illustration; no downloaded art or runtime requests.
function chamber(): SVGSVGElement {
  const coin = (x: number, y: number, r = 7) => s("ellipse", {
    cx: x, cy: y, rx: r, ry: r * 0.45, class: "dh-coin",
  });
  return s("svg", { viewBox: "0 0 640 280", class: "dh-scene", "aria-hidden": "true" },
    s("path", { d: "M0 0H640V280H0Z", class: "dh-cave" }),
    s("path", { d: "M0 0H90L63 82 40 48 0 112ZM170 0L195 47 219 0ZM410 0L440 64 470 0ZM560 0L590 110 615 56 640 87V0Z", class: "dh-rock" }),
    s("ellipse", { cx: 338, cy: 249, rx: 258, ry: 23, class: "dh-shadow" }),
    s("path", { d: "M120 247Q148 192 203 205Q242 152 297 189Q340 158 391 207Q465 185 508 247Z", class: "dh-gold" }),
    ...[[152, 236], [183, 222], [212, 237], [242, 211], [267, 232], [294, 207], [326, 226], [355, 208], [391, 235], [425, 221], [462, 239]].map(([x, y]) => coin(x, y)),
    s("g", { class: "dh-dragon" },
      s("path", { d: "M246 203C137 217 90 174 129 146C145 136 166 147 157 161C139 169 177 191 240 170Z", class: "dh-body" }),
      s("ellipse", { cx: 326, cy: 173, rx: 101, ry: 51, class: "dh-body" }),
      s("path", { d: "M298 158L283 66Q338 81 376 143L344 127 327 151 314 133Z", class: "dh-wing" }),
      s("path", { d: "M290 83L327 151M290 83L344 127", class: "dh-wing-line" }),
      s("path", { d: "M368 172Q371 124 400 120L445 141 485 152Q507 169 486 185L424 188 399 203Z", class: "dh-body" }),
      s("path", { d: "M396 127L385 97 419 119M430 137L436 112 453 144", class: "dh-horn" }),
      s("path", { d: "M273 208Q290 183 318 203L330 223H270ZM362 209Q381 188 407 209L414 223H358Z", class: "dh-body" }),
      s("path", { d: "M422 155Q431 163 440 155", class: "dh-eye-sleep" }),
      s("path", { d: "M418 156Q432 140 444 156Q430 172 418 156Z", class: "dh-eye-awake" }),
      s("path", { d: "M431 149V163", class: "dh-pupil" }),
      s("circle", { cx: 481, cy: 163, r: 3, class: "dh-nostril" }),
      s("path", { d: "M457 180H484", class: "dh-mouth" }),
    ),
    s("text", { x: 494, y: 123, class: "dh-zzz" }, "z z z"),
    s("path", { d: "M216 212L224 198 233 212 224 225Z", class: "dh-ruby" }),
    s("path", { d: "M402 236L410 222 420 236 410 248Z", class: "dh-ruby" }),
  );
}

function mount(el: HTMLElement): () => void {
  let state: HoardState = newRound();
  let previous: { banked: number; dropLoot: boolean } | null = null;
  const trip = h("span", { class: "dh-eyebrow", "data-trip": "" });
  const mode = h("span", { class: "dh-mode", "data-mode": "" });
  const carried = h("strong", { "data-carried": "" });
  const banked = h("strong", { "data-banked": "" });
  const atRisk = h("p", { class: "dh-risk", "data-risk": "" });
  const status = h("p", { class: "dh-status", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  const stealButton = h("button", { type: "button", class: "dh-button", "data-steal": "" }, "Steal treasure");
  const escapeButton = h("button", { type: "button", class: "dh-button dh-secondary", "data-escape": "" }, "Escape & bank");
  const nextButton = h("button", { type: "button", class: "dh-button", "data-next": "", hidden: true }, "Enter next trip");
  const toggle = h("input", { type: "checkbox", checked: true, "data-mechanic": "drop-loot-when-caught" });
  const setting = h("p", { class: "dh-setting", "data-setting": "" });
  const newButton = h("button", { type: "button", class: "dh-button dh-secondary", "data-new": "" }, "New round");
  const ledger = h("ol", { class: "dh-ledger", "aria-label": "Trip results" });
  const previousText = h("p", { class: "dh-previous", "data-previous": "", hidden: true });
  const reflect = h("section", { class: "dh-reflect", hidden: true },
    h("h4", {}, "You made it out. How did it feel?"),
    h("p", {}, "When did you decide to escape? What did you feel before stealing again, and when the dragon woke? Change the loss toggle, start a new round, and compare what you did and felt."),
    h("p", {}, "The rolls are random in both modes, so one higher score alone does not explain a change in your decisions."),
  );
  const root = h("div", { class: "dh" },
    h("div", { class: "dh-board" },
      h("div", { class: "dh-topline" }, trip, mode),
      chamber(),
      h("div", { class: "dh-scoreboard" },
        h("div", {}, h("span", {}, "In your bag"), carried),
        h("div", {}, h("span", {}, "Safely banked"), banked),
      ),
      atRisk, status,
      h("div", { class: "dh-actions" }, stealButton, escapeButton, nextButton),
      h("p", { class: "dh-odds" }, "Every steal: 1 in 6 wakes the dragon. Otherwise: 5, 10, 15, 20, or 50 gold, each equally likely. The odds stay the same."),
    ),
    h("fieldset", { class: "dh-settings" },
      h("legend", {}, "Change one rule"),
      h("label", { class: "dh-toggle" }, toggle, " Drop carried loot when caught"),
      setting,
      newButton,
    ),
    h("section", { class: "dh-results" }, h("h4", {}, "Your three trips"), ledger, previousText),
    reflect,
  );
  el.append(root);

  function render(): void {
    const active = state.phase === "stealing";
    const last = state.results.at(-1);
    const caught = !active && last?.outcome === "caught";
    root.dataset.awake = String(caught);
    trip.textContent = state.phase === "finished" ? "Round complete · 3 trips" : `Trip ${state.trip} / ${TRIPS}`;
    mode.textContent = state.dropLoot ? "Loot loss ON" : "Loot loss OFF";
    carried.textContent = String(state.carried);
    banked.textContent = String(state.banked);
    atRisk.textContent = active
      ? state.dropLoot ? `${state.carried} gold at risk if the dragon wakes.` : "Your bag is protected. Waking the dragon still ends this trip."
      : state.phase === "finished" ? `Final haul: ${state.banked} gold.` : "Take a breath. Your banked gold is safe.";
    if (active) {
      status.textContent = state.lastRoll === null
        ? "The dragon is asleep. How much is enough?"
        : `Rolled ${state.lastRoll}. ${state.lastRoll === 6 ? "A ruby!" : "Quiet hands."} +${LOOT[state.lastRoll]} gold. Steal again or escape?`;
    } else if (caught && last) {
      status.textContent = state.dropLoot
        ? `Rolled 1. One golden eye opens. You run, dropping ${last.haul} gold. Trip ${last.trip} ends.`
        : `Rolled 1. One golden eye opens. You run, keeping ${last.secured} gold. Trip ${last.trip} ends.`;
    } else if (last) {
      status.textContent = `You slip outside with ${last.secured} gold. Trip ${last.trip} ends.`;
    }
    // Keep unavailable actions focusable and guard them in the rules.
    stealButton.setAttribute("aria-disabled", String(!active));
    escapeButton.setAttribute("aria-disabled", String(!active || state.carried === 0));
    nextButton.hidden = state.phase !== "between";
    nextButton.textContent = `Enter trip ${state.trip + 1}`;
    reflect.hidden = state.phase !== "finished";
    setting.textContent = toggle.checked === state.dropLoot
      ? "Applied for this round. Choose a setting, then press New round."
      : `Pending: loot loss ${toggle.checked ? "ON" : "OFF"}. Press New round to apply.`;
    ledger.replaceChildren(...Array.from({ length: TRIPS }, (_, i) => {
      const result = state.results[i];
      return h("li", {}, h("strong", {}, `Trip ${i + 1}`),
        h("span", {}, result
          ? `${result.outcome === "caught" ? "Caught" : "Escaped"} · ${result.attempts} ${result.attempts === 1 ? "steal" : "steals"} · ${result.secured} banked${result.haul > result.secured ? ` · ${result.haul - result.secured} lost` : ""}`
          : i + 1 === state.trip ? "In the chamber" : "Not entered yet"));
    }));
    previousText.hidden = previous === null;
    if (previous) previousText.textContent = `Previous completed round: ${previous.banked} gold · loot loss ${previous.dropLoot ? "ON" : "OFF"}.`;
  }

  stealButton.addEventListener("click", () => {
    if (state.phase !== "stealing") return;
    state = steal(state, Math.floor(Math.random() * 6) + 1);
    render();
    if (state.phase === "between") nextButton.focus();
    if (state.phase === "finished") newButton.focus();
  });
  escapeButton.addEventListener("click", () => {
    const next = escape(state);
    if (next === state) return;
    state = next;
    render();
    if (state.phase === "between") nextButton.focus();
    if (state.phase === "finished") newButton.focus();
  });
  nextButton.addEventListener("click", () => {
    state = nextTrip(state);
    render();
    stealButton.focus();
  });
  toggle.addEventListener("change", render);
  newButton.addEventListener("click", () => {
    if (state.phase === "finished") previous = { banked: state.banked, dropLoot: state.dropLoot };
    state = newRound(toggle.checked);
    render();
    stealButton.focus();
  });
  render();
  return () => root.remove();
}

export const dragonsHoard: Minigame = {
  slug: "sleeping-dragon",
  title: "Dragon’s Hoard",
  motivators: ["chance"],
  author: "adit-prabhu",
  mount,
};
