# Typeflow

Typeflow is a focused typing speed test for measuring speed, accuracy, and
progress. It provides live performance metrics, multiple test durations,
personal-best tracking, and a local session history.

## Features

- 15, 30, and 60 second typing tests
- Live WPM, accuracy, mistake, and time metrics
- Character-level correctness feedback
- Fresh AI-generated passages with selectable topics
- Automatic unique-passage fallback when AI is unavailable
- Personal-best and recent-session persistence
- Multiple curated practice passages
- Responsive desktop and mobile layouts
- Accessible controls and reduced-motion support

## Tech Stack

- React 19 and TypeScript
- Next.js 16 App Router
- Vinext and Vite 8
- Tailwind CSS 4 tooling with project CSS
- Lucide React icons
- OpenAI Responses API
- Cloudflare Workers deployment target
- Optional Cloudflare D1 and Drizzle ORM scaffolding

## Local Development

Node.js 22.13 or newer is required.

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`.

## AI Passage Generation

Set `OPENAI_API_KEY` in the server environment to generate passages with the
OpenAI Responses API. The optional `OPENAI_PASSAGE_MODEL` variable overrides
the default `gpt-5.6-luna` model.

```bash
OPENAI_API_KEY=your_api_key
OPENAI_PASSAGE_MODEL=gpt-5.6-luna
```

API credentials are only read by `app/api/passage/route.ts` and are never sent
to the browser. Without a key, the same endpoint creates varied local passages
so every typing session remains functional.

## Validation

```bash
npx eslint . --ignore-pattern dist --ignore-pattern .next
npx tsc --noEmit
npx vite build
```

The repository also includes Linux-oriented Sites lifecycle scripts for
artifact validation and deployment builds.

## Project Structure

```text
app/       Application UI, layout, and styling
public/    Static assets
worker/    Cloudflare Worker entry point
db/        Optional D1 and Drizzle setup
tests/     Rendered artifact checks
scripts/   Build and Sites lifecycle helpers
```
