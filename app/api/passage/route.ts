import OpenAI from "openai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOPICS = ["General", "Technology", "Science", "Business", "Creativity"] as const;
const DEFAULT_MODEL = "gpt-5.6-luna";

type Topic = (typeof TOPICS)[number];

type PassageRequest = {
  topic?: unknown;
  previousTexts?: unknown;
};

const FALLBACK_PARTS: Record<
  Topic,
  { subjects: string[]; actions: string[]; outcomes: string[] }
> = {
  General: {
    subjects: [
      "A steady morning routine",
      "Thoughtful daily practice",
      "A clear and patient approach",
      "Small choices made with care",
    ],
    actions: [
      "creates room for focused work and helps each task receive proper attention",
      "turns difficult goals into manageable steps that feel easier to repeat",
      "keeps momentum moving even when progress is quiet or difficult to notice",
      "makes it easier to learn from mistakes without losing confidence",
    ],
    outcomes: [
      "Over time, consistent effort becomes a dependable skill that supports better decisions and stronger results.",
      "The most useful progress often comes from returning with curiosity, adjusting one detail, and trying again.",
      "This calm rhythm protects attention, encourages honest reflection, and gives meaningful work time to improve.",
      "Each completed step builds trust in the process and makes the next challenge feel more familiar.",
    ],
  },
  Technology: {
    subjects: [
      "Reliable software",
      "A well designed digital tool",
      "Modern engineering teams",
      "Useful technology",
    ],
    actions: [
      "combines careful planning with simple interfaces that respect the people using them",
      "improves when teams test assumptions, study feedback, and remove unnecessary complexity",
      "depends on clear communication, maintainable systems, and decisions grounded in real needs",
      "creates value when it reduces friction and helps people complete important work",
    ],
    outcomes: [
      "Strong products feel predictable in daily use while remaining flexible enough to improve over time.",
      "The best solutions make difficult work understandable without hiding the details that people truly need.",
      "Every useful release should make the experience clearer, faster, or more dependable than it was before.",
      "Good systems earn trust through consistent behavior, thoughtful safeguards, and careful attention to detail.",
    ],
  },
  Science: {
    subjects: [
      "Careful observation",
      "A useful scientific question",
      "Patient experimentation",
      "Evidence based research",
    ],
    actions: [
      "reveals patterns that first appear hidden and gives researchers a clearer direction",
      "begins with curiosity, grows through testing, and improves when results are examined honestly",
      "turns uncertain ideas into knowledge that others can inspect, challenge, and extend",
      "requires precise measurement, open discussion, and a willingness to revise earlier explanations",
    ],
    outcomes: [
      "Each result adds context to the larger picture and helps future experiments ask better questions.",
      "Progress becomes more reliable when evidence matters more than expectation and methods remain transparent.",
      "A strong conclusion explains what was learned while remaining clear about what is still unknown.",
      "Shared findings allow many people to compare results and build stronger explanations together.",
    ],
  },
  Business: {
    subjects: [
      "A resilient business",
      "Strong customer relationships",
      "A focused product team",
      "Sustainable growth",
    ],
    actions: [
      "starts with a clear problem and a practical understanding of the people affected by it",
      "depends on reliable service, honest communication, and decisions that create lasting value",
      "emerges when teams measure useful outcomes instead of chasing activity for its own sake",
      "requires clear priorities, responsible execution, and regular feedback from the market",
    ],
    outcomes: [
      "Long term trust grows when promises match results and every interaction feels considered.",
      "The clearest strategy connects daily work to customer needs and makes tradeoffs easier to understand.",
      "Healthy teams review evidence early, adjust quickly, and protect the work that matters most.",
      "Good decisions balance present constraints with the opportunities that disciplined improvement can create.",
    ],
  },
  Creativity: {
    subjects: [
      "A fresh creative idea",
      "Meaningful design",
      "An original story",
      "Creative confidence",
    ],
    actions: [
      "often begins as a rough thought that becomes clearer through patient exploration",
      "grows when curiosity has enough space to experiment without demanding immediate perfection",
      "connects familiar details in an unexpected way and gives people a new perspective",
      "develops through observation, regular practice, and the courage to revise unfinished work",
    ],
    outcomes: [
      "The strongest result usually appears after several versions reveal what the work truly needs.",
      "Small experiments keep the process moving and turn uncertainty into useful creative direction.",
      "Careful editing gives the final work structure while preserving the energy of the original idea.",
      "A distinctive voice becomes easier to recognize when practice remains honest, playful, and consistent.",
    ],
  },
};

function normalizeTopic(value: unknown): Topic {
  return typeof value === "string" && TOPICS.includes(value as Topic)
    ? (value as Topic)
    : "General";
}

function normalizePreviousTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.slice(0, 220))
    .slice(0, 4);
}

function pick<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function createFallbackPassage(topic: Topic, previousTexts: string[]) {
  const parts = FALLBACK_PARTS[topic];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const text = `${pick(parts.subjects)} ${pick(parts.actions)}. ${pick(
      parts.outcomes,
    )} ${pick(FALLBACK_PARTS.General.outcomes)}`;

    if (!previousTexts.includes(text)) {
      return text;
    }
  }

  return `${pick(parts.subjects)} ${pick(parts.actions)}. ${pick(
    parts.outcomes,
  )} A new perspective can emerge when the same challenge is approached with fresh attention and a different sequence of small decisions.`;
}

function sanitizePassage(value: string) {
  const normalized = value
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = normalized.split(" ").filter(Boolean).length;

  if (wordCount < 42 || wordCount > 68) return null;
  if (/[\n\r]|[*#`]|\bhttps?:\/\//i.test(normalized)) return null;

  return normalized;
}

export async function POST(request: Request) {
  let body: PassageRequest = {};

  try {
    body = (await request.json()) as PassageRequest;
  } catch {
    // Invalid input simply falls back to safe defaults.
  }

  const topic = normalizeTopic(body.topic);
  const previousTexts = normalizePreviousTexts(body.previousTexts);
  const fallback = () =>
    NextResponse.json(
      {
        passage: {
          category: topic,
          text: createFallbackPassage(topic, previousTexts),
        },
        source: "generated",
      },
      { headers: { "Cache-Control": "no-store" } },
    );

  if (!process.env.OPENAI_API_KEY) {
    return fallback();
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 1,
      timeout: 10_000,
    });
    const response = await client.responses.create({
      model: process.env.OPENAI_PASSAGE_MODEL ?? DEFAULT_MODEL,
      instructions:
        "Create original English passages for a professional typing-speed test. Return only the passage text. Use plain punctuation, natural sentences, accessible vocabulary, and no headings, quotes, markdown, lists, facts requiring citations, or sensitive content.",
      input: [
        `Topic: ${topic}.`,
        "Write 48 to 58 words across three or four sentences.",
        "Vary sentence openings and rhythm so each request feels new.",
        `Request nonce: ${crypto.randomUUID()}.`,
        previousTexts.length
          ? `Do not repeat or closely paraphrase these recent passages: ${previousTexts.join(
              " | ",
            )}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      max_output_tokens: 180,
    });
    const text = sanitizePassage(response.output_text);

    if (!text || previousTexts.includes(text)) {
      return fallback();
    }

    return NextResponse.json(
      {
        passage: { category: topic, text },
        source: "ai",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return fallback();
  }
}
