// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { escape, LOOT, newRound, nextTrip, steal } from "../src/minigames/sleeping-dragon/game";
import { dragonsHoard } from "../src/minigames/sleeping-dragon";

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

describe("Dragon's Hoard rules", () => {
  it("changes only forfeiture when the same rolls wake the dragon", () => {
    for (const dropLoot of [true, false]) {
      let state = escape(steal(newRound(dropLoot), 5)); // 20 already banked
      state = nextTrip(state);
      state = steal(steal(state, 6), 3); // 60 carried
      const before = state;
      state = steal(state, 1);
      expect(state.banked).toBe(dropLoot ? 20 : 80);
      expect(state.carried).toBe(0);
      expect(state.phase).toBe("between");
      expect(state.results[1]).toEqual({ trip: 2, outcome: "caught", attempts: 3,
        haul: 60, secured: dropLoot ? 0 : 60 });
      expect(before.carried).toBe(60); // transitions preserve their input
    }
  });

  it("uses identical rewards in both modes and banks the whole bag on escape", () => {
    for (const dropLoot of [true, false]) {
      let state = newRound(dropLoot);
      for (const face of [2, 3, 4, 5, 6]) state = steal(state, face);
      expect(state.carried).toBe(100);
      expect(state.banked).toBe(0);
      state = escape(state);
      expect(state.banked).toBe(100);
      expect(state.results[0].attempts).toBe(5);
      expect(LOOT.slice(2)).toEqual([5, 10, 15, 20, 50]);
    }
  });

  it("ends after exactly three trips and ignores further actions", () => {
    let state = newRound();
    for (let trip = 1; trip <= 3; trip++) {
      expect(state.trip).toBe(trip);
      state = steal(state, 1);
      expect(steal(state, 6)).toBe(state);
      expect(escape(state)).toBe(state);
      if (trip < 3) state = nextTrip(state);
    }
    expect(state.phase).toBe("finished");
    expect(state.results).toHaveLength(3);
    expect(nextTrip(state)).toBe(state);
  });

  it("ignores an empty escape and rejects impossible die faces", () => {
    const state = newRound();
    expect(escape(state)).toBe(state);
    expect(nextTrip(state)).toBe(state);
    for (const face of [0, 7, 1.5, NaN, Infinity]) expect(() => steal(state, face)).toThrow(RangeError);
  });
});

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = dragonsHoard.mount(host);
  const q = <T extends HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  return { host, unmount, q };
}

describe("Dragon's Hoard controls", () => {
  it("keeps a pending toggle from changing the current round's losses", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { q, unmount } = mount();
    q<HTMLButtonElement>("[data-steal]").click();
    expect(q("[data-carried]").textContent).toBe("50");
    q<HTMLInputElement>("[data-mechanic]").click();
    expect(q("[data-setting]").textContent).toContain("Pending");
    random.mockReturnValue(0);
    q<HTMLButtonElement>("[data-steal]").click();
    expect(q("[data-banked]").textContent).toBe("0");
    expect(q("[role='status']").textContent).toContain("dropping 50");
    q<HTMLButtonElement>("[data-new]").click();
    expect(q("[data-mode]").textContent).toBe("Loot loss OFF");
    random.mockReturnValue(0.99);
    q<HTMLButtonElement>("[data-steal]").click();
    random.mockReturnValue(0);
    q<HTMLButtonElement>("[data-steal]").click();
    expect(q("[data-banked]").textContent).toBe("50");
    expect(q("[role='status']").textContent).toContain("keeping 50");
    unmount();
  });

  it("finishes, asks for reflection, and resets cleanly with the last result", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { q, host, unmount } = mount();
    for (let i = 0; i < 3; i++) {
      q<HTMLButtonElement>("[data-steal]").click();
      q<HTMLButtonElement>("[data-escape]").click();
      if (i < 2) q<HTMLButtonElement>("[data-next]").click();
    }
    expect(q("[data-banked]").textContent).toBe("150");
    expect(q(".dh-reflect").hidden).toBe(false);
    expect(q(".dh-reflect").textContent).toContain("What did you feel");
    q<HTMLButtonElement>("[data-steal]").click();
    expect(q("[data-banked]").textContent).toBe("150");
    q<HTMLButtonElement>("[data-new]").click();
    expect(q("[data-previous]").textContent).toContain("150 gold");
    expect(q("[data-banked]").textContent).toBe("0");
    expect(q(".dh-reflect").hidden).toBe(true);
    unmount();
    expect(host.childNodes).toHaveLength(0);
  });
});
