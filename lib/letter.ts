import type { Draft } from "./types";

// Fixed facts for the end of every letter. Change them here.
export const profile = {
  name: "Abhishek Bora",
  location: "Bangalore",
  notice: "15 days",
  portfolio: "https://abhishekbora.myportfolio.com/",
};

export function buildLetter(draft: Draft): string {
  const parts = [
    "Dear Hiring Team,",
    draft.opening,
    ["A quick summary of what I bring:", ...draft.coverLetter.map((b) => `- ${b}`)].join("\n"),
  ];
  if (draft.gapNote.trim()) parts.push(draft.gapNote.trim());
  parts.push(`I am based in ${profile.location}. Notice period is ${profile.notice}.`);
  parts.push(`Portfolio: ${profile.portfolio}`);
  parts.push(`Thanks,\n${profile.name}`);
  return parts.filter((p) => p.trim()).join("\n\n");
}
