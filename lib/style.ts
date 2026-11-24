import type { Draft } from "./types";

const CONTRACTIONS =
  /\b(?:i'm|i've|i'll|i'd|you're|you've|you'll|you'd|he's|she's|it's|we're|we've|we'll|we'd|they're|they've|they'll|they'd|that's|there's|here's|what's|who's|where's|let's|don't|doesn't|didn't|can't|couldn't|won't|wouldn't|shouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|mustn't|needn't|ain't)\b/gi;

const FLOWERY =
  /\b(?:passionate|thrilled|excited|leverage|leveraging|synergy|utilize|utilizing|robust|seamless|cutting-edge|delve|foster|ecosystem|impactful|innovative|world-class|groundbreaking|empower|transformative|stakeholders?|bandwidth|deliverables?|holistic|spearhead)\b/gi;

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function plain(text: string): string {
  return text.replace(/[’‘]/g, "'");
}

export function styleNotes(draft: Draft): string[] {
  const notes: string[] = [];
  const linkedin = plain(draft.linkedin).trim();
  const bullets = draft.coverLetter.map((bullet) => plain(bullet).trim());
  const count = wordCount(linkedin);

  if (!linkedin) {
    notes.push("Write a LinkedIn message.");
  } else if (count >= 80) {
    notes.push(
      `The LinkedIn message is ${count} words. Make it shorter than 80 words.`,
    );
  }

  if (bullets.length < 4 || bullets.length > 6) {
    notes.push("Write 4 to 6 cover letter bullets.");
  }

  const pieces = [
    linkedin,
    plain(draft.opening ?? "").trim(),
    ...bullets,
    plain(draft.gapNote ?? "").trim(),
  ].filter(Boolean);
  const contractions = new Set<string>();
  const flowery = new Set<string>();
  const iStarts: string[] = [];

  for (const piece of pieces) {
    for (const match of piece.match(CONTRACTIONS) ?? []) {
      contractions.add(match.toLowerCase());
    }
    for (const match of piece.match(FLOWERY) ?? []) {
      flowery.add(match.toLowerCase());
    }
    if (piece.includes("!")) {
      notes.push("Remove exclamation marks.");
    }
    for (const sentence of piece.split(/\n+|(?<=[.!?])\s+/)) {
      const trimmed = sentence.trim();
      if (/^I\b/.test(trimmed)) iStarts.push(trimmed);
    }
  }

  if (contractions.size > 0) {
    notes.push(
      `Remove contractions: ${Array.from(contractions).join(", ")}.`,
    );
  }
  if (flowery.size > 0) {
    notes.push(
      `Remove jargon or flowery words: ${Array.from(flowery).join(", ")}.`,
    );
  }
  if (iStarts.length > 0) {
    notes.push(
      `Do not start a sentence with "I": "${iStarts[0]}"`,
    );
  }

  return dedupe(notes);
}

export function dedupe(notes: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const note of notes) {
    const clean = note.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result.slice(0, 8);
}
