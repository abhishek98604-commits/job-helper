"use client";

import { useMemo, useState, type FormEvent } from "react";
import { buildLetter } from "@/lib/letter";
import type { Draft, WorkflowEvent } from "@/lib/types";
import { wordCount } from "@/lib/style";
import { initialView, reduceView, type StepId, type ViewState } from "@/lib/view";

const steps: { id: StepId; label: string }[] = [
  { id: "researcher", label: "Researcher" },
  { id: "writer", label: "Writer" },
  { id: "reviewer", label: "Reviewer" },
  { id: "approval", label: "Waiting for you" },
];

const emptyOpen: Record<StepId, boolean> = {
  researcher: false,
  writer: false,
  reviewer: false,
  approval: false,
};

function stepLabel(id: StepId, view: ViewState, approved: boolean): string {
  if (id === "approval") {
    if (approved) return "Approved";
    if (view.phase === "waiting") return "Waiting for you";
    return "Not started";
  }
  if (view.active === id && (view.phase === "running" || view.phase === "error")) {
    return view.phase === "error" ? "Stopped" : "Working";
  }
  if (id === "researcher" && view.research) return "Done";
  if (id === "writer" && view.writerRounds.length > 0 && view.active !== "writer") {
    return "Done";
  }
  if (id === "reviewer" && view.reviews.some((review) => review.ready)) return "Ready";
  if (id === "reviewer" && view.reviews.length > 0 && view.active !== "reviewer") {
    return "Notes sent";
  }
  return "Not started";
}

function pillClass(label: string): string {
  if (label === "Working") return "working";
  if (label === "Waiting for you" || label === "Ready" || label === "Notes sent") {
    return "waiting";
  }
  if (label === "Approved" || label === "Done") return "approved";
  if (label === "Stopped") return "stopped";
  return "";
}

async function readEvents(
  response: Response,
  onEvent: (event: WorkflowEvent) => void,
): Promise<void> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "The run could not start.");
  }
  if (!response.body) throw new Error("The run returned no stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as WorkflowEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as WorkflowEvent);
}

