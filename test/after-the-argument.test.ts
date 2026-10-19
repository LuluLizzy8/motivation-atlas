// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { afterTheArgument } from "../src/minigames/after-the-argument";
import { initialOrder, moveNote, NOTES, presentNotes } from "../src/minigames/after-the-argument/game";

describe("After the Argument rules", () => {
  it("starts with the notes out of chronological order and limits each to two or three messages", () => {
    expect(NOTES.map((note) => note.day)).toEqual(["Wednesday", "Thursday", "Friday"]);
    expect(NOTES.every((note) => note.lines.length >= 2 && note.lines.length <= 3)).toBe(true);
    expect(initialOrder().map((note) => note.day)).toEqual(["Friday", "Wednesday", "Thursday"]);
  });

  it("moves a note one place while preserving the other notes' order", () => {
    const initial = initialOrder();
    const moved = moveNote(initial, 0, "later");
    expect(moved.map((note) => note.day)).toEqual(["Wednesday", "Friday", "Thursday"]);
    expect(initial.map((note) => note.day)).toEqual(["Friday", "Wednesday", "Thursday"]);
    expect(moveNote(initial, 0, "earlier")).toBe(initial);
    expect(moveNote(initial, 2, "later")).toBe(initial);
    expect(moveNote(initial, -1, "later")).toBe(initial);
  });

  it("reveals dates without changing the player's chosen note order or dialogue", () => {
    const order = moveNote(initialOrder(), 0, "later");
    const hidden = presentNotes(order, false);
    const revealed = presentNotes(order, true);
    expect(hidden.map((note) => note.day)).toEqual([null, null, null]);
    expect(revealed.map((note) => note.day)).toEqual(["Wednesday", "Friday", "Thursday"]);
    expect(hidden.map((note) => note.lines)).toEqual(order.map((note) => note.lines));
    expect(revealed.map((note) => note.lines)).toEqual(order.map((note) => note.lines));
  });
});

describe("After the Argument interface", () => {
  it("supports ordering notes before revealing their dates and speakers", () => {
    const el = document.createElement("div");
    const unmount = afterTheArgument.mount(el);
    const initial = initialOrder();
    const getNoteKeys = () => [...el.querySelectorAll<HTMLElement>(".argument-note")].map((note) => note.dataset.noteKey);
    const expectedTotalLines = initial.reduce((total, note) => total + note.lines.length, 0);

    expect(getNoteKeys()).toEqual(["Friday", "Wednesday", "Thursday"]);
    expect(el.querySelectorAll(".argument-line")).toHaveLength(expectedTotalLines);
    expect([...el.querySelectorAll(".argument-note")].map((note) => note.querySelectorAll(".argument-line").length)).toEqual(initial.map((note) => note.lines.length));
    expect(el.querySelector(".argument-speaker")).toBeNull();
    expect(el.querySelector(".argument-note-meta")).toBeNull();
    expect(el.querySelector(".argument-notes")!.hasAttribute("aria-live")).toBe(false);
    expect(el.querySelector(".argument-status")!.getAttribute("aria-live")).toBe("polite");

    const fridayLater = el.querySelector<HTMLButtonElement>('[data-note-key="Friday"][data-move="later"]')!;
    expect(fridayLater.dataset.mechanic).toBe("story-order");
    fridayLater.click();
    const chosenOrder = [NOTES[0], NOTES[2], NOTES[1]];
    expect(getNoteKeys()).toEqual(["Wednesday", "Friday", "Thursday"]);
    expect(el.querySelector(".argument-status")!.textContent).toContain("Moved one note later");

    const expectedSpeakers = chosenOrder.flatMap((note) => note.lines.map((line) => `${line.speaker}: `));
    const reveal = el.querySelector<HTMLInputElement>("[data-mechanic='context-reveal']")!;
    reveal.checked = true;
    reveal.dispatchEvent(new Event("change"));
    expect([...el.querySelectorAll(".argument-note-meta")].map((node) => node.textContent)).toEqual(["Wednesday", "Friday", "Thursday"]);
    expect([...el.querySelectorAll(".argument-speaker")].map((node) => node.textContent)).toEqual(expectedSpeakers);
    expect(getNoteKeys()).toEqual(["Wednesday", "Friday", "Thursday"]);

    reveal.checked = false;
    reveal.dispatchEvent(new Event("change"));
    expect(el.querySelectorAll(".argument-note-meta")).toHaveLength(0);
    expect(el.querySelectorAll(".argument-speaker")).toHaveLength(0);
    expect(getNoteKeys()).toEqual(["Wednesday", "Friday", "Thursday"]);
    unmount();
    expect(el.childNodes).toHaveLength(0);
  });

  it("has the required slug, Fantasy motivator, mechanics, and reflection", () => {
    expect(afterTheArgument.slug).toBe("after-the-argument");
    expect(afterTheArgument.motivators).toContain("fantasy");
    const el = document.createElement("div");
    const unmount = afterTheArgument.mount(el);
    expect(el.querySelector("[data-mechanic='story-order']")).not.toBeNull();
    expect(el.querySelector("[data-mechanic='context-reveal']")).not.toBeNull();
    expect(el.textContent).toContain("How did arranging the story");
    unmount();
  });
});
