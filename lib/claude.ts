import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { ModelOutputError, type CompleteArgs } from "./types";

const MODEL = "claude-sonnet-5-5";

export function assertApiKey(): void {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "Add ANTHROPIC_API_KEY to .env.local, then restart the dev server.",
    );
  }
}

function client(): Anthropic {
  assertApiKey();
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function textFrom(message: Anthropic.Message): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }
  throw new ModelOutputError("The model returned text that was not JSON.");
}

export async function complete(
  args: CompleteArgs & { signal?: AbortSignal },
): Promise<unknown> {
  const message = await client().messages.create(
    {
      model: MODEL,
      max_tokens: 8000,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
      output_config: {
        effort: args.effort,
        format: { type: "json_schema", schema: args.schema },
      },
    },
    { signal: args.signal },
  );

  if (message.stop_reason === "max_tokens") {
    throw new ModelOutputError("The model stopped before it finished the JSON.");
  }

  const text = textFrom(message);
  if (!text) {
    throw new ModelOutputError("The model returned an empty response.");
  }
  return parseJson(text);
}

export function toClientMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) {
      return "The API key was rejected. Check ANTHROPIC_API_KEY in .env.local.";
    }
    if (error.status === 403) {
      return "This API key is not allowed to call the model.";
    }
    if (error.status === 404) {
      return "The Claude model was not found.";
    }
    if (error.status === 429) {
      return "The Claude API is busy. Wait a moment and run again.";
    }
    return `The Claude API returned status ${error.status}.`;
  }
  if (error instanceof Error) {
    return error.message.replace(/sk-ant-[A-Za-z0-9_-]+/g, "[redacted]");
  }
  return "The workflow stopped.";
}
