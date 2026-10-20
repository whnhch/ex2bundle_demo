import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GUIDE_TIPS, type GuideTip } from "./tips";

// Guide mode, ported from the SAGE web demo: "?" badges open a tooltip (hover to
// peek, click to pin), and a coach popup points at the next step of the workflow.

export type Placement = "below" | "above" | "right" | "left";

export type CoachStep = {
  id: string;
  n?: number;
  label?: string;
  text: ReactNode;
  target: string; // selector of the element to outline
  anchor?: string; // selector the popup points at (defaults to target)
  place?: Placement;
  next?: boolean; // intro steps the user advances with "Next"
};

type Props = {
  step: CoachStep | null;
  total: number;
  onNext: () => void;
};

type Tip = { el: HTMLElement; key: GuideTip; pinned: boolean };

// "right"/"left" put the popup beside the target when there is room; otherwise it goes
// below (or above when preferred, or when there is no room below).
function placeNear(el: HTMLElement, target: Element, gap = 10, place: Placement = "below") {
  const r = target.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  let side: Placement;
  if (place === "right" && r.right + gap + w <= window.innerWidth - 8) side = "right";
  else if (place === "left" && r.left - gap - w >= 8) side = "left";
  else if (place !== "below") side = r.top - gap - h >= 0 ? "above" : "below";
  else side = r.bottom + gap + h <= window.innerHeight || r.top - gap - h < 0 ? "below" : "above";

  let left: number;
  let top: number;
  if (side === "right" || side === "left") {
    left = side === "right" ? r.right + gap : r.left - gap - w;
    // top-aligned so a tall target (a whole panel) gets the popup beside its heading
    top = clamp(r.top, 8, window.innerHeight - h - 8);
    el.style.setProperty("--arrow-y", `${clamp(r.top + Math.min(r.height / 2, 32) - top, 12, h - 12)}px`);
  } else {
    left = clamp(r.left + r.width / 2 - 28, 8, window.innerWidth - w - 8);
    top = side === "below" ? r.bottom + gap : r.top - gap - h;
    el.style.setProperty("--arrow-x", `${clamp(r.left + r.width / 2 - left, 12, w - 12)}px`);
  }
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  (["below", "above", "right", "left"] as const).forEach((c) => el.classList.toggle(c, c === side));
}

function isOnScreen(target: Element) {
  const r = target.getBoundingClientRect();
  const scroller = target.parentElement?.closest(".reader-body, .intent-list");
  const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  return r.bottom > Math.max(box.top, 0) && r.top < Math.min(box.bottom, window.innerHeight);
}

export default function GuideLayer({ step, total, onNext }: Props) {
  const popRef = useRef<HTMLDivElement>(null);
  const coachRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const scrolledFor = useRef<string | null>(null);
  const coach = step && hiddenFor !== step.id ? step : null;

  useEffect(() => {
    const dotOf = (event: Event) => (event.target instanceof Element ? event.target.closest<HTMLElement>(".guide-dot") : null);
    const tipFor = (el: HTMLElement, pinned: boolean): Tip => ({ el, key: el.dataset.tip as GuideTip, pinned });
    const onClick = (event: MouseEvent) => {
      const dot = dotOf(event);
      if (dot) setTip((current) => (current?.el === dot && current.pinned ? null : tipFor(dot, true)));
      else if (!(event.target instanceof Element && event.target.closest(".guide-pop"))) setTip(null);
    };
    const onOver = (event: MouseEvent) => {
      const dot = dotOf(event);
      if (dot) setTip((current) => (current?.pinned ? current : tipFor(dot, false)));
    };
    const onOut = (event: MouseEvent) => {
      const dot = dotOf(event);
      if (dot) setTip((current) => (current?.el === dot && !current.pinned ? null : current));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTip(null);
    };
    const canHover = window.matchMedia("(hover: hover)").matches;
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    if (canHover) {
      document.addEventListener("mouseover", onOver);
      document.addEventListener("mouseout", onOut);
    }
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  // Re-place after every render (targets move as the page changes) and on scroll/resize.
  useLayoutEffect(() => {
    const clearTargets = () => document.querySelectorAll(".guide-target").forEach((el) => el.classList.remove("guide-target"));
    const place = () => {
      clearTargets();
      const pop = popRef.current;
      if (pop && tip) {
        pop.hidden = !(tip.el.isConnected && isOnScreen(tip.el));
        if (!pop.hidden) placeNear(pop, tip.el);
      }
      const box = coachRef.current;
      if (box && coach) {
        const target = document.querySelector(coach.target);
        const anchor = coach.anchor ? document.querySelector(coach.anchor) : target;
        // Bring each new step into view once; after that the user is free to scroll away.
        if (anchor && scrolledFor.current !== coach.id) {
          scrolledFor.current = coach.id;
          if (!isOnScreen(anchor)) anchor.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        box.hidden = !target || !anchor || !isOnScreen(anchor);
        if (target && anchor && !box.hidden) {
          target.classList.add("guide-target");
          placeNear(box, anchor, 12, coach.place);
        }
      }
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      clearTargets();
    };
  });

  return (
    <>
      {tip && (
        <div ref={popRef} className="guide-pop" role="tooltip">
          {GUIDE_TIPS[tip.key]}
        </div>
      )}
      {coach && (
        <div ref={coachRef} className="coach" role="status">
          <div className="coach-step">{coach.label ?? `Step ${coach.n} of ${total}`}</div>
          <div className="coach-text">{coach.text}</div>
          {coach.next && (
            <button type="button" className="coach-next" onClick={onNext}>
              Next →
            </button>
          )}
          <button type="button" className="coach-close" aria-label="Hide this tip" onClick={() => setHiddenFor(coach.id)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
