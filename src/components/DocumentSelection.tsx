import type { DocumentRole, SourceDocument } from "@/data/documents";
import GuideDot from "@/components/guide/GuideDot";

const roleOptions: { value: DocumentRole; label: string }[] = [
  { value: "source", label: "Source" },
  { value: "target", label: "Target" },
  { value: "none", label: "Off" },
];

type Props = {
  documents: SourceDocument[];
  roles: Record<string, DocumentRole>;
  onRoleChange: (documentId: string, role: DocumentRole) => void;
};

export default function DocumentSelection({ documents, roles, onRoleChange }: Props) {
  const sourceCount = documents.filter((document) => roles[document.id] === "source").length;
  const targetCount = documents.filter((document) => roles[document.id] === "target").length;

  return (
    <section className="panel selection-panel">
      <div className="panel-heading">
        <div className="heading-title">
          <h2>Document selection</h2>
          <GuideDot tip="documents" />
        </div>
        <span className="badge">{sourceCount} sources · {targetCount} targets</span>
      </div>
      <div className="selection-grid">
        {documents.map((document) => {
          const role = roles[document.id] ?? "none";
          return (
            <div className={`selection-card role-${role}`} key={document.id}>
              <div className="selection-name">
                <strong>{document.title}</strong>
                <small>{document.sentences.length} sentences</small>
              </div>
              <div className="segmented" role="radiogroup" aria-label={`${document.title} role`}>
                {roleOptions.map((option) => (
                  <button
                    key={option.value}
                    role="radio"
                    aria-checked={role === option.value}
                    className={role === option.value ? "active" : ""}
                    onClick={() => onRoleChange(document.id, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
