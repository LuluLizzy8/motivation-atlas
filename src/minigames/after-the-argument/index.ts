import { h } from "../../lib/dom";
import type { Minigame } from "../types";
import { initialOrder, moveNote, presentNotes, type NoteDirection, type StickyNote } from "./game";
import "./notes.css";

function mount(el: HTMLElement): () => void {
  let order = initialOrder();
  const reveal = h("input", { type: "checkbox", "data-mechanic": "context-reveal" });
  const notes = h("div", { class: "argument-notes" });
  const status = h("p", { class: "argument-status", "aria-live": "polite", "aria-atomic": "true" },
    "Your timeline is ready to arrange.",
  );

  function move(note: StickyNote, direction: NoteDirection): void {
    const currentIndex = order.indexOf(note);
    const nextOrder = moveNote(order, currentIndex, direction);
    if (nextOrder === order) return;
    order = nextOrder;
    status.textContent = `Moved one note ${direction}. Keep arranging, or reveal the dates and speakers when ready.`;
    renderNotes();
    notes.querySelector<HTMLButtonElement>(`[data-note-key="${note.day}"] [data-move="${direction}"]`)?.focus();
  }

  function renderNotes(): void {
    notes.replaceChildren(...presentNotes(order, reveal.checked).map((note, index) => {
      const label = note.day ? h("p", { class: "argument-note-meta" }, note.day) : null;
      const paragraphs = note.lines.map((line) => h("p", { class: "argument-line" },
        ...(reveal.checked ? [h("span", { class: "argument-speaker" }, `${line.speaker}: `)] : []),
        line.text,
      ));
      const earlier = h("button", {
        type: "button",
        class: "argument-move",
        "data-mechanic": "story-order",
        "data-note-key": note.key,
        "data-move": "earlier",
        "aria-label": `Move sticky note ${index + 1} earlier`,
        disabled: index === 0,
      }, "Earlier");
      const later = h("button", {
        type: "button",
        class: "argument-move",
        "data-mechanic": "story-order",
        "data-note-key": note.key,
        "data-move": "later",
        "aria-label": `Move sticky note ${index + 1} later`,
        disabled: index === order.length - 1,
      }, "Later");
      earlier.addEventListener("click", () => move(order[index], "earlier"));
      later.addEventListener("click", () => move(order[index], "later"));

      return h("article", { class: "argument-note", "aria-label": `Sticky note ${index + 1}`, "data-note-key": note.key },
        h("p", { class: "argument-note-number" }, `Note ${index + 1}`),
        label,
        ...paragraphs,
        h("div", { class: "argument-note-controls" }, earlier, later),
      );
    }));
  }

  reveal.addEventListener("change", () => {
    status.textContent = reveal.checked
      ? "Dates and speakers are shown. Compare them with the timeline you chose."
      : "Dates and speakers are hidden. Arrange the notes from earliest to latest, then reveal the context when ready.";
    renderNotes();
  });

  const root = h("div", { class: "after-argument" },
    h("p", { class: "argument-intro" }, "Reconstruct Maya and Livy's week. Use the Earlier and Later buttons to put the notes in the order you think events happened. Reveal the dates and speakers to compare your timeline. There is no score."),
    status,
    h("label", { class: "argument-toggle" }, reveal, " Reveal dates and who wrote each line"),
    notes,
    h("section", { class: "argument-reflect" },
      h("h4", {}, "Then check it against your own reading"),
      h("ul", {},
        h("li", {}, "What clues led you to arrange the notes in that order?"),
        h("li", {}, "After revealing the dates and names, did you change your timeline or your reading of the two people?"),
        h("li", {}, "How did arranging the story and revealing its context affect how you felt about Maya and Livy?"),
      ),
    ),
  );
  el.append(root);
  renderNotes();
  return () => root.remove();
}

export const afterTheArgument: Minigame = {
  slug: "after-the-argument",
  title: "After the Argument",
  motivators: ["fantasy"],
  author: "erica-ll",
  mount,
};
