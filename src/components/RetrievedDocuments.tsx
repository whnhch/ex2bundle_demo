import type { SnippetResult } from "@/lib/ex2bundle";
import GuideDot from "@/components/guide/GuideDot";

/** Snippets as they were before the latest slider adjustment, to show what it changed. */
export type SnippetChanges = { before: Record<string, string[]>; version: number; seen: string[] };

type Props = {
  results: SnippetResult[] | null;
  active: SnippetResult | undefined;
  changes: SnippetChanges | null;
  onSelect: (targetId: string) => void;
  stale: boolean;
  run: number; // increments on every Retrieve, to replay the reveal animation
};

const idsOf = (result: SnippetResult) => result.bundle.map((sentence) => sentence.id);
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

export default function RetrievedDocuments({ results, active, changes, onSelect, stale, run }: Props) {
  const changed = new Set(
    changes && results ? results.filter((result) => !sameIds(changes.before[result.target.id] ?? [], idsOf(result))).map((result) => result.target.id) : [],
  );
  const before = changes && active ? changes.before[active.target.id] ?? [] : null;

  return (
    <section className="panel results-panel">
      <div className="panel-heading">
        <div className="heading-title">
          <h2>Retrieved snippets</h2>
          <GuideDot tip="results" />
        </div>
        {stale ? (
          <span className="badge warning">Examples or targets changed — retrieve again</span>
        ) : (
          changes && results && (
            <span className={`badge ${changed.size ? "changed" : ""}`}>
              {changed.size ? `Slider change updated ${changed.size} of ${results.length} snippets` : "Slider change didn't alter any snippet"}
            </span>
          )
        )}
      </div>
      {active && results ? (
        <div key={run} className={`results-body ${stale ? "stale" : ""}`}>
          <div className="tabs" role="tablist" aria-label="Target documents">
            {results.map((result) => {
              const unseenChange = result !== active && changed.has(result.target.id) && !changes?.seen.includes(result.target.id);
              return (
                <button
                  key={result.target.id}
                  role="tab"
                  aria-selected={result === active}
                  className={`tab ${result === active ? "active" : ""}`}
                  onClick={() => onSelect(result.target.id)}
                >
                  {result.target.title}
                  <span className="tab-count">{result.bundle.length}</span>
                  {unseenChange && <span className="tab-dot" aria-label="snippet changed" />}
                </button>
              );
            })}
          </div>
          <div className="result-detail" role="tabpanel">
            <article className="reader-document result-text">
              <p>
                {active.target.sentences.map((sentence) => {
                  const inSnippet = active.bundle.includes(sentence);
                  const entered = before !== null && inSnippet && !before.includes(sentence.id);
                  const dropped = before !== null && !inSnippet && before.includes(sentence.id);
                  return (
                    <span key={sentence.id}>
                      <span
                        // re-keyed per adjustment so the "entered" flash replays
                        key={`${sentence.id}-${changes?.version ?? 0}`}
                        className={`document-sentence static ${inSnippet ? "selected" : ""} ${entered ? "entered" : ""} ${dropped ? "dropped" : ""}`}
                      >
                        {sentence.text}
                      </span>{" "}
                    </span>
                  );
                })}
              </p>
            </article>
          </div>
        </div>
      ) : (
        <div className="empty-state">Nothing retrieved yet.</div>
      )}
    </section>
  );
}
