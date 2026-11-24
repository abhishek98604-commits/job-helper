export type Research = {
  company: string;
  needs: string[];
  productProblem: string;
};

export type Draft = {
  linkedin: string;
  opening: string;
  coverLetter: string[];
  gapNote: string;
};

export type Review = {
  round: 1 | 2;
  passed: boolean;
  notes: string[];
  ready: boolean;
};

export type WorkflowEvent =
  | {
      type: "status";
      step: "researcher" | "writer" | "reviewer";
      state: "running";
      round?: 1 | 2;
    }
  | { type: "research"; output: Research }
  | { type: "draft"; round: 1 | 2; output: Draft }
  | { type: "review"; review: Review }
  | { type: "waiting"; draft: Draft }
  | { type: "error"; message: string };

export type CompleteArgs = {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  effort: "low" | "medium";
};

export type CompleteFn = (args: CompleteArgs) => Promise<unknown>;

export class ModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelOutputError";
  }
}
