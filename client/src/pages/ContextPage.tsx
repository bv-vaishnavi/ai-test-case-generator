import { useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  FolderOpen,
  Database,
  FileText,
  Upload,
  Trash2,
  Download,
  Plus,
} from "lucide-react";
import { useProject } from "../hooks/useProject";
import api, { errorMessage } from "../services/api";
import { ErrorNotice, Loading, Notice, PageError } from "../components/UI";
import { validateFile } from "../lib/files";
import Composer from "../components/Composer";
import type { Project } from "../types/project";
export default function ContextPage() {
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
  return <ContextEditor key={state.project._id} initial={state.project} />;
}
function ContextEditor({ initial }: { initial: Project }) {
  const navigate = useNavigate();
  const [project, setProject] = useState(initial);
  const [description, setDescription] = useState(
    initial.context.description || "",
  );
  const [additional, setAdditional] = useState(
    initial.context.additionalContext || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  async function upload(file?: File) {
    if (!file || busy) return;
    const validation = validateFile(file);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api.post(`/projects/${project._id}/context/file`, form);
      setProject(r.data.project);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await api.delete(`/projects/${project._id}/attachments/${id}`);
      setProject(r.data.project);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await api.get(
        `/projects/${project._id}/attachments/${id}/download`,
        { responseType: "blob" },
      );
      const attachment = project.attachments.find((item) => item._id === id);
      const url = URL.createObjectURL(r.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment?.fileName || "attachment";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.put(`/projects/${project._id}/context`, {
        description,
        additionalContext: additional,
      });
      navigate(`/projects/${project._id}/design`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const hasContext =
    description.trim() ||
    additional.trim() ||
    project.attachments.length ||
    project.context.extractedText;
  return (
    <div className="flow-column context-page">
      <Notice>
        Project <strong>“{project.name}”</strong> is ready.
      </Notice>
      <div className="mini-project">
        <div>
          <strong>{project.name}</strong>
          <ArrowUpRight size={14} />
        </div>
        <span className="badge approved">
          {project.status.replaceAll("_", " ")}
        </span>
        <p>
          <strong>{project.testCases.length}</strong> Total Test Cases
        </p>
        <small>
          Last updated {new Date(project.updatedAt).toLocaleString()}
        </small>
      </div>
      <p className="flow-caption">
        What other context would you like to consider for creating the test
        cases?
      </p>
      <form ref={formRef} onSubmit={save}>
        <section className="panel">
          <div className="panel-heading">
            <h1>Associate Context</h1>
            <ArrowUpRight size={16} />
          </div>
          <div className="source-heading">
            <span className="eyebrow">ADD SOURCES</span>
            <span className="muted">PDF or TXT · up to 5 MB each</span>
          </div>
          <div className="source-grid">
            <button
              type="button"
              className="source-card"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <FolderOpen />
              <span>LOCAL FILES</span>
            </button>
            {[
              { icon: Database, label: "KNOWLEDGE BASE" },
              { icon: FileText, label: "WM REQ" },
              { icon: Upload, label: "WM TCM" },
            ].map(({ icon: Icon, label }) => (
              <div
                className="source-card unavailable"
                key={label}
                title="Not part of this assessment"
              >
                <Icon />
                <span>{label}</span>
                <small>Not connected</small>
              </div>
            ))}
          </div>
          <input
            type="file"
            ref={fileRef}
            accept=".pdf,.txt"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <label className="field">
            Original requirement
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={50000}
              rows={4}
              placeholder="Describe the feature or paste a user story"
              disabled={busy}
            />
          </label>
          <label className="field">
            Additional context
            <textarea
              value={additional}
              onChange={(e) => setAdditional(e.target.value)}
              maxLength={20000}
              rows={3}
              placeholder="Add business rules, constraints, or acceptance criteria"
              disabled={busy}
            />
          </label>
          <div className="source-heading">
            <span className="eyebrow">
              SELECTED CONTEXT ({project.attachments.length}/5)
            </span>
            <button
              className="text-link"
              type="button"
              disabled={busy || project.attachments.length >= 5}
              onClick={() => fileRef.current?.click()}
            >
              <Plus size={13} />
              Add file
            </button>
          </div>
          {project.attachments.map((file) => (
            <div className="attachment-row" key={file._id}>
              <FileText size={20} />
              <div>
                <strong>{file.fileName}</strong>
                <small>
                  Local file · {(file.size / 1024).toFixed(1)} KB · saved
                  securely
                </small>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Download ${file.fileName}`}
                disabled={busy}
                onClick={() => download(file._id)}
              >
                <Download size={15} />
              </button>
              <button
                type="button"
                className="icon-btn danger"
                aria-label={`Remove ${file.fileName}`}
                disabled={busy}
                onClick={() => remove(file._id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!project.attachments.length && (
            <p className="muted">
              No documents attached. Text requirements work too.
            </p>
          )}
          {project.context.sourceType === "file" &&
            project.context.fileName && (
              <p className="muted">
                Previously imported: {project.context.fileName}
              </p>
            )}
        </section>
        <ErrorNotice message={error} />
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => navigate("/projects")}
          >
            Cancel
          </button>
          <button className="btn primary" disabled={busy || !hasContext}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
      <div className="flow-composer">
        <Composer
          value={additional}
          onChange={setAdditional}
          onSubmit={() => formRef.current?.requestSubmit()}
          onFile={(file) => {
            if (file) void upload(file);
          }}
          onError={setError}
          busy={busy}
          placeholder="What else should the test cases consider?"
          maxLength={20000}
        />
      </div>
    </div>
  );
}
