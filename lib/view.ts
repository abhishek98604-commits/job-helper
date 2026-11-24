import type { Draft, Research, Review, WorkflowEvent } from "./types";

export type StepId = "researcher" | "writer" | "reviewer" | "approval";

export type ViewState = {
  phase: "idle" | "running" | "waiting" | "error";
  active: StepId | null;
  research: Research | null;
  writerRounds: { round: 1 | 2; draft: Draft }[];
  reviews: Review[];
  draft: Draft | null;
  error: string | null;
  statusLine: string;
};

export const initialView: ViewState = {
  phase: "idle",
  active: null,
  research: null,
  writerRounds: [],
  reviews: [],
  draft: null,
  error: null,
  statusLine: "Paste a job post, then run the agents.",
};

const runningCopy: Record<"researcher" | "writer" | "reviewer", string> = {
  researcher: "Researcher is reading the job post.",
  writer: "Writer is drafting from the research and your resume.",
  reviewer: "Reviewer is checking the draft against the rules.",
};

export function reduceView(state: ViewState, event: WorkflowEvent): ViewState {
  switch (event.type) {
    case "status":
      return {
        ...state,
        phase: "running",
        active: event.step,
        error: null,
        statusLine:
          event.step === "writer" && event.round === 2
            ? "Writer is revising once, using the reviewer notes."
            : runningCopy[event.step],
      };
    case "research":
      return { ...state, research: event.output };
    case "draft":
      return {
        ...state,
        writerRounds: [
          ...state.writerRounds.filter((round) => round.round !== event.round),
          { round: event.round, draft: event.output },
        ],
      };
    case "review":
      return {
        ...state,
        reviews: [
          ...state.reviews.filter((review) => review.round !== event.review.round),
          event.review,
        ],
        statusLine: event.review.ready
          ? "Reviewer marked the draft ready."
          : "Reviewer sent notes back to the writer.",
      };
    case "waiting":
      return {
        ...state,
        phase: "waiting",
        active: "approval",
        draft: event.draft,
        error: null,
        statusLine: "Waiting for you. Nothing is final until you approve.",
      };
    case "error":
      return {
        ...state,
        phase: "error",
        error: event.message,
        statusLine: event.message,
      };
    default:
      return state;
  }
}