export default function JobHelper() {
  const [jobPost, setJobPost] = useState("");
  const [view, setView] = useState<ViewState>(initialView);
  const [open, setOpen] = useState(emptyOpen);
  const [editing, setEditing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [linkedin, setLinkedin] = useState("");
  const [bullets, setBullets] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const draft = view.draft;
  const shownDraft = useMemo<Draft | null>(() => {
    if (!draft) return null;
    if (!editing) return draft;
    return {
      ...draft,
      linkedin,
      coverLetter: bullets
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };
  }, [bullets, draft, editing, linkedin]);

  function reveal(id: StepId) {
    setOpen((current) => ({ ...current, [id]: true }));
  }

  function apply(event: WorkflowEvent) {
    setView((current) => reduceView(current, event));
    if (event.type === "status") reveal(event.step);
    if (event.type === "research") reveal("researcher");
    if (event.type === "draft") reveal("writer");
    if (event.type === "review") reveal("reviewer");
    if (event.type === "waiting") {
      setOpen({ researcher: false, writer: false, reviewer: false, approval: true });
      setTimeout(() => {
        document
          .getElementById("step-approval")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      setApproved(false);
      setEditing(false);
    }
    if (event.type === "error") setFormError(event.message);
  }

  async function onRun(event: FormEvent) {
    event.preventDefault();
    const text = jobPost.trim();
    if (text.length < 40) {
      setFormError("Paste more of the job post before running.");
      return;
    }
    setFormError(null);
    setApproved(false);
    setEditing(false);
    setOpen(emptyOpen);
    setView({
      ...initialView,
      phase: "running",
      statusLine: "Starting the researcher.",
    });

    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPost: text }),
        signal: AbortSignal.timeout(240000),
      });
      let sawWaiting = false;
      let sawError = false;
      await readEvents(response, (workflowEvent) => {
        if (workflowEvent.type === "waiting") sawWaiting = true;
        if (workflowEvent.type === "error") sawError = true;
        apply(workflowEvent);
      });
      if (!sawWaiting && !sawError) {
        setView((current) =>
          current.phase === "error"
            ? current
            : reduceView(current, {
                type: "error",
                message: "The run stopped before a draft was ready.",
              }),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The run could not start.";
      setFormError(message);
      setView((current) => reduceView(current, { type: "error", message }));
    }
  }

  function startEdit() {
    if (!draft) return;
    setLinkedin(draft.linkedin);
    setBullets(draft.coverLetter.join("\n"));
    setEditing(true);
    setApproved(false);
    reveal("approval");
  }

  function saveEdit() {
    if (!shownDraft || !shownDraft.linkedin.trim() || shownDraft.coverLetter.length === 0) {
      setFormError("Keep a message and at least one bullet before saving.");
      return;
    }
    setFormError(null);
    setView((current) => ({
      ...current,
      phase: "waiting",
      draft: shownDraft,
      statusLine: "Waiting for you. Nothing is final until you approve.",
    }));
    setEditing(false);
  }

  function approve() {
    const next = editing ? shownDraft : draft;
    if (!next || !next.linkedin.trim() || next.coverLetter.length === 0) {
      setFormError("Keep a message and at least one bullet before approving.");
      return;
    }
    setFormError(null);
    setView((current) => ({
      ...current,
      phase: "waiting",
      active: "approval",
      draft: next,
      statusLine: "You approved this draft.",
    }));
    setEditing(false);
    setApproved(true);
  }

  const count = wordCount(editing ? linkedin : (draft?.linkedin ?? ""));
  const latestReview = view.reviews.at(-1);

  return (
    <main className="app">
      <header className="masthead">
        <div>
          <p className="eyebrow">Three agents, then you</p>
          <h1>Job Helper</h1>
        </div>
        <p className="lede">
          Paste a job post. The researcher, writer, and reviewer prepare a
          short note from resume.md. It stays a draft until you approve it.
        </p>
      </header>

      <div className="layout">
        <form className="panel" onSubmit={onRun}>
          <label htmlFor="job-post">Job post</label>
          <textarea
            id="job-post"
            value={jobPost}
            placeholder="Paste the job post here."
            onChange={(event) => setJobPost(event.target.value)}
            disabled={view.phase === "running"}
          />
          <p className="hint">
            The writer may use only this post and the resume file. It will not
            invent experience.
          </p>
          <div className="actions">
            <button type="submit" disabled={view.phase === "running" || jobPost.trim().length < 40}>
              {view.phase === "running" ? "Running" : "Run"}
            </button>
          </div>
        </form>

        <section>
          <p className="live" aria-live="polite">
            {view.statusLine}
          </p>
          {formError ? <p className="banner">{formError}</p> : null}
          <ol className="steps">
            {steps.map((step, index) => {
              const label = stepLabel(step.id, view, approved);
              return (
                <li key={step.id}>
                  <details
                    id={`step-${step.id}`}
                    className="step"
                    open={open[step.id]}
                    onToggle={(event) => {
                      const isOpen = event.currentTarget.open;
                      setOpen((current) => ({
                        ...current,
                        [step.id]: isOpen,
                      }));
                    }}
                  >
                    <summary>
                      <span className="index">{index + 1}</span>
                      <span className="step-name">{step.label}</span>
                      <span className={`pill ${pillClass(label)}`}>{label}</span>
                    </summary>
                    <div className="body">
                      {step.id === "researcher" ? (
                        <ResearchBody view={view} />
                      ) : null}
                      {step.id === "writer" ? <WriterBody view={view} /> : null}
                      {step.id === "reviewer" ? <ReviewerBody view={view} /> : null}
                      {step.id === "approval" ? (
                        <ApprovalBody
                          draft={draft}
                          editing={editing}
                          approved={approved}
                          linkedin={linkedin}
                          bullets={bullets}
                          count={count}
                          notes={latestReview && !latestReview.passed ? latestReview.notes : []}
                          onLinkedin={setLinkedin}
                          onBullets={setBullets}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={() => setEditing(false)}
                          onApprove={approve}
                        />
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
          <p className="footnote">
            Claude runs on the server with ANTHROPIC_API_KEY from .env.local.
            Replace the sample text in resume.md before you send a note.
          </p>
        </section>
      </div>
    </main>
  );
}

function ResearchBody({ view }: { view: ViewState }) {
  if (!view.research) return <p>Waiting for the job post.</p>;
  return (
    <>
      <h3>What the company does</h3>
      <p>{view.research.company}</p>
      <h3>Top needs</h3>
      <ol className="needs">
        {view.research.needs.map((need) => (
          <li key={need}>{need}</li>
        ))}
      </ol>
      <h3>Product problem</h3>
      <p>{view.research.productProblem}</p>
    </>
  );
}

function WriterBody({ view }: { view: ViewState }) {
  if (view.writerRounds.length === 0) return <p>Waiting for the research.</p>;
  return (
    <>
      {view.writerRounds.map((round) => (
        <div className="round" key={round.round}>
          <h3>{round.round === 1 ? "First draft" : "Revised draft"}</h3>
          <p className="draft-text">{round.draft.linkedin}</p>
          <p className="count">{wordCount(round.draft.linkedin)} words</p>
          <ul className="bullets">
            {round.draft.coverLetter.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function ReviewerBody({ view }: { view: ViewState }) {
  if (view.reviews.length === 0) return <p>Waiting for a draft.</p>;
  return (
    <>
      {view.reviews.map((review) => (
        <div className="round" key={review.round}>
          <h3>{review.round === 1 ? "First check" : "Second check"}</h3>
          <p>
            {review.ready
              ? "Marked the draft ready for you."
              : "Sent notes back to the writer for one more round."}
          </p>
          {review.notes.length > 0 ? (
            <ul className="notes">
              {review.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p>No rule breaks.</p>
          )}
        </div>
      ))}
    </>
  );
}

function ApprovalBody({
  draft,
  editing,
  approved,
  linkedin,
  bullets,
  count,
  notes,
  onLinkedin,
  onBullets,
  onEdit,
  onSave,
  onCancel,
  onApprove,
}: {
  draft: Draft | null;
  editing: boolean;
  approved: boolean;
  linkedin: string;
  bullets: string;
  count: number;
  notes: string[];
  onLinkedin: (value: string) => void;
  onBullets: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onApprove: () => void;
}) {
  if (!draft) return <p>The draft will wait here until you approve it.</p>;

  if (editing) {
    return (
      <>
        <label className="edit-label" htmlFor="linkedin-edit">
          LinkedIn message
        </label>
        <textarea
          id="linkedin-edit"
          value={linkedin}
          onChange={(event) => onLinkedin(event.target.value)}
        />
        <p className={count >= 80 ? "count over" : "count"}>{count} words</p>
        <label className="edit-label" htmlFor="bullet-edit">
          Cover letter bullets, one per line
        </label>
        <textarea
          id="bullet-edit"
          value={bullets}
          onChange={(event) => onBullets(event.target.value)}
        />
        <div className="actions">
          <button type="button" onClick={onSave}>
            Save draft
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onApprove}>
            Approve
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {approved ? (
        <p className="banner warn">Approved. This draft is final.</p>
      ) : (
        <p>This is still a draft.</p>
      )}
      {notes.length > 0 && !approved ? (
        <div className="banner warn">
          The reviewer still has notes. Edit them before you approve, if you want.
          <ul className="notes">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <h3>LinkedIn message</h3>
      <p className="draft-text">{draft.linkedin}</p>
      <p className={count >= 80 ? "count over" : "count"}>{count} words</p>
      <h3>Cover letter</h3>
      <p className="draft-text letter">{buildLetter(draft)}</p>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={() => navigator.clipboard?.writeText(buildLetter(draft))}
        >
          Copy cover letter
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => navigator.clipboard?.writeText(draft.linkedin)}
        >
          Copy LinkedIn message
        </button>
      </div>
      {approved ? null : (
        <div className="actions">
          <button type="button" onClick={onApprove}>
            Approve
          </button>
          <button type="button" className="secondary" onClick={onEdit}>
            Edit
          </button>
        </div>
      )}
    </>
  );
}
