# Job Helper

A small multi-agent app that turns a job post into a LinkedIn message and a cover letter. Three AI agents each do one job, and a person approves the result.

Built by [Abhishek Bora](https://abhishekbora.myportfolio.com/), Principal Designer, as a hands-on project in AI agent design.

## How it works

1. **Researcher.** Reads the job post. Returns what the company does, the top 5 needs of the role, and one product problem worth mentioning.
2. **Writer.** Uses the research and my resume to write a LinkedIn message (under 80 words) and a short cover letter.
3. **Reviewer.** Checks the draft against the style rules and the facts. If something breaks a rule, it sends notes back to the writer for one more round.
4. **Human approval.** Nothing is final until I click Approve. I can edit the draft before approving.

## Design decisions

- **One job per agent.** Each agent has a short, clear brief. This makes each step easier to check and fix.
- **The person stays in control.** The AI drafts. The person decides.
- **Show the work.** The page shows each agent's output as it happens, so it is clear where every line came from.
- **No made-up facts.** The writer can only use facts from the resume and the job post. The reviewer fails any claim it cannot trace back to them.
- **Honest about gaps.** If the role asks for something the resume does not have, the letter says so in one plain sentence.
- **Fixed facts stay fixed.** Location, notice period and portfolio link come from code, not from the AI.
- **Style rules are checked twice.** Once by code (contractions, jargon, sentences starting with "I", message length) and once by the reviewer agent.

## Tech

- Next.js and TypeScript
- Claude API (Sonnet) on the server. The API key never reaches the browser.
- Built with Cursor and Claude

## Run it locally

1. Install Node.js.
2. Copy `.env.example` to `.env.local` and add your Anthropic API key.
3. Replace `resume.md` with your own resume, and update `lib/letter.ts` with your details.
4. Run:

```
npm install
npm run dev
```

5. Open http://localhost:3000
