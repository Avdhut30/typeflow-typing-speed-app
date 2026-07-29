"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Gauge,
  History,
  Keyboard,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PASSAGES = [
  {
    category: "Focus",
    text: "Clear thinking becomes easier when distractions fade and each small action receives your full attention. Progress rarely arrives all at once; it grows through steady practice, honest feedback, and the patience to begin again.",
  },
  {
    category: "Craft",
    text: "Great work is usually built in quiet moments. A useful idea becomes stronger when it is tested, refined, and shared with care. The goal is not perfect speed, but confident accuracy that improves with every attempt.",
  },
  {
    category: "Design",
    text: "Technology works best when it feels simple. Thoughtful tools remove friction, guide attention, and help people finish what matters. Good design is calm, direct, and respectful of the person using it.",
  },
  {
    category: "Momentum",
    text: "A focused morning can shape the entire day. Start with one meaningful task, protect a little time for deep work, and let consistency do the heavy lifting. Small wins create momentum that lasts.",
  },
  {
    category: "Learning",
    text: "Skill grows when curiosity meets repetition. Notice what slows you down, adjust one detail at a time, and return with a clear purpose. Patient practice turns unfamiliar movements into reliable habits.",
  },
];

const DURATIONS = [15, 30, 60] as const;
const TOPICS = ["General", "Technology", "Science", "Business", "Creativity"] as const;
const HISTORY_KEY = "typeflow-session-history";
const BEST_WPM_KEY = "typeflow-best-wpm";

type TestStatus = "idle" | "running" | "finished";
type FinishReason = "complete" | "time";
type PassageSource = "ai" | "generated" | "curated";
type Topic = (typeof TOPICS)[number];

type TypingPassage = {
  category: string;
  text: string;
};

type SessionResult = {
  id: number;
  wpm: number;
  accuracy: number;
  mistakes: number;
  duration: number;
  completedAt: number;
};

type PassageToken = {
  word: string;
  start: number;
  spaceIndex: number | null;
};

function getCorrectCharacters(value: string, passage: string) {
  return [...value].reduce(
    (total, character, index) =>
      total + (character === passage[index] ? 1 : 0),
    0,
  );
}

function getPassageTokens(passage: string): PassageToken[] {
  const words = passage.split(" ");

  return words.map((word, wordIndex) => {
    const start = words
      .slice(0, wordIndex)
      .reduce((total, previousWord) => total + previousWord.length + 1, 0);

    return {
      word,
      start,
      spaceIndex: wordIndex < words.length - 1 ? start + word.length : null,
    };
  });
}

function getCharacterState(index: number, typed: string, passage: string) {
  if (index < typed.length) {
    return typed[index] === passage[index] ? "correct" : "incorrect";
  }

  return index === typed.length ? "current" : "pending";
}

