import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
  X,
  GitBranch,
  ArrowDown,
  Search,
  Check,
} from "lucide-react";
import api, { errorMessage } from "../services/api";
import { useProject } from "../hooks/useProject";
import {
  ErrorNotice,
  Loading,
  Modal,
  Notice,
  PageError,
} from "../components/UI";
import ItemEditor from "../components/ItemEditor";
import Composer from "../components/Composer";
import ReviewList from "../components/ReviewList";
import type { ItemKind, Project, ReviewItem } from "../types/project";
const stages: { key: ItemKind | "export"; label: string; title: string }[] = [
  { key: "workflows", label: "Workflows", title: "Generated Workflows" },
  { key: "rules", label: "Rules", title: "Generated Rules" },
  {
    key: "userStories",
    label: "User stories",
    title: "Generated User Stories",
  },
  { key: "testCases", label: "Test cases", title: "Generated Testcases" },
  { key: "export", label: "Export", title: "Export Testcases" },
];
export default function ResultsPage() {
  const { projectId } = useParams();
  const state = useProject(projectId);
  if (state.loading) return <Loading />;
  if (state.error || !state.project)
    return (
      <PageError
        message={state.error || "Project not found."}
        retry={state.reload}
      />
    );
  return (
    <ReviewWorkspace
      key={state.project._id}
      project={state.project}
      setProject={state.setProject}
    />
  );
}
function ReviewWorkspace({
  project,
  setProject,
}: {
  project: Project;
  setProject: Dispatch<SetStateAction<Project | null>>;
}) {
  const [stage, setStage] = useState(project.workflows.length ? 0 : 3);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<ReviewItem | null>(null);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [regenerate, setRegenerate] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [wide, setWide] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const kind: ItemKind =
    stages[stage].key === "export"
      ? "testCases"
      : (stages[stage].key as ItemKind);
  const items = project[kind];
  const filtered = items.filter((item) =>
    `${item.title} ${item.description}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const workflow = project.workflows.find((w) => w._id === workflowId);
  const generating = project.status === "generating";
  const disabled = busy || generating;
  useEffect(() => {
    if (!generating) return;
    const controller = new AbortController();
    const timer = setInterval(async () => {
      try {
        const r = await api.get(`/projects/${project._id}`, {
          signal: controller.signal,
        });
        setProject(r.data.project);
      } catch (e) {
        if (!controller.signal.aborted) setError(errorMessage(e));
      }
    }, 5000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [generating, project._id, setProject]);
  function changeStage(index: number) {
    setStage(index);
    setSelected([]);
    setQuery("");
    setSuccess("");
    setWorkflowId(null);
  }
  async function bulk(
    ids: string[],
    action: "approve" | "reject" | "explicit" | "delete",
  ) {
    if (disabled) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await api.post(`/projects/${project._id}/items/${kind}/bulk`, {
        ids,
        action,
      });
      setProject(r.data.project);
      setSelected([]);
      setDeleting(null);
      setSuccess(
        action === "delete"
          ? "Selected items deleted."
          : "Review changes saved.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await api.post(`/projects/${project._id}/regenerate`, {
        feedback,
      });
      setProject(r.data.project);
      changeStage(0);
      setRegenerate(false);
      setFeedback("");
      setSuccess("A new test suite is ready to review.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportExcel() {
    setBusy(true);
    setError("");
    try {
      const r = await api.post(
        `/projects/${project._id}/export`,
        selected.length ? { ids: selected } : {},
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.replace(/[^a-z0-9-]/gi, "_")}-test-cases.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess("Excel export downloaded.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`results-page ${wide || workflow ? "results-expanded" : ""}`}
    >
      {workflow && (
        <section className="workflow-pane">
          <header>
            <h2>Workflow</h2>
            <button
              className="icon-btn"
              aria-label="Close workflow"
              onClick={() => setWorkflowId(null)}
            >
              <X size={18} />
            </button>
          </header>
          <label className="field">
            Select workflow
            <select
              value={workflow._id}
              onChange={(e) => setWorkflowId(e.target.value)}
            >
              {project.workflows.map((w) => (
                <option value={w._id} key={w._id}>
                  {w.title}
                </option>
              ))}
            </select>
          </label>
          <div className="workflow-map">
            <div className="map-root">
              <GitBranch size={20} />
              <strong>{workflow.title}</strong>
              <p>{workflow.description}</p>
            </div>
            <ArrowDown className="map-arrow" />
            <div className="map-nodes">
              {project.rules
                .filter((r) => r.workflowId === workflow._id)
                .map((rule) => (
                  <div className="map-node" key={rule._id}>
                    <span className="eyebrow">BUSINESS RULE</span>
                    <strong>{rule.title}</strong>
                    <p>{rule.description}</p>
                  </div>
                ))}
            </div>
            <ArrowDown className="map-arrow" />
            <div className="map-nodes">
              {project.testCases
                .filter((c) => c.workflowId === workflow._id)
                .map((c) => (
                  <div className="map-node" key={c._id}>
                    <span className={`badge ${c.type}`}>{c.type}</span>
                    <strong>{c.title}</strong>
                  </div>
                ))}
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setWorkflowId(null)}>
              Close
            </button>
            <button
              className="btn primary"
              disabled={disabled}
              onClick={() => {
                void bulk([workflow._id], "approve");
                setWorkflowId(null);
              }}
            >
              Approve workflow
            </button>
          </div>
        </section>
      )}
      <div className="review-column">
        <Notice>
          {generating
            ? "Test cases are being generated. You can stay here while they are prepared."
            : project.generatedAt
              ? "Test cases are saved. Review the generated scenarios below."
              : "Review your saved test cases."}
        </Notice>
        <div className="project-breadcrumb">
          <Link to="/projects">Projects</Link>
          <span>/</span>
          <strong>{project.name}</strong>
        </div>
        <nav className="step-tabs" aria-label="Review stages">
          {stages.map((s, i) => (
            <button
              key={s.key}
              className={i === stage ? "active" : ""}
              onClick={() => changeStage(i)}
              disabled={busy}
              aria-current={i === stage ? "step" : undefined}
            >
              <span>{i + 1}</span>
              {s.label}
            </button>
          ))}
        </nav>
        <p className="flow-caption">
          {stage === 4
            ? "Export the selected test cases, or download the full list."
            : `Step ${stage + 1}: Review the ${stages[stage].label.toLowerCase()}.`}
        </p>
        <section className="panel review-panel">
          <div className="panel-heading">
            <h1>
              {stages[stage].title} ({items.length})
            </h1>
            <button
              className="icon-btn"
              aria-label={
                wide ? "Collapse review panel" : "Expand review panel"
              }
              onClick={() => {
                setWide(!wide);
                setWorkflowId(null);
              }}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="review-toolbar">
            <label className="select-all">
              <input
                type="checkbox"
                checked={
                  filtered.length > 0 &&
                  filtered.every((item) => selected.includes(item._id))
                }
                disabled={disabled || !filtered.length}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? filtered.map((i) => i._id) : [],
                  )
                }
              />
              Select all
            </label>
            <label className="search-field">
              <Search size={14} />
              <input
                aria-label="Search items"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <span className="muted">
              {
                items.filter((i) => i.reviewState === "approved" || i.approved)
                  .length
              }{" "}
              approved
            </span>
          </div>
          {!filtered.length ? (
            <div className="empty-state">
              <p>
                {query
                  ? "No items match your search."
                  : generating
                    ? "Generation is in progress…"
                    : "No items here yet."}
              </p>
              {!query && !generating && (
                <Link className="btn" to={`/projects/${project._id}/design`}>
                  Configure generation
                </Link>
              )}
            </div>
          ) : (
            <ReviewList
              items={filtered}
              kind={kind}
              project={project}
              selected={selected}
              onSelect={(id) =>
                setSelected(
                  selected.includes(id)
                    ? selected.filter((v) => v !== id)
                    : [...selected, id],
                )
              }
              onEdit={setEditing}
              onDelete={(id) => setDeleting([id])}
              onReview={(id, action) => bulk([id], action)}
              onWorkflow={setWorkflowId}
              busy={disabled}
            />
          )}
        </section>
        <ErrorNotice message={error} />
        {success && (
          <p className="success-notice" role="status">
            <Check size={14} />
            {success}
          </p>
        )}
        {selected.length > 0 && (
          <div className="bulk-bar" aria-label="Selected item actions">
            <span>{selected.length} selected</span>
            <button
              title="Approve selected"
              aria-label="Approve selected"
              disabled={disabled}
              onClick={() => bulk(selected, "approve")}
            >
              <CheckCircle2 className="approve-icon" size={18} />
            </button>
            <button
              title="Reject selected"
              aria-label="Reject selected"
              disabled={disabled}
              onClick={() => bulk(selected, "reject")}
            >
              <XCircle className="reject-icon" size={18} />
            </button>
            <button
              className="bulk-text"
              disabled={disabled}
              onClick={() => bulk(selected, "explicit")}
            >
              Mark as Explicit
            </button>
            {selected.length === 1 && (
              <button
                aria-label="Edit selected"
                disabled={disabled}
                onClick={() =>
                  setEditing(items.find((i) => i._id === selected[0]) || null)
                }
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              aria-label="Delete selected"
              disabled={disabled}
              onClick={() => setDeleting(selected)}
            >
              <Trash2 size={16} />
            </button>
            {kind === "testCases" && (
              <button
                className="bulk-text"
                disabled={disabled}
                onClick={exportExcel}
              >
                Export to Excel
              </button>
            )}
          </div>
        )}
        <div className="review-footer">
          <Link className="text-link" to={`/projects/${project._id}/design`}>
            Back to design
          </Link>
          <div className="actions">
            <button
              className="btn"
              disabled={disabled}
              onClick={() => setRegenerate(true)}
            >
              <RefreshCw size={14} />
              Regenerate
            </button>
            {stage < 4 ? (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => changeStage(stage + 1)}
              >
                Continue
              </button>
            ) : (
              <button
                className="btn primary"
                disabled={disabled || !items.length}
                onClick={exportExcel}
              >
                <Download size={14} />
                Export {selected.length ? "selected" : "all"} to Excel
              </button>
            )}
          </div>
        </div>
        <p className="saved-caption">
          Edits and review decisions are saved automatically. AI output should
          be checked against your requirements.
        </p>
        <div className="flow-composer">
          <Composer
            value={feedback}
            onChange={setFeedback}
            onSubmit={() => setRegenerate(true)}
            busy={disabled}
            placeholder="What would you like to improve in these test cases?"
            maxLength={2000}
          />
        </div>
      </div>
      {editing && (
        <ItemEditor
          item={editing}
          kind={kind}
          projectId={project._id}
          onSave={(p) => {
            setProject(p);
            setSuccess("Changes saved.");
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <Modal
          title={`Delete ${deleting.length} selected item${deleting.length > 1 ? "s" : ""}?`}
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p>
            This permanently removes the selected items.
            {kind === "workflows" &&
              " Deleting a workflow also removes its rules, user stories, and test cases."}
          </p>
          <ErrorNotice message={error} />
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="btn danger-solid"
              disabled={busy}
              onClick={() => bulk(deleting, "delete")}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
      {regenerate && (
        <Modal
          title="Regenerate test suite"
          onClose={() => setRegenerate(false)}
          busy={busy}
        >
          <p>
            A new generation replaces the current workflows, rules, user
            stories, test cases, and review decisions. Existing results stay
            saved if generation fails.
          </p>
          <label className="field">
            What should the AI improve? (optional)
            <textarea
              rows={4}
              maxLength={2000}
              value={feedback}
              disabled={busy}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="For example: add more boundary-value scenarios"
            />
          </label>
          <ErrorNotice message={error} />
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setRegenerate(false)}
            >
              Cancel
            </button>
            <button className="btn primary" disabled={busy} onClick={generate}>
              {busy ? "Generating…" : "Regenerate"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
