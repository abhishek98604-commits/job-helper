import { complete, toClientMessage, assertApiKey } from "@/lib/claude";
import { readResume } from "@/lib/resume";
import type { WorkflowEvent } from "@/lib/types";
import { runWorkflow } from "@/lib/workflow";


export async function POST(request: Request) {
  let jobPost = "";
  try {
    const body = (await request.json()) as { jobPost?: unknown };
    jobPost = typeof body.jobPost === "string" ? body.jobPost.trim() : "";
  } catch {
    return Response.json(
      { error: "Send a JSON body with the job post." },
      { status: 400 },
    );
  }

  if (jobPost.length < 40) {
    return Response.json(
      { error: "Paste more of the job post before running." },
      { status: 400 },
    );
  }
  if (jobPost.length > 20000) {
    return Response.json(
      { error: "That job post is too long. Paste the role text only." },
      { status: 400 },
    );
  }

  let resume = "";
  try {
    assertApiKey();
    resume = await readResume();
  } catch (error) {
    return Response.json({ error: toClientMessage(error) }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: WorkflowEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await runWorkflow({
          jobPost,
          resume,
          emit,
          complete: (args) => complete({ ...args, signal: request.signal }),
        });
      } catch (error) {
        if (request.signal.aborted) return;
        const message = toClientMessage(error);
        console.error(message);
        try {
          emit({ type: "error", message });
        } catch {
          /* The client may already be gone. */
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* Already closed. */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
