"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TEST_TEXTS = [
  "Clear thinking becomes easier when distractions fade and each small action receives your full attention. Progress rarely arrives all at once; it grows through steady practice, honest feedback, and the patience to begin again.",
  "Great work is usually built in quiet moments. A useful idea becomes stronger when it is tested, refined, and shared with care. The goal is not perfect speed, but confident accuracy that improves with every attempt.",
  "Technology works best when it feels simple. Thoughtful tools remove friction, guide attention, and help people finish what matters. Good design is calm, direct, and respectful of the person using it.",
  "A focused morning can shape the entire day. Start with one meaningful task, protect a little time for deep work, and let consistency do the heavy lifting. Small wins create momentum that lasts.",
];

const DURATIONS = [15, 30, 60] as const;

type TestStatus = "idle" | "running" | "finished";
type FinishReason = "complete" | "time" | null;

export default function Home() {
  const [duration, setDuration] = useState<number>(30);
  const [passageIndex, setPassageIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState<TestStatus>("idle");
  const [finishReason, setFinishReason] = useState<FinishReason>(null);
  const [bestWpm, setBestWpm] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const passage = TEST_TEXTS[passageIndex];

  const correctCharacters = useMemo(
    () =>
      [...typed].reduce(
        (total, character, index) =>
          total + (character === passage[index] ? 1 : 0),
        0,
      ),
    [passage, typed],
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
  const timeLeft = Math.max(
    0,
    duration - Math.floor(elapsedMs / 1000),
  );
  const progress = Math.min(100, (typed.length / passage.length) * 100);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const resetTest = useCallback((shouldFocus = true) => {
    setTyped("");
    setElapsedMs(0);
    setStatus("idle");
    setFinishReason(null);
    startTimeRef.current = null;

    if (shouldFocus) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, []);

  const finishTest = useCallback(
    (reason: Exclude<FinishReason, null>, finalElapsed?: number) => {
      if (typeof finalElapsed === "number") {
        setElapsedMs(Math.max(100, finalElapsed));
      }
      setFinishReason(reason);
      setStatus("finished");
      inputRef.current?.blur();
    },
    [],
  );

  useEffect(() => {
    const storedBest = Number(window.localStorage.getItem("typeflow-best-wpm"));
    if (Number.isFinite(storedBest)) {
      setBestWpm(storedBest);
    }
  }, []);

  useEffect(() => {
    if (status !== "running") return;

    const timer = window.setInterval(() => {
      if (startTimeRef.current === null) return;

      const nextElapsed = Date.now() - startTimeRef.current;
      if (nextElapsed >= duration * 1000) {
        setElapsedMs(duration * 1000);
        finishTest("time");
        return;
      }

      setElapsedMs(nextElapsed);
    }, 100);

    return () => window.clearInterval(timer);
  }, [duration, finishTest, status]);

  useEffect(() => {
    if (status !== "finished" || wpm <= bestWpm) return;

    setBestWpm(wpm);
    window.localStorage.setItem("typeflow-best-wpm", String(wpm));
  }, [bestWpm, status, wpm]);

  const handleInput = (value: string) => {
    if (status === "finished") return;

    const nextValue = value.slice(0, passage.length);

    if (status === "idle" && nextValue.length > 0) {
      startTimeRef.current = Date.now();
      setStatus("running");
    }

    setTyped(nextValue);

    if (nextValue.length === passage.length) {
      const finalElapsed =
        startTimeRef.current === null ? 100 : Date.now() - startTimeRef.current;
      finishTest("complete", finalElapsed);
    }
  };

  const chooseDuration = (seconds: number) => {
    setDuration(seconds);
    resetTest(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const loadNewText = () => {
    setPassageIndex((current) => (current + 1) % TEST_TEXTS.length);
    resetTest();
  };

  let runningCharacterIndex = 0;

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="#" aria-label="Typeflow home">
          <span className="brand-mark">T</span>
          <span>typeflow</span>
        </a>

        <div className="nav-actions">
          <span className="best-score">
            Personal best
            <strong>{bestWpm > 0 ? `${bestWpm} WPM` : "—"}</strong>
          </span>
          <a className="nav-link" href="#tips">
            Typing tips
          </a>
        </div>
      </nav>

      <section className="hero" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">
            <span />
            Typing speed test
          </p>
          <h1 id="page-title">
            Type with <em>clarity.</em>
            <br />
            Improve with every word.
          </h1>
        </div>
        <p className="hero-copy">
          A distraction-free typing test that measures your real speed,
          accuracy, and consistency.
        </p>
      </section>

      <section className="test-card" aria-label="Typing test">
        <div className="test-toolbar">
          <div className="duration-control" aria-label="Select test duration">
            <span className="control-label">Duration</span>
            <div className="segmented-control">
              {DURATIONS.map((seconds) => (
                <button
                  className={duration === seconds ? "active" : ""}
                  key={seconds}
                  onClick={() => chooseDuration(seconds)}
                  type="button"
                >
                  {seconds}s
                </button>
              ))}
            </div>
          </div>

          <button
            className="quiet-button"
            onClick={loadNewText}
            type="button"
          >
            New text
          </button>
        </div>

        <div className="metrics" aria-live="polite">
          <div className="metric">
            <span>Time</span>
            <strong>
              {timeLeft}
              <small>s</small>
            </strong>
          </div>
          <div className="metric metric-primary">
            <span>Words per minute</span>
            <strong>
              {wpm}
              <small>WPM</small>
            </strong>
          </div>
          <div className="metric">
            <span>Accuracy</span>
            <strong>
              {accuracy}
              <small>%</small>
            </strong>
          </div>
        </div>

        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div
          className={`typing-surface ${status === "finished" ? "is-finished" : ""}`}
          onClick={focusInput}
          role="presentation"
        >
          <textarea
            ref={inputRef}
            className="typing-input"
            value={typed}
            onChange={(event) => handleInput(event.target.value)}
            onPaste={(event) => event.preventDefault()}
            aria-label="Type the displayed passage here"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={status === "finished"}
          />

          <div className="passage" aria-hidden="true">
            {passage.split(" ").map((word, wordIndex, words) => {
              const wordStart = runningCharacterIndex;
              runningCharacterIndex += word.length;
              const includesSpace = wordIndex < words.length - 1;
              const spaceIndex = runningCharacterIndex;
              if (includesSpace) runningCharacterIndex += 1;

              return (
                <span className="word" key={`${word}-${wordIndex}`}>
                  {[...word].map((character, characterIndex) => {
                    const index = wordStart + characterIndex;
                    const state =
                      index < typed.length
                        ? typed[index] === passage[index]
                          ? "correct"
                          : "incorrect"
                        : index === typed.length
                          ? "current"
                          : "pending";

                    return (
                      <span className={`character ${state}`} key={index}>
                        {character}
                      </span>
                    );
                  })}
                  {includesSpace && (
                    <span
                      className={`character space-character ${
                        spaceIndex < typed.length
                          ? typed[spaceIndex] === " "
                            ? "correct"
                            : "incorrect"
                          : spaceIndex === typed.length
                            ? "current"
                            : "pending"
                      }`}
                    >
                      &nbsp;
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          {status === "idle" && (
            <button className="start-prompt" onClick={focusInput} type="button">
              Click here, then start typing
            </button>
          )}
        </div>

        {status === "finished" ? (
          <div className="result-panel" aria-live="polite">
            <div>
              <p className="result-kicker">
                {finishReason === "complete"
                  ? "Passage complete"
                  : "Time is up"}
              </p>
              <h2>
                {wpm} WPM with {accuracy}% accuracy.
              </h2>
              <p>
                {mistakes === 0
                  ? "Perfect accuracy — a clean, confident run."
                  : `${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"} this round. Try once more and keep your rhythm steady.`}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => resetTest()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="test-footer">
            <p>
              {status === "running"
                ? "Stay relaxed. Accuracy builds speed."
                : "The timer starts with your first keystroke."}
            </p>
            <button
              className="restart-button"
              onClick={() => resetTest()}
              type="button"
            >
              Restart test
            </button>
          </div>
        )}
      </section>

      <section className="tips-section" id="tips" aria-labelledby="tips-title">
        <div>
          <p className="section-number">01 / BUILD BETTER HABITS</p>
          <h2 id="tips-title">Speed follows accuracy.</h2>
        </div>
        <div className="tips-grid">
          <article>
            <span>01</span>
            <h3>Look ahead</h3>
            <p>Read one or two words beyond the word you are currently typing.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Stay relaxed</h3>
            <p>Keep your shoulders loose and use a light touch on every key.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Choose accuracy</h3>
            <p>Build a clean rhythm first. Natural speed will follow with practice.</p>
          </article>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#">
          <span className="brand-mark">T</span>
          <span>typeflow</span>
        </a>
        <p>Practice with purpose. Type with confidence.</p>
      </footer>
    </main>
  );
}
