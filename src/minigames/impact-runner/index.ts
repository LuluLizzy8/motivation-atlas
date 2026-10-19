import { h, s } from "../../lib/dom";
import type { Minigame } from "../types";
import { jump, newRun, step, ROUND_SECONDS } from "./game";
import "./runner.css";

function mount(el: HTMLElement): () => void {
  let state = newRun();
  let frame = 0;
  let previous = 0;
  let burst = 0;
  let landing = 0;
  const effects = h("input", { type: "checkbox", checked: true, "data-mechanic": "enhanced-jump-feedback" });
  const status = h("p", { class: "ir-status", role: "status" }, "Ready. Start a run, then jump over each trash bin.");
  const score = h("p", { class: "ir-score" });
  const neutralPose = "M0 -40 L0 -20 M0 -34 L-12 -24 M0 -34 L12 -26 M0 -20 L-10 0 M0 -20 L10 0";
  const limbs = s("path", { d: neutralPose });
  const player = s("g", { class: "ir-person", "stroke-linecap": "round", "stroke-linejoin": "round" },
    s("circle", { cx: 0, cy: -48, r: 7 }),
    limbs);
  const block = s("g", { class: "ir-bin", "stroke-linecap": "round", "stroke-linejoin": "round" },
    s("path", { d: "M3 8 H27 L25 38 H5 Z" }),
    s("path", { d: "M1 8 H29 M5 4 H25 M11 4 V1 H19 V4 M10 14 L11 31 M20 14 L19 31" }));
  const flames = s("g", { class: "ir-flames", "aria-hidden": "true" },
    s("path", { d: "M-24 4 Q-42 -20 -20 -48 L-14 -22 Q-5 -38 0 -67 Q9 -43 12 -22 L25 -43 Q37 -10 24 4 Z" }),
    s("path", { class: "ir-flame-core", d: "M-11 4 Q-20 -10 -7 -25 L0 -15 L7 -35 Q23 -8 11 4 Z" }));
  const impact = s("g", { class: "ir-impact", "aria-hidden": "true" },
    s("ellipse", { cx: 100, cy: 200, rx: 37, ry: 7 }),
    s("path", { d: "M63 194 L51 180 M73 188 L68 171 M137 194 L149 180 M127 188 L132 171" }));
  const board = s("svg", { viewBox: "0 0 640 240", role: "img", "aria-label": "Stick figure running toward line-drawn trash bins. Jump to clear them.", class: "ir-board" },
    s("path", { d: "M0 201 H640", class: "ir-ground" }), block, flames, player, impact);
  const start = h("button", { type: "button" }, "Start run");
  const jumpButton = h("button", { type: "button", disabled: true }, "Jump ↑ / Space");
  const root = h("div", { class: "impact-runner" },
    h("div", { class: "ir-heading" }, h("strong", {}, "IMPACT RUNNER")),
    score, board, status,
    h("div", { class: "ir-controls" }, start, jumpButton),
    h("label", { class: "ir-toggle" }, effects, " Sensation effects and animations"),
    h("p", { class: "ir-hint" }, "Jump with the button, Space, or ↑ while the game has focus. Hit a trash bin and the run ends. Survive 90 seconds to finish. The effects toggle also animates the running stride and jump pose. Change it anytime; the rules stay the same."),
    h("section", { class: "ir-reflect" },
      h("h4", {}, "Check it against your own play"),
      h("ul", {},
        h("li", {}, "Does the same jump feel more powerful with flames?"),
        h("li", {}, "Was the feedback exciting, distracting, or irrelevant?"),
        h("li", {}, "Did switching the mechanic change your actions or feelings?"),
      ),
    ),
  );
  el.append(root);
  function render() {
    player.setAttribute("transform", `translate(100 ${200 - state.y})`);
    // Cosmetic poses only: the collision box and jump trajectory stay fixed.
    let pose = neutralPose;
    if (effects.checked && state.phase === "running") {
      if (state.y > 0 || state.velocity > 0) {
        const tuck = Math.max(0, Math.min(1, state.y / 70));
        const lift = 12 * tuck;
        pose = `M0 -40 L0 -20 M0 -34 L-10 -42 L-14 -48 M0 -34 L11 -40 L16 -46 M0 -20 L-11 ${-10 - lift} L-5 ${-lift} M0 -20 L12 ${-17 - lift / 2} L17 ${-5 - lift}`;
      } else {
        const stride = Math.sin(state.elapsed * 20);
        const swing = stride * 14;
        pose = `M0 -40 L0 -20 M0 -34 L${-swing} -27 L${-swing + 5} -34 M0 -34 L${swing} -27 L${swing + 5} -34 M0 -20 L${swing / 2} -10 L${swing} ${-Math.max(0, stride) * 7} M0 -20 L${-swing / 2} -10 L${-swing} ${-Math.max(0, -stride) * 7}`;
      }
    }
    limbs.setAttribute("d", pose);
    block.setAttribute("transform", `translate(${state.block.x} 162)`);
    const rising = state.velocity > 0;
    flames.setAttribute("transform", `translate(100 ${200 - state.y}) scale(1 ${rising ? -1 : 1})`);
    flames.style.opacity = effects.checked ? String(state.y > 0 || rising ? 1 : Math.min(1, burst * 4)) : "0";
    impact.style.opacity = effects.checked ? String(Math.min(1, landing * 4)) : "0";
    score.textContent = `${state.cleared} bins cleared · ${Math.min(ROUND_SECONDS, Math.floor(state.elapsed))} / ${ROUND_SECONDS}s`;
    jumpButton.disabled = state.phase !== "running";
  }
  function doJump() {
    const next = jump(state);
    if (next !== state) { state = next; burst = .35; render(); }
  }
  function tick(now: number) {
    if (document.hidden) { previous = now; frame = requestAnimationFrame(tick); return; }
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 0;
    previous = now;
    const old = state;
    state = step(state, dt);
    burst = Math.max(0, burst - dt);
    landing = Math.max(0, landing - dt);
    if (old.y > 0 && state.y === 0) landing = .35;
    if (state.cleared > old.cleared) burst = .4;
    render();
    if (state.phase === "running") frame = requestAnimationFrame(tick);
    else {
      burst = 0; landing = 0; render();
      status.textContent = state.phase === "lost" ? `Trash bin hit — run over! You cleared ${state.cleared}. Try again with the effects switched.` : "90 seconds cleared! Try the other setting and compare how it feels.";
      start.textContent = "Run again";
    }
  }
  const onStart = () => {
    cancelAnimationFrame(frame);
    state = { ...newRun(), phase: "running" }; previous = 0; burst = 0; landing = 0;
    status.textContent = "Running — jump before the trash bin reaches you.";
    start.textContent = "Restart run";
    render(); jumpButton.focus(); frame = requestAnimationFrame(tick);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.target === effects || event.target === start) return;
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      if (!event.repeat) doJump();
    }
  };
  start.addEventListener("click", onStart);
  jumpButton.addEventListener("click", doJump);
  effects.addEventListener("change", render);
  root.addEventListener("keydown", onKey);
  render();
  return () => {
    cancelAnimationFrame(frame);
    start.removeEventListener("click", onStart);
    jumpButton.removeEventListener("click", doJump);
    effects.removeEventListener("change", render);
    root.removeEventListener("keydown", onKey);
    root.remove();
  };
}
export const impactRunner: Minigame = {
  slug: "impact-runner", title: "Impact Runner", motivators: ["sensation"], author: "@alexhekmat", mount,
};
