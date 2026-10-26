"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useReducer, useState } from "react";
import { useCommand } from "@/hooks/useCommand";
import { useResource } from "@/hooks/useResource";
import { getSelector } from "./selector";
import "./annotating.css";
import styles from "./FeedbackOverlay.module.css";

type Capture = { selector: string; rect: { x: number; y: number; w: number; h: number } };

const UI_ATTR = "data-feedback-ui";

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)
  );
}

function isOwnUi(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${UI_ATTR}]`) !== null;
}

function find(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

export function FeedbackOverlay() {
  const [active, setActive] = useState(false);
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [note, setNote] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, relayout] = useReducer((n: number) => n + 1, 0);

  const create = useCommand("createAnnotation");
  const update = useCommand("updateAnnotation");
  const open = useResource("annotations", { status: "open" });
  const route = typeof window === "undefined" ? "" : window.location.pathname;
  const notes = (open.data?.items ?? []).filter((n) => n.route === route && n.status === "open");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(false);
      else if (e.key === "F" && e.shiftKey && !isTyping(e.target)) setActive((a) => !a);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Pins follow their elements; with no pins on this page, scrolling needn't re-render the overlay.
  const hasPins = notes.length > 0;
  useEffect(() => {
    if (!hasPins) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        relayout();
      });
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [hasPins]);

  useEffect(() => {
    if (!active) {
      setHover(null);
      return;
    }
    const onOver = (e: MouseEvent) => {
      setHover(e.target instanceof Element && !isOwnUi(e.target) ? e.target.getBoundingClientRect() : null);
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || isOwnUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const r = e.target.getBoundingClientRect();
      setCapture({ selector: getSelector(e.target), rect: { x: r.x, y: r.y, w: r.width, h: r.height } });
      setNote("");
      setSaveError(null);
      setActive(false);
    };
    document.documentElement.setAttribute("data-annotating", "true");
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.documentElement.removeAttribute("data-annotating");
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  async function save() {
    if (!capture) return;
    try {
      await create.run({
        route: window.location.pathname,
        selector: capture.selector,
        note,
        rect: capture.rect,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        theme: document.documentElement.dataset.theme ?? "light",
      });
      setCapture(null);
      setActive(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the note");
    }
  }

  return (
    <div data-feedback-ui data-testid="feedback-overlay">
      <button
        type="button"
        className={styles.toggle}
        aria-label="Leave feedback"
        aria-pressed={active}
        title="Leave feedback (Shift+F)"
        onClick={() => setActive((a) => !a)}
      >
        <span aria-hidden="true">+</span>
        <span className={styles.toggleLabel}>Feedback</span>
      </button>
      <button type="button" className={styles.notesButton} onClick={() => setDrawer(true)}>
        {`Feedback notes (${notes.length})`}
      </button>

      {active && (
        <div role="status" aria-label="Feedback mode" className={styles.banner}>
          Click any element to leave a note · Esc to cancel
        </div>
      )}

      {hover && (
        <div
          className={styles.highlight}
          style={{ left: hover.left, top: hover.top, width: hover.width, height: hover.height }}
        />
      )}

      {notes.map((n, i) => {
        const el = find(n.selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return (
          <button
            key={n.id}
            type="button"
            className={styles.pin}
            style={{ left: r.left, top: r.top }}
            aria-label={`Note ${i + 1}: ${n.note}`}
            onClick={() => setDrawer(true)}
          >
            {i + 1}
          </button>
        );
      })}

      <Dialog.Root open={capture !== null} onOpenChange={(o) => !o && setCapture(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.scrim} {...{ [UI_ATTR]: "" }} />
          <Dialog.Content className={styles.dialog} aria-describedby={undefined} {...{ [UI_ATTR]: "" }}>
            <Dialog.Title className={styles.title}>Feedback</Dialog.Title>
            <label className={styles.label} htmlFor="feedback-note">
              Note
            </label>
            <textarea
              id="feedback-note"
              className={styles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {saveError && <p className={styles.error}>{saveError}</p>}
            <div className={styles.actions}>
              <Dialog.Close className={styles.button}>Cancel</Dialog.Close>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                disabled={note.trim() === "" || create.status === "pending"}
                onClick={() => void save()}
              >
                Save note
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={drawer} onOpenChange={setDrawer} modal={false}>
        <Dialog.Portal>
          <Dialog.Content className={styles.drawer} aria-describedby={undefined} {...{ [UI_ATTR]: "" }}>
            <Dialog.Title className={styles.title}>Feedback notes</Dialog.Title>
            <ul className={styles.list}>
              {notes.map((n, i) => (
                <li key={n.id} className={styles.item}>
                  <span className={styles.number} data-testid="note-number" aria-label={`Note ${i + 1}`}>
                    {i + 1}
                  </span>
                  <div>{n.note}</div>
                  <div className={styles.meta}>
                    {n.route} · {n.selector} · {n.status}
                  </div>
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => void update.run({ id: n.id, status: "resolved" })}
                  >
                    Resolve
                  </button>
                </li>
              ))}
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
