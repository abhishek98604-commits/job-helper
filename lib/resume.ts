import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readResume(): Promise<string> {
  const file = path.join(process.cwd(), "resume.md");
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new Error(
      "resume.md is missing. Add your resume to resume.md in the project root.",
    );
  }

  const marker = "\n---\n";
  const index = raw.indexOf(marker);
  const body = (index === -1 ? raw : raw.slice(index + marker.length)).trim();
  if (body.length < 40) {
    throw new Error(
      "resume.md is too short. Add your work history below the --- line.",
    );
  }
  return body;
}
