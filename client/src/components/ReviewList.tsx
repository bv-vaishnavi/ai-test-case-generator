import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  Pencil,
  Trash2,
  GitBranch,
  Check,
  X,
  FileText,
  TriangleAlert,
} from "lucide-react";
import type { ItemKind, Project, ReviewItem, TestCase } from "../types/project";
export default function ReviewList({
  items,
  kind,
  project,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onReview,
  onWorkflow,
  busy,
}: {
  items: ReviewItem[];
  kind: ItemKind;
  project: Project;
  selected: string[];
  onSelect: (id: string) => void;
  onEdit: (item: ReviewItem) => void;
  onDelete: (id: string) => void;
  onReview: (id: string, action: "approve" | "reject") => void;
  onWorkflow: (id: string) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <div className="review-list">
      {items.map((item, index) => {
        const open = expanded.includes(item._id);
        const test = item as TestCase;
        const state =
          item.reviewState || (item.approved ? "approved" : "pending");
        return (
          <article
            className={`review-row ${open ? "is-open" : ""}`}
            key={item._id}
          >
            <div className="review-row-header">
              <button
                className="icon-btn expand-button"
                aria-label={`${open ? "Collapse" : "Expand"} ${item.title}`}
                aria-expanded={open}
                aria-controls={`details-${item._id}`}
                onClick={() =>
                  setExpanded(
                    open
                      ? expanded.filter((id) => id !== item._id)
                      : [...expanded, item._id],
                  )
                }
              >
                {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              <input
                type="checkbox"
                aria-label={`Select ${item.title}`}
                checked={selected.includes(item._id)}
                onChange={() => onSelect(item._id)}
                disabled={busy}
              />
              <span className={`item-symbol ${kind}`}>
                {kind === "workflows" ? (
                  <GitBranch size={14} />
                ) : kind === "testCases" ? (
                  <TriangleAlert size={14} />
                ) : (
                  <FileText size={14} />
                )}
              </span>
              <button
                className="item-title"
                onClick={() =>
                  setExpanded(
                    open
                      ? expanded.filter((id) => id !== item._id)
                      : [...expanded, item._id],
                  )
                }
              >
                <strong>
                  {kind === "testCases" && (
                    <span className="case-number">
                      TC-{String(index + 1).padStart(3, "0")} ·{" "}
                    </span>
                  )}
                  {item.title}
                </strong>
                <span>{item.description || test.expectedResult}</span>
              </button>
              <span className={`badge ${state}`}>{state}</span>
              <div className="row-actions">
                <button
                  className="icon-btn"
                  title="Edit"
                  aria-label={`Edit ${item.title}`}
                  disabled={busy}
                  onClick={() => onEdit(item)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-btn danger"
                  title="Delete"
                  aria-label={`Delete ${item.title}`}
                  disabled={busy}
                  onClick={() => onDelete(item._id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {(item.explicit || kind === "testCases") && (
              <div className="row-tags">
                {item.explicit && (
                  <span className="explicit-label">Explicit</span>
                )}
                {kind === "testCases" && (
                  <span className={`badge ${test.type}`}>{test.type}</span>
                )}
              </div>
            )}
            {kind === "workflows" && (
              <div className="workflow-summary">
                {(["rules", "userStories", "testCases"] as const).map((k) => (
                  <span className={`count-chip ${k}`} key={k}>
                    {
                      project[k].filter(
                        (child) => child.workflowId === item._id,
                      ).length
                    }{" "}
                    {k === "userStories"
                      ? "User stories"
                      : k === "testCases"
                        ? "Test cases"
                        : "Rules"}
                  </span>
                ))}
                <button
                  className="text-link"
                  onClick={() => onWorkflow(item._id)}
                >
                  View workflow <ArrowUpRight size={12} />
                </button>
              </div>
            )}
            {open && (
              <div className="review-details" id={`details-${item._id}`}>
                {kind === "testCases" ? (
                  <>
                    <h3>Preconditions</h3>
                    {test.preconditions.length ? (
                      <ul>
                        {test.preconditions.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No preconditions.</p>
                    )}
                    <h3>Test steps</h3>
                    <ol>
                      {test.steps.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ol>
                    <div className="expected">
                      <h3>Expected result</h3>
                      <p>{test.expectedResult}</p>
                    </div>
                  </>
                ) : kind === "workflows" ? (
                  <div className="workflow-groups">
                    {(["rules", "userStories", "testCases"] as const).map(
                      (k) => (
                        <details key={k}>
                          <summary className={`count-chip ${k}`}>
                            {
                              project[k].filter(
                                (child) => child.workflowId === item._id,
                              ).length
                            }{" "}
                            {k === "userStories"
                              ? "User stories"
                              : k === "testCases"
                                ? "Test cases"
                                : "Rules"}
                          </summary>
                          {project[k]
                            .filter((child) => child.workflowId === item._id)
                            .map((child) => (
                              <div className="workflow-child" key={child._id}>
                                {child.title}
                                <span className={`badge ${child.reviewState}`}>
                                  {child.reviewState}
                                </span>
                              </div>
                            ))}
                        </details>
                      ),
                    )}
                  </div>
                ) : (
                  <p>{item.description}</p>
                )}
                <div className="actions">
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => onReview(item._id, "reject")}
                  >
                    <X size={14} />
                    Reject
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => onReview(item._id, "approve")}
                  >
                    <Check size={14} />
                    Approve
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