function readStoredHistory(): SessionResult[] {
  try {
    const value = window.localStorage.getItem(HISTORY_KEY);
    if (!value) return [];

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const [duration, setDuration] = useState<number>(30);
  const [passage, setPassage] = useState<TypingPassage>(PASSAGES[0]);
  const [passageNumber, setPassageNumber] = useState(0);
  const [passageSource, setPassageSource] =
    useState<PassageSource>("curated");
  const [topic, setTopic] = useState<Topic>("General");
  const [isGenerating, setIsGenerating] = useState(false);
  const [typed, setTyped] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState<TestStatus>("idle");
  const [finishReason, setFinishReason] =
    useState<FinishReason>("complete");
  const [bestWpm, setBestWpm] = useState(0);
  const [recentSessions, setRecentSessions] = useState<SessionResult[]>([]);
  const [completedResult, setCompletedResult] =
    useState<SessionResult | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recentPassagesRef = useRef<string[]>([PASSAGES[0].text]);
  const initialPassageRequestedRef = useRef(false);
  const passageTokens = useMemo(
    () => getPassageTokens(passage.text),
    [passage.text],
  );

  const correctCharacters = useMemo(
    () => getCorrectCharacters(typed, passage.text),
    [passage.text, typed],
  );
  const mistakes = typed.length - correctCharacters;
  const accuracy =
    typed.length === 0
      ? 100
      : Math.max(0, Math.round((correctCharacters / typed.length) * 100));
  const wpm =
    elapsedMs > 0
      ? Math.max(
          0,
          Math.round(correctCharacters / 5 / (elapsedMs / 60000)),
        )
      : 0;
  const timeLeft = Math.max(0, duration - Math.floor(elapsedMs / 1000));
  const progress = Math.min(100, (typed.length / passage.text.length) * 100);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const storedBest = Number(window.localStorage.getItem(BEST_WPM_KEY));
      if (Number.isFinite(storedBest) && storedBest > 0) {
        setBestWpm(storedBest);
      }
      setRecentSessions(readStoredHistory());
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const resetTest = useCallback((shouldFocus = true) => {
    setTyped("");
    setElapsedMs(0);
    setStatus("idle");
    setCompletedResult(null);
    setIsNewBest(false);
    startTimeRef.current = null;

    if (shouldFocus) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, []);

  const finishTest = useCallback(
    (
      reason: FinishReason,
      finalElapsed: number,
      finalTyped: string,
    ) => {
      const safeElapsed = Math.max(100, finalElapsed);
      const finalCorrect = getCorrectCharacters(finalTyped, passage.text);
      const finalMistakes = finalTyped.length - finalCorrect;
      const finalAccuracy =
        finalTyped.length === 0
          ? 100
          : Math.max(
              0,
              Math.round((finalCorrect / finalTyped.length) * 100),
            );
      const finalWpm = Math.max(
        0,
        Math.round(finalCorrect / 5 / (safeElapsed / 60000)),
      );
      const result: SessionResult = {
        id: Date.now(),
        wpm: finalWpm,
        accuracy: finalAccuracy,
        mistakes: finalMistakes,
        duration,
        completedAt: Date.now(),
      };
      const nextBest = Math.max(bestWpm, finalWpm);
      const nextSessions = [result, ...recentSessions].slice(0, 5);

      setElapsedMs(safeElapsed);
      setFinishReason(reason);
      setStatus("finished");
      setCompletedResult(result);
      setIsNewBest(finalWpm > bestWpm);
      setBestWpm(nextBest);
      setRecentSessions(nextSessions);
      window.localStorage.setItem(BEST_WPM_KEY, String(nextBest));
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextSessions));
      inputRef.current?.blur();
    },
    [bestWpm, duration, passage.text, recentSessions],
  );

  useEffect(() => {
    if (status !== "running") return;

    const timer = window.setInterval(() => {
      if (startTimeRef.current === null) return;

      const nextElapsed = Date.now() - startTimeRef.current;
      if (nextElapsed >= duration * 1000) {
        finishTest("time", duration * 1000, typed);
        return;
      }

      setElapsedMs(nextElapsed);
    }, 100);

    return () => window.clearInterval(timer);
  }, [duration, finishTest, status, typed]);

  const handleInput = (value: string) => {
    if (status === "finished") return;

    const nextValue = value.slice(0, passage.text.length);

    if (status === "idle" && nextValue.length > 0) {
      startTimeRef.current = Date.now();
      setStatus("running");
    }

    setTyped(nextValue);

    if (nextValue.length === passage.text.length) {
      const finalElapsed =
        startTimeRef.current === null ? 100 : Date.now() - startTimeRef.current;
      finishTest("complete", finalElapsed, nextValue);
    }
  };

  const chooseDuration = (seconds: number) => {
    setDuration(seconds);
    resetTest(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const loadNewText = useCallback(
    async ({
      focus = true,
      requestedTopic = topic,
    }: {
      focus?: boolean;
      requestedTopic?: Topic;
    } = {}) => {
      setIsGenerating(true);
      resetTest(false);

      try {
        const response = await fetch("/api/passage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: requestedTopic,
            previousTexts: recentPassagesRef.current,
          }),
        });

        if (!response.ok) {
          throw new Error("Passage request failed");
        }

        const data = (await response.json()) as {
          passage?: TypingPassage;
          source?: PassageSource;
        };

        if (
          !data.passage?.text ||
          typeof data.passage.category !== "string" ||
          recentPassagesRef.current.includes(data.passage.text)
        ) {
          throw new Error("Invalid or repeated passage");
        }

        setPassage(data.passage);
        setPassageSource(data.source === "ai" ? "ai" : "generated");
        setPassageNumber((current) => current + 1);
        recentPassagesRef.current = [
          data.passage.text,
          ...recentPassagesRef.current,
        ].slice(0, 4);
      } catch {
        const fallback =
          PASSAGES.find(
            (candidate) =>
              !recentPassagesRef.current.includes(candidate.text),
          ) ?? PASSAGES[Date.now() % PASSAGES.length];

        setPassage(fallback);
        setPassageSource("curated");
        setPassageNumber((current) => current + 1);
        recentPassagesRef.current = [
          fallback.text,
          ...recentPassagesRef.current,
        ].slice(0, 4);
      } finally {
        setIsGenerating(false);
        if (focus) {
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }
      }
    },
    [resetTest, topic],
  );

  useEffect(() => {
    if (initialPassageRequestedRef.current) return;
    initialPassageRequestedRef.current = true;
    void loadNewText({ focus: false });
  }, [loadNewText]);

  const chooseTopic = (nextTopic: Topic) => {
    setTopic(nextTopic);
    void loadNewText({ requestedTopic: nextTopic });
  };

  const clearHistory = () => {
    setRecentSessions([]);
    window.localStorage.removeItem(HISTORY_KEY);
  };

  const statusLabel = isGenerating
    ? "Creating"
    : status === "idle"
      ? "Ready"
      : status === "running"
        ? "Live"
        : "Complete";
  const latestSession = recentSessions[0];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="Typeflow home">
            <span className="brand-mark" aria-hidden="true">
              <Keyboard size={20} strokeWidth={2.2} />
            </span>
            <span className="brand-name">typeflow</span>
            <span className="brand-edition">Practice</span>
          </a>

          <div className="header-actions">
            <a className="history-link" href="#history">
              <History size={16} aria-hidden="true" />
              Sessions
            </a>
            <div className="best-summary" aria-label="Personal best">
              <Trophy size={16} aria-hidden="true" />
              <span>Best</span>
              <strong>{bestWpm > 0 ? `${bestWpm} WPM` : "--"}</strong>
            </div>
          </div>
        </div>
      </header>

      <div className="workspace">
        <section className="workspace-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Typing workspace</p>
            <h1 id="page-title">Typing speed test</h1>
          </div>
          <p className="heading-support">
            Build speed through accurate, focused practice.
          </p>
        </section>

        <section className="test-panel" aria-label="Typing test">
          <div className="test-controls">
            <div className="control-cluster">
              <div className="duration-control">
                <span className="control-label">Duration</span>
                <div
                  className="segmented-control"
                  aria-label="Select test duration"
                >
                  {DURATIONS.map((seconds) => (
                    <button
                      className={duration === seconds ? "active" : ""}
                      disabled={status === "running" || isGenerating}
                      key={seconds}
                      onClick={() => chooseDuration(seconds)}
                      type="button"
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </div>

              <label className="topic-control">
                <span className="control-label">Topic</span>
                <select
                  aria-label="Select passage topic"
                  disabled={status === "running" || isGenerating}
                  onChange={(event) => chooseTopic(event.target.value as Topic)}
                  value={topic}
                >
                  {TOPICS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="tool-actions">
              <span className="ai-control-label">
                <Sparkles size={14} aria-hidden="true" />
                AI passage
              </span>
              <button
                className="icon-button"
                disabled={isGenerating}
                onClick={() => void loadNewText()}
                title="Generate new passage"
                type="button"
              >
                {isGenerating ? (
                  <LoaderCircle
                    className="spin"
                    size={17}
                    aria-hidden="true"
                  />
                ) : (
                  <Shuffle size={17} aria-hidden="true" />
                )}
                <span className="sr-only">Generate new passage</span>
              </button>
              <button
                className="icon-button"
                disabled={isGenerating}
                onClick={() => resetTest()}
                title="Restart current passage"
                type="button"
              >
                <RotateCcw size={17} aria-hidden="true" />
                <span className="sr-only">Restart current passage</span>
              </button>
            </div>
          </div>

          <div className="metrics" aria-live="polite">
            <div className="metric">
              <span className="metric-icon time">
                <Clock size={17} aria-hidden="true" />
              </span>
              <div>
                <span className="metric-label">Time left</span>
                <strong>
                  {timeLeft}
                  <small>sec</small>
                </strong>
              </div>
            </div>
            <div className="metric metric-primary">
              <span className="metric-icon speed">
                <Gauge size={18} aria-hidden="true" />
              </span>
              <div>
                <span className="metric-label">Speed</span>
                <strong>
                  {wpm}
                  <small>WPM</small>
                </strong>
              </div>
            </div>
            <div className="metric">
              <span className="metric-icon accuracy">
                <Target size={17} aria-hidden="true" />
              </span>
              <div>
                <span className="metric-label">Accuracy</span>
                <strong>
                  {accuracy}
                  <small>%</small>
                </strong>
              </div>
            </div>
            <div className="metric">
              <span className="metric-icon errors">
                <AlertCircle size={17} aria-hidden="true" />
              </span>
              <div>
                <span className="metric-label">Mistakes</span>
                <strong>{mistakes}</strong>
              </div>
            </div>
          </div>

          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="passage-meta">
            <div>
              <span>
                Passage {String(Math.max(1, passageNumber)).padStart(2, "0")}
              </span>
              <strong>{passage.category}</strong>
            </div>
            <div className="passage-status">
              <span className={`source-indicator ${passageSource}`}>
                <Sparkles size={13} aria-hidden="true" />
                {passageSource === "ai" ? "AI generated" : "Fresh passage"}
              </span>
              <span
                className={`status-indicator ${isGenerating ? "generating" : status}`}
              >
                <i aria-hidden="true" />
                {statusLabel}
              </span>
            </div>
          </div>

          <div
            className={`typing-surface ${
              status === "finished" ? "is-finished" : ""
            } ${isGenerating ? "is-loading" : ""}`}
            onClick={focusInput}
            role="presentation"
          >
            <textarea
              ref={inputRef}
              className="typing-input"
              value={typed}
              onChange={(event) => handleInput(event.target.value)}
              onPaste={(event) => event.preventDefault()}
              aria-label="Typing input"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={status === "finished" || isGenerating}
            />

            <div className="passage" aria-hidden="true">
              {passageTokens.map((token) => (
                <span className="word" key={`${token.word}-${token.start}`}>
                  {[...token.word].map((character, characterIndex) => {
                    const index = token.start + characterIndex;
                    return (
                      <span
                        className={`character ${getCharacterState(index, typed, passage.text)}`}
                        key={index}
                      >
                        {character}
                      </span>
                    );
                  })}
                  {token.spaceIndex !== null && (
                    <span
                      className={`character space-character ${getCharacterState(
                        token.spaceIndex,
                        typed,
                        passage.text,
                      )}`}
                    >
                      &nbsp;
                    </span>
                  )}
                </span>
              ))}
            </div>

            {isGenerating ? (
              <div className="generating-passage" aria-live="polite">
                <LoaderCircle className="spin" size={18} aria-hidden="true" />
                Creating a fresh passage
              </div>
            ) : status === "idle" ? (
              <button
                className="start-button"
                onClick={focusInput}
                type="button"
              >
                <Keyboard size={16} aria-hidden="true" />
                Start typing
              </button>
            ) : null}
          </div>

          {status === "finished" && completedResult ? (
            <div className="result-band" aria-live="polite">
              <div className="result-icon">
                {isNewBest ? (
                  <Trophy size={22} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={22} aria-hidden="true" />
                )}
              </div>
              <div className="result-copy">
                <span>
                  {isNewBest
                    ? "New personal best"
                    : finishReason === "complete"
                      ? "Passage complete"
                      : "Session complete"}
                </span>
                <h2>
                  {completedResult.wpm} WPM at{" "}
                  {completedResult.accuracy}% accuracy
                </h2>
                <p>
                  {completedResult.mistakes === 0
                    ? "A clean run with perfect accuracy."
                    : `${completedResult.mistakes} ${
                        completedResult.mistakes === 1 ? "mistake" : "mistakes"
                      } recorded. Keep the rhythm steady on your next run.`}
                </p>
              </div>
              <button
                className="primary-button"
                disabled={isGenerating}
                onClick={() => void loadNewText()}
                type="button"
              >
                {isGenerating ? (
                  <LoaderCircle
                    className="spin"
                    size={16}
                    aria-hidden="true"
                  />
                ) : (
                  <Sparkles size={16} aria-hidden="true" />
                )}
                New passage
              </button>
            </div>
          ) : (
            <div className="test-footer">
              <span>
                <Activity size={15} aria-hidden="true" />
                {status === "running"
                  ? "Session in progress"
                  : "Timer begins with the first keystroke"}
              </span>
              <button onClick={() => resetTest()} type="button">
                <RotateCcw size={15} aria-hidden="true" />
                Reset
              </button>
            </div>
          )}
        </section>

        <section className="performance-grid" id="history">
          <div className="history-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Performance</p>
                <h2>Recent sessions</h2>
              </div>
              {recentSessions.length > 0 && (
                <button
                  className="text-button"
                  onClick={clearHistory}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>

            {recentSessions.length > 0 ? (
              <div className="session-table" role="table">
                <div className="session-row session-header" role="row">
                  <span role="columnheader">Session</span>
                  <span role="columnheader">Speed</span>
                  <span role="columnheader">Accuracy</span>
                  <span role="columnheader">Errors</span>
                </div>
                {recentSessions.map((session, index) => (
                  <div className="session-row" role="row" key={session.id}>
                    <span role="cell">
                      <i>{index === 0 ? "Latest" : `#${index + 1}`}</i>
                      <small>{session.duration}s test</small>
                    </span>
                    <strong role="cell">{session.wpm} WPM</strong>
                    <span role="cell">{session.accuracy}%</span>
                    <span role="cell">{session.mistakes}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-history">
                <History size={21} aria-hidden="true" />
                <div>
                  <strong>No sessions recorded</strong>
                  <p>Your completed tests will appear here.</p>
                </div>
              </div>
            )}
          </div>

          <aside className="insights-section" aria-labelledby="insights-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Practice notes</p>
                <h2 id="insights-title">Build a cleaner rhythm</h2>
              </div>
              <Lightbulb size={19} aria-hidden="true" />
            </div>

            <div className="insight-list">
              <div>
                <span>01</span>
                <p>Read one word ahead to reduce pauses between keystrokes.</p>
              </div>
              <div>
                <span>02</span>
                <p>Prioritize accuracy; consistent rhythm creates lasting speed.</p>
              </div>
              <div>
                <span>03</span>
                <p>Keep your hands light and reset your posture between sessions.</p>
              </div>
            </div>

            <div className="session-highlight">
              <span>
                <Trophy size={17} aria-hidden="true" />
                Personal best
              </span>
              <strong>{bestWpm > 0 ? bestWpm : "--"} WPM</strong>
              <small>
                {latestSession
                  ? `Latest session: ${latestSession.wpm} WPM`
                  : "Complete a test to establish your baseline"}
              </small>
            </div>
          </aside>
        </section>
      </div>

      <footer className="app-footer">
        <div>
          <span className="footer-brand">typeflow</span>
          <span>Focused typing practice</span>
        </div>
        <span>Built for accuracy, rhythm, and speed.</span>
      </footer>
    </main>
  );
}
