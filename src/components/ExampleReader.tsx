import { useState } from "react";
import { topicIds, topicLabels, type SourceDocument } from "@/data/documents";
import { topicProfile } from "@/lib/ex2bundle";
import GuideDot from "@/components/guide/GuideDot";

type Props = {
  documents: SourceDocument[];
  selectedIds: string[];
  onToggle: (sentenceId: string) => void;
  onClear: () => void;
};

export default function ExampleReader({ documents, selectedIds, onToggle, onClear }: Props) {
  const [activeId, setActiveId] = useState(documents[0]?.id);
  const activeDocument = documents.find((document) => document.id === activeId) ?? documents[0];
  const snippetOf = (document: SourceDocument) => document.sentences.filter((sentence) => selectedIds.includes(sentence.id));
  const snippetCount = documents.filter((document) => snippetOf(document).length > 0).length;
  const activeProfile = activeDocument ? topicProfile(snippetOf(activeDocument)) : null;

  return (
    <section className="panel reader-panel">
      <div className="panel-heading">
        <div className="heading-title">
          <h2>Source documents</h2>
          <GuideDot tip="sources" />
        </div>
        <div className="heading-actions">
          <span className="badge">{snippetCount} example snippets</span>
          {selectedIds.length > 0 && <button className="text-button" onClick={onClear}>Clear</button>}
        </div>
      </div>
      {activeDocument && activeProfile ? (
        <>
          <div className="tabs" role="tablist" aria-label="Source documents">
            {documents.map((document) => {
              const count = snippetOf(document).length;
              return (
                <button
                  key={document.id}
                  role="tab"
                  aria-selected={document.id === activeDocument.id}
                  className={`tab ${document.id === activeDocument.id ? "active" : ""}`}
                  onClick={() => setActiveId(document.id)}
                >
                  {document.title}
                  {count > 0 && <span className="tab-count">{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="reader-body" role="tabpanel">
            <article className="reader-document">
              <p>
                {activeDocument.sentences.map((sentence) => {
                  const selected = selectedIds.includes(sentence.id);
                  return (
                    <span key={sentence.id}>
                      <span
                        role="button"
                        tabIndex={0}
                        className={`document-sentence ${selected ? "selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => onToggle(sentence.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onToggle(sentence.id);
                          }
                        }}
                      >
                        {sentence.text}
                      </span>{" "}
                    </span>
                  );
                })}
              </p>
            </article>
          </div>
          <div className="profile-strip">
            <span className="summary-label">Example snippet topic profile <GuideDot tip="profile" /></span>
            <div className="chip-row">
              {topicIds.some((id) => activeProfile[id] > 0) ? (
                topicIds
                  .filter((id) => activeProfile[id] > 0)
                  .map((id) => (
                    <span className="chip profile" key={id}>
                      {topicLabels[id]} <b>{activeProfile[id].toFixed(2)}</b>
                    </span>
                  ))
              ) : (
                <span className="muted">No sentences selected in {activeDocument.title}.</span>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">Mark at least one document as a source to select example snippets.</div>
      )}
    </section>
  );
}
