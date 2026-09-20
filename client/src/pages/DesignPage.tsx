import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRef } from "react";
import Composer from "../components/Composer";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import api, { errorMessage } from "../services/api";
import { useProject } from "../hooks/useProject";
import { ErrorNotice, Loading, Notice, PageError } from "../components/UI";
import type { Design, Project } from "../types/project";
export default function DesignPage() {
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
  return <DesignEditor key={state.project._id} project={state.project} />;
}
function DesignEditor({ project }: { project: Project }) {
  const navigate = useNavigate();
  const [design, setDesign] = useState<Design>({
    category: project.design.category || "Functional",
    technique: project.design.technique || "General",
    format: project.design.format || "standard",
    outputTypes: ["testCases", "userStories"],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  async function generate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.put(`/projects/${project._id}/design`, design);
      await api.post(`/projects/${project._id}/generate`, { feedback });
      navigate(`/projects/${project._id}/results`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`flow-column design-page ${expanded ? "wide" : ""}`}>
      <Notice>
        Associated context saved. Project: <strong>{project.name}</strong>
      </Notice>
      <p className="flow-caption">
        Generate test cases with supporting workflows, rules, and user stories.
      </p>
      <form ref={formRef} onSubmit={generate}>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h1>Test Design Optimization</h1>
              <p>
                Optional — select technique categories and preferred techniques
                to steer coverage.
              </p>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={
                expanded ? "Collapse design panel" : "Expand design panel"
              }
              onClick={() => setExpanded(!expanded)}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <h2 className="section-title">Design Technique Category</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="field">
              Category
              <select
                value={design.category}
                disabled={busy}
                onChange={(e) =>
                  setDesign({
                    ...design,
                    category: e.target.value as Design["category"],
                  })
                }
              >
                {["Functional", "Validation", "UI", "API"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Technique
              <select
                value={design.technique}
                disabled={busy}
                onChange={(e) =>
                  setDesign({ ...design, technique: e.target.value })
                }
              >
                {[
                  "General",
                  "Equivalence Partitioning",
                  "Boundary Value Analysis",
                  "Decision Table",
                  "Exploratory Testing",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="format-fieldset" disabled={busy}>
            <legend>Select Test Case Format</legend>
            <span className="muted">Format type</span>
            <div className="radio-row">
              {[
                { value: "standard", label: "Standard" },
                { value: "bdd-gherkin", label: "BDD (Gherkin)" },
                { value: "bdd-2", label: "BDD 2.0" },
              ].map(({ value, label }) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="format"
                    value={value}
                    checked={design.format === value}
                    onChange={() =>
                      setDesign({
                        ...design,
                        format: value as Design["format"],
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="muted">
              {design.format === "standard"
                ? "Preconditions, ordered steps, and expected results."
                : design.format === "bdd-gherkin"
                  ? "Given / When / Then scenarios."
                  : "Given / When / Then scenarios with concrete example data."}
            </p>
          </fieldset>
        </section>
        <ErrorNotice message={error} />
        {project.testCases.length > 0 && (
          <p className="muted">
            Generating replaces existing results, including edits and review
            decisions.
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => navigate(`/projects/${project._id}/context`)}
          >
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={15} />}{" "}
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
        {busy && (
          <p className="generation-status" role="status">
            Analyzing requirements and checking coverage. This can take up to
            three minutes. Your previous results remain saved until generation
            succeeds.
          </p>
        )}
      </form>
      <div className="flow-composer">
        <Composer
          value={feedback}
          onChange={setFeedback}
          onSubmit={() => formRef.current?.requestSubmit()}
          busy={busy}
          placeholder="Any instructions for your test suite?"
          maxLength={2000}
        />
      </div>
    </div>
  );
}
