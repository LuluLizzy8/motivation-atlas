export interface ConversationLine {
  speaker: "Maya" | "Livy";
  text: string;
}

export interface StickyNote {
  day: "Wednesday" | "Thursday" | "Friday";
  lines: ConversationLine[];
}

export interface NoteView {
  key: StickyNote["day"];
  day: StickyNote["day"] | null;
  lines: ConversationLine[];
}

export type NoteDirection = "earlier" | "later";

export const NOTES: StickyNote[] = [
  {
    day: "Wednesday",
    lines: [
      { speaker: "Maya", text: "Are you still coming to my parents' dinner Saturday? I told Mum we'd both be there." },
      { speaker: "Livy", text: "I said maybe. I don't want you telling them I promised when I haven't decided." },
    ],
  },
  {
    day: "Thursday",
    lines: [
      { speaker: "Livy", text: "I should've answered before you had to explain the change to your parents." },
      { speaker: "Maya", text: "I wasn't upset that you felt unsure. I was hurt that I had to explain it alone." },
      { speaker: "Livy", text: "I get that. I'm sorry I got defensive." },
    ],
  },
  {
    day: "Friday",
    lines: [
      { speaker: "Maya", text: "Would you still want our Friday dinner tonight, just us? Our pizza night routine?" },
      { speaker: "Livy", text: "Yes, I'd love that. Let's also talk about tomorrow when we meet, like not over text." },
    ],
  },
];

export function initialOrder(): StickyNote[] {
  return [NOTES[2], NOTES[0], NOTES[1]];
}

/** Move one note one position while preserving the other notes' relative order. */
export function moveNote(notes: StickyNote[], index: number, direction: NoteDirection): StickyNote[] {
  const destination = index + (direction === "earlier" ? -1 : 1);
  if (index < 0 || index >= notes.length || destination < 0 || destination >= notes.length) return notes;
  const moved = [...notes];
  [moved[index], moved[destination]] = [moved[destination], moved[index]];
  return moved;
}

export function presentNotes(notes: StickyNote[], revealContext: boolean): NoteView[] {
  return notes.map((note) => ({
    key: note.day,
    day: revealContext ? note.day : null,
    lines: note.lines,
  }));
}
