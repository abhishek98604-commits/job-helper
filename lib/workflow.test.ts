import assert from "node:assert/strict";
import test from "node:test";
import { styleNotes, wordCount } from "./style";
import type { CompleteFn, Draft, Research } from "./types";
import { initialView, reduceView } from "./view";
import { runWorkflow } from "./workflow";

const research: Research = {
  company:
    "Northwind Tools makes billing software for small shops. The product takes card payments.",
  needs: [
    "Ship the billing page",
    "Write clear specs",
    "Use TypeScript",
    "Work with SQL",
    "Talk with support staff",
  ],
  productProblem: "Failed card payments still block checkout.",
};

const cleanDraft: Draft = {
  opening: "Applying for the Product Engineer role at Northwind.",
  gapNote: "",
  linkedin:
    "The product engineer role needs a billing page. Sample Candidate built that page at Northwind Tools and tracked the three most common card errors. Failed card payments still block checkout, which is a useful problem to raise.",
  coverLetter: [
    "The billing page at Northwind Tools maps to the payment work in this role.",
    "Search work at Harbor Maps shows comfort with a staff-facing page.",
    "TypeScript and React are the tools used for that work.",
    "The card-error problem is a concrete topic for a first conversation.",
  ],
};

const dirtyDraft: Draft = {
  opening: "Applying for the role.",
  gapNote: "",
  linkedin: "I'm excited to leverage my passion for this innovative role!",
  coverLetter: [
    "I built payments.",
    "This work used TypeScript.",
    "Harbor Maps was the earlier job.",
    "The note stays short.",
  ],
};

test("style notes catch the writer rules", () => {
  assert.equal(wordCount(cleanDraft.linkedin) < 80, true);
  assert.deepEqual(styleNotes(cleanDraft), []);
  const notes = styleNotes(dirtyDraft).join(" ");
  assert.match(notes, /contraction/i);
  assert.match(notes, /flowery|jargon/i);
  assert.match(notes, /Do not start a sentence with "I"/);
  assert.match(notes, /exclamation/i);
});

function scripted(sequence: unknown[]): CompleteFn {
  const queue = [...sequence];
  return async (args) => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    if (next === undefined) {
      throw new Error(`Unexpected call: ${args.user.slice(0, 40)}`);
    }
    return next;
  };
}

test("a clean first draft skips the rewrite", async () => {
  const events: unknown[] = [];
  await runWorkflow({
    jobPost: "A long enough job post for the researcher to read today.",
    resume: "Sample Candidate built a billing page.",
    complete: scripted([
      research,
      cleanDraft,
      { passed: true, notes: [] },
    ]),
    emit: (event) => events.push(event),
  });

  const drafts = events.filter(
    (event) =>
      typeof event === "object" &&
      event !== null &&
      "type" in event &&
      event.type === "draft",
  );
  assert.equal(drafts.length, 1);
  const reviews = events.filter(
    (event) =>
      typeof event === "object" &&
      event !== null &&
      "type" in event &&
      event.type === "review",
  );
  assert.equal(reviews.length, 1);
  assert.equal(
    (reviews[0] as { review: { ready: boolean } }).review.ready,
    true,
  );
  assert.equal(events.at(-1) && (events.at(-1) as { type: string }).type, "waiting");
});

test("one failed review gets a single rewrite, then the draft is ready", async () => {
  const events: unknown[] = [];
  await runWorkflow({
    jobPost: "A long enough job post for the researcher to read today.",
    resume: "Sample Candidate built a billing page.",
    complete: scripted([
      research,
      dirtyDraft,
      { passed: true, notes: [] },
      cleanDraft,
      { passed: true, notes: [] },
    ]),
    emit: (event) => events.push(event),
  });

  const reviews = events.filter(
    (event): event is { type: "review"; review: { ready: boolean; passed: boolean } } =>
      typeof event === "object" &&
      event !== null &&
      "type" in event &&
      event.type === "review",
  );
  assert.equal(reviews[0]?.review.passed, false);
  assert.equal(reviews[0]?.review.ready, false);
  assert.equal(reviews.at(-1)?.review.ready, true);
  assert.equal(reviews.at(-1)?.review.passed, true);

  let view = initialView;
  for (const event of events) {
    view = reduceView(view, event as never);
  }
  assert.equal(view.phase, "waiting");
  assert.equal(view.writerRounds.length, 2);
  assert.equal(view.draft?.linkedin, cleanDraft.linkedin);
  assert.match(view.statusLine, /Waiting for you/);
});

test("a second imperfect draft is still handed to the human", async () => {
  const events: unknown[] = [];
  await runWorkflow({
    jobPost: "A long enough job post for the researcher to read today.",
    resume: "Sample Candidate built a billing page.",
    complete: scripted([
      research,
      dirtyDraft,
      { passed: false, notes: ["Remove the contraction."] },
      dirtyDraft,
      { passed: false, notes: ["Remove the contraction."] },
    ]),
    emit: (event) => events.push(event),
  });

  const types = events.map((event) => (event as { type: string }).type);
  assert.equal(types.filter((type) => type === "draft").length, 2);
  const lastReview = events.filter((event) => (event as { type: string }).type === "review").at(-1) as {
    review: { ready: boolean; passed: boolean };
  };
  assert.equal(lastReview.review.ready, true);
  assert.equal(lastReview.review.passed, false);
  assert.equal((events.at(-1) as { type: string }).type, "waiting");
});
