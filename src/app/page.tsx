"use client";

import { useMemo, useState } from "react";
import DocumentSelection from "@/components/DocumentSelection";
import ExampleReader from "@/components/ExampleReader";
import GuideDot from "@/components/guide/GuideDot";
import GuideLayer, { type CoachStep } from "@/components/guide/GuideLayer";
import IntentSliders from "@/components/IntentSliders";
import RetrievedDocuments, { type SnippetChanges } from "@/components/RetrievedDocuments";
import { defaultRoles, documents, type DocumentRole, type TopicId } from "@/data/documents";
import { moveSlider, neutralSliders, prepareTarget, settle, snippetAt, synthesizeBounds, type PreparedTarget, type SliderPositions } from "@/lib/ex2bundle";
import { useStoredFlag } from "@/lib/useStoredFlag";

type LearnedIntent = { key: string; targets: PreparedTarget[]; run: number };

const COACH_TOTAL = 5;

export default function Home() {
  const [roles, setRoles] = useState<Record<string, DocumentRole>>(defaultRoles);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // `sliders` is what the user set. `positions` is what each target actually uses: where a
  // position is infeasible for a target, the relaxation (§3.2.3) settles on a nearer one there.
  const [sliders, setSliders] = useState(neutralSliders);
  const [positions, setPositions] = useState<Record<string, SliderPositions>>({});
  const [learned, setLearned] = useState<LearnedIntent | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<string>();
  const [changes, setChanges] = useState<SnippetChanges | null>(null);

  const [guideOn, setGuideOn] = useStoredFlag("ex2bundle-guide-on", false);
  const [hintSeen, setHintSeen] = useStoredFlag("ex2bundle-guide-hint-seen", false, true);
  const [guideIntro, setGuideIntro] = useState(0); // intro steps passed with "Next"
  const [viewedTargets, setViewedTargets] = useState(false);
  const [movedSlider, setMovedSlider] = useState(false);

  const sourceDocuments = documents.filter((document) => roles[document.id] === "source");
  const targetDocuments = documents.filter((document) => roles[document.id] === "target");
  const exampleSnippets = sourceDocuments
    .map((document) => document.sentences.filter((sentence) => selectedIds.includes(sentence.id)))
    .filter((snippet) => snippet.length > 0);
  const inputKey = JSON.stringify([exampleSnippets.map((snippet) => snippet.map((sentence) => sentence.id)), targetDocuments.map((document) => document.id)]);

  const positionsOf = (targetId: string) => positions[targetId] ?? neutralSliders();
  // Ex2Bundle re-runs the package query whenever a slider moves.
  const results = useMemo(
    () => learned?.targets.map((prepared) => snippetAt(prepared, positions[prepared.target.id] ?? neutralSliders())) ?? null,
    [learned, positions],
  );
  const activeResult = results?.find((result) => result.target.id === activeTargetId) ?? results?.[0];
  const stale = !!learned && learned.key !== inputKey;
  // Sliders re-retrieve on their own; Retrieve is needed only when examples or targets change.
  const upToDate = !!learned && !stale;
  const canRetrieve = exampleSnippets.length > 0 && targetDocuments.length > 0 && !upToDate;

  // The next thing to do in the demo, based on the current state.
  function coachStep(): CoachStep {
    if (guideIntro < 1 && !learned) {
      return { id: "documents", n: 1, target: ".selection-panel", anchor: ".selection-panel h2", place: "right", next: true,
        text: <><b>Choose documents.</b> You pick example sentences from Sources; a snippet is extracted from every Target. Utah, Arizona and Washington start as sources.</> };
    }
    if (!sourceDocuments.length || !targetDocuments.length) {
      return { id: "roles", n: 1, target: ".selection-panel", anchor: ".selection-panel h2", place: "right",
        text: <>Mark at least one document as a <b>Source</b> and one as a <b>Target</b>.</> };
    }
    if (!exampleSnippets.length) {
      return { id: "examples", n: 2, target: ".reader-panel", anchor: ".reader-panel .reader-body", place: "right",
        text: <><b>Pick example sentences.</b> Click the sentences you would want in a snippet. Try the other source tabs too.</> };
    }
    if (!learned || stale) {
      return { id: "retrieve", n: 3, target: ".retrieve-button",
        text: <>Click <b>Retrieve snippets</b> to extract a snippet from every target document.</> };
    }
    if (!viewedTargets) {
      return { id: "results", n: 4, target: ".results-panel .tabs",
        text: <><b>Read the snippets.</b> Open each target tab; the highlighted sentences form its snippet.</> };
    }
    if (!movedSlider) {
      return { id: "sliders", n: 5, target: ".intent-panel", place: "left",
        text: <><b>Refine your intent.</b> Slide a topic left for less of it or right for more.</> };
    }
    return { id: "done", label: "All set", target: ".switch",
      text: <>That&apos;s the full loop. Hover any <b>?</b> to learn what each part means.</> };
  }

  function changeRole(documentId: string, role: DocumentRole) {
    setRoles((current) => ({ ...current, [documentId]: role }));
    if (role !== "source") setSelectedIds((current) => current.filter((id) => !id.startsWith(`${documentId}-`)));
  }

  function toggleSentence(sentenceId: string) {
    setSelectedIds((current) => current.includes(sentenceId) ? current.filter((id) => id !== sentenceId) : [...current, sentenceId]);
  }

  // Remember the snippets from before this adjustment so the results can show what changed.
  function markAdjustment() {
    if (!results) return;
    const before = Object.fromEntries(results.map((result) => [result.target.id, result.bundle.map((sentence) => sentence.id)]));
    setChanges((current) => ({ before, version: (current?.version ?? 0) + 1, seen: [] }));
  }

  // Applies a released slider to every target (§3.2.3). The slider itself stays where it was put.
  function commitSlider(topic: TopicId, requested: number) {
    if (!learned) return;
    markAdjustment();
    setSliders((current) => ({ ...current, [topic]: requested }));
    const next = Object.fromEntries(
      learned.targets.map((prepared) => {
        const current = positionsOf(prepared.target.id);
        return [prepared.target.id, { ...current, [topic]: moveSlider(prepared, current, topic, requested) }];
      }),
    );
    setPositions(next);
    setMovedSlider(true);
  }

  function resetSliders() {
    markAdjustment();
    setSliders(neutralSliders());
    setPositions({});
  }

  function selectTarget(targetId: string) {
    setActiveTargetId(targetId);
    setViewedTargets(true);
    setChanges((current) => current && { ...current, seen: [...current.seen, targetId] });
  }

  // Steps (2)–(5): synthesize bounds from the example snippets and relax them per target.
  // The sliders being shown are kept (they are relative to neutral, which moves with the
  // examples) and re-validated against each target's new neutral bounds.
  function retrieve() {
    const bounds = synthesizeBounds(exampleSnippets);
    const prepared = targetDocuments.map((target) => prepareTarget(target, bounds));
    setPositions(Object.fromEntries(prepared.map((p) => [p.target.id, settle(p, sliders)])));
    setLearned({ key: inputKey, targets: prepared, run: (learned?.run ?? 0) + 1 });
    document.querySelector(".results-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveTargetId(targetDocuments[0]?.id);
    setChanges(null);
  }

  function setGuide(on: boolean) {
    setHintSeen(true);
    setGuideOn(on);
  }

  return (
    <main className={`app-shell ${guideOn ? "guide-on" : ""}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <strong>Ex2Bundle</strong>
          <span>Example-Driven Intent Synthesis for Constrained Data Bundle Retrieval: Focused Text Snippet Extraction and Beyond</span>
        </div>
        <div className="topbar-actions">
          <span className="demo-pill">Demo</span>
          <div className="guide-switch-wrap">
            <label className="switch">
              <input type="checkbox" role="switch" checked={guideOn} onChange={(event) => setGuide(event.target.checked)} />
              <span className="switch-track" aria-hidden />
              Guide mode
            </label>
            {!guideOn && !hintSeen && (
              <div className="guide-hint">
                <button type="button" className="guide-hint-text" onClick={() => setGuide(true)}>
                  👋 New here? <b>Click here for guide mode</b>
                </button>
                <button type="button" className="guide-hint-close" aria-label="Dismiss" onClick={() => setHintSeen(true)}>
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <DocumentSelection documents={documents} roles={roles} onRoleChange={changeRole} />

      <div className="workspace">
        <ExampleReader documents={sourceDocuments} selectedIds={selectedIds} onToggle={toggleSentence} onClear={() => setSelectedIds([])} />
        <div className="side-column">
          <IntentSliders
            sliders={sliders}
            ready={!!learned}
            onCommit={commitSlider}
            onReset={resetSliders}
          />
          <section className="panel retrieve-panel">
            <div className="retrieve-row">
              <button className={`retrieve-button ${upToDate ? "up-to-date" : ""}`} disabled={!canRetrieve} onClick={retrieve}>
                {upToDate ? "Snippets up to date ✓" : <>Retrieve snippets <span>→</span></>}
              </button>
              <GuideDot tip="retrieve" />
            </div>
            <p className="muted">
              {exampleSnippets.length} example snippets · {targetDocuments.length} target documents
            </p>
          </section>
        </div>
      </div>

      <RetrievedDocuments results={results} active={activeResult} changes={changes} onSelect={selectTarget} stale={stale} run={learned?.run ?? 0} />

      {guideOn && <GuideLayer step={coachStep()} total={COACH_TOTAL} onNext={() => setGuideIntro((n) => n + 1)} />}
    </main>
  );
}
