// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drainNourishment, rankScores, ROOM_DRAIN_RATES } from "../src/minigames/golden-sprint/game";
import { goldenSprint } from "../src/minigames/golden-sprint";

describe("Golden Sprint hunger toggle", () => {
  it("applies the room drain only when enabled and preserves explicit damage", () => {
    expect(ROOM_DRAIN_RATES).toEqual([1.728, 2.448, 3.168, 3.888]);
    expect(drainNourishment(100, 5, true, ROOM_DRAIN_RATES[0])).toBeCloseTo(91.36);
    expect(drainNourishment(100, 5, false, ROOM_DRAIN_RATES[0])).toBe(100);
    expect(drainNourishment(4, 5, true, ROOM_DRAIN_RATES[3])).toBe(0);

    const enemyDamage = 12;
    expect(drainNourishment(100 - enemyDamage, 5, false, ROOM_DRAIN_RATES[0])).toBe(88);
  });

  it("injects the tested hunger rule and room rates into the playable platformer", () => {
    const host = document.createElement("div");
    const unmount = goldenSprint.mount(host);
    const srcdoc = host.querySelector("iframe")?.getAttribute("srcdoc") ?? "";

    expect(srcdoc).toContain("window.GoldenSprintRules");
    expect(srcdoc).toContain("roomDrainRates:[1.728,2.448,3.168,3.888]");
    expect(srcdoc).toContain("drainNourishment(game.health,dt,settings.drainHP,l.drain)");
    expect(srcdoc).not.toContain("fonts.googleapis.com");
    expect(srcdoc).not.toContain("fonts.gstatic.com");
    expect(srcdoc).toContain("cleanName(input.value)||'Midas'");
    expect(host.textContent).toContain("Then check it against your own play");
    expect(host.textContent).toContain("hunger drain on");
    unmount();
  });

  it("ranks leaderboard entries by points and then fastest time", () => {
    const ranked = rankScores([
      { name: "A", time: 70, points: 500 },
      { name: "B", time: 80, points: 700 },
      { name: "C", time: 60, points: 700 },
    ]);
    expect(ranked.map((entry) => entry.name)).toEqual(["C", "B", "A"]);
  });
});
