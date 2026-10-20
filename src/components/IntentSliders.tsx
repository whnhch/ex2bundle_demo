import { useEffect, useState } from "react";
import { topics, type TopicId } from "@/data/documents";
import type { SliderPositions } from "@/lib/ex2bundle";
import GuideDot from "@/components/guide/GuideDot";

type Props = {
  sliders: SliderPositions;
  ready: boolean; // sliders are generated once snippets have been retrieved
  /** Applies a slider once it is released. */
  onCommit: (topic: TopicId, value: number) => void;
  onReset: () => void;
};

type Drag = { topic: TopicId; value: number };

function describe(gamma: number) {
  if (gamma === 0) return "Neutral";
  const label = gamma <= -75 ? "Very little" : gamma < 0 ? "Less" : gamma >= 75 ? "A lot" : "More";
  return `${label} (${gamma > 0 ? "+" : "−"}${Math.abs(gamma)})`;
}

export default function IntentSliders({ sliders, ready, onCommit, onReset }: Props) {
  // While dragging, the slider shows the position under the pointer; it is applied on release.
  const [dragging, setDragging] = useState<Drag | null>(null);
  const touched = topics.some((topic) => sliders[topic.id] !== 0);
  const shown = (topic: TopicId) => (dragging?.topic === topic ? dragging.value : sliders[topic]);

  function commit(topic: TopicId, value: number) {
    setDragging(null);
    onCommit(topic, value);
  }

  function release() {
    if (dragging) commit(dragging.topic, dragging.value);
  }

  // Commit when the pointer is released, on the slider or anywhere else.
  useEffect(() => {
    if (!dragging) return;
    const onUp = () => release();
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  });

  return (
    <section className="panel intent-panel">
      <div className="panel-heading">
        <div className="heading-title">
          <h2>Topic importance</h2>
          <GuideDot tip="topics" />
        </div>
        {touched && <button className="text-button" onClick={onReset}>Reset</button>}
      </div>
      {ready ? (
        <>
          <div className="intent-scale" aria-hidden>
            <span>Very little</span>
            <span>Less</span>
            <span>Neutral</span>
            <span>More</span>
            <span>A lot</span>
          </div>
          <div className="intent-list">
            {topics.map((topic) => {
              const gamma = shown(topic.id);
              const from = Math.min(50, 50 + gamma / 2);
              const to = Math.max(50, 50 + gamma / 2);
              return (
                <label className="intent-row" key={topic.id}>
                  <span className="intent-label">
                    <span>{topic.label}</span>
                    <span className={`intent-value ${gamma > 0 ? "more" : gamma < 0 ? "less" : ""}`}>{describe(gamma)}</span>
                  </span>
                  <span className="intent-track">
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={gamma}
                      aria-label={`${topic.label} importance`}
                      onChange={(event) => setDragging({ topic: topic.id, value: Number(event.target.value) })}
                      onKeyUp={release}
                      onBlur={release}
                      onDoubleClick={() => commit(topic.id, 0)}
                      style={{ background: `linear-gradient(to right, var(--line) ${from}%, var(--blue) ${from}%, var(--blue) ${to}%, var(--line) ${to}%)` }}
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </>
      ) : (
        <div className="empty-state">Sliders appear here once you retrieve snippets.</div>
      )}
    </section>
  );
}
