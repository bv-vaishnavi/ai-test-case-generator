import { useState, type FormEvent } from "react";
import { Modal, ErrorNotice } from "./UI";
import api, { errorMessage } from "../services/api";
import type { ItemKind, Project, ReviewItem, TestCase } from "../types/project";
export default function ItemEditor({
  item,
  kind,
  projectId,
  onSave,
  onClose,
}: {
  item: ReviewItem;
  kind: ItemKind;
  projectId: string;
  onSave: (project: Project) => void;
  onClose: () => void;
}) {
  const test = item as TestCase;
  const isCase = kind === "testCases";
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || "");
  const [type, setType] = useState(test.type || "positive");
  const [preconditions, setPreconditions] = useState(
    test.preconditions?.join("\n") || "",
  );
  const [steps, setSteps] = useState(test.steps?.join("\n") || "");
  const [expected, setExpected] = useState(test.expectedResult || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const lines = (s: string) =>
      s
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
    try {
      const payload = isCase
        ? {
            title,
            type,
            preconditions: lines(preconditions),
            steps: lines(steps),
            expectedResult: expected,
          }
        : { title, description };
      const r = await api.put(
        `/projects/${projectId}/items/${kind}/${item._id}`,
        payload,
      );
      onSave(r.data.project);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={isCase ? "Edit test case" : "Edit item"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save} className="form-stack">
        <label>
          Title
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {isCase ? (
          <>
            <label>
              Scenario type
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TestCase["type"])}
              >
                {["positive", "negative", "edge", "validation"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Preconditions
              <textarea
                rows={3}
                maxLength={20000}
                value={preconditions}
                onChange={(e) => setPreconditions(e.target.value)}
              />
              <small>One precondition per line.</small>
            </label>
            <label>
              Test steps
              <textarea
                required
                rows={5}
                maxLength={30000}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
              <small>One step per line.</small>
            </label>
            <label>
              Expected result
              <textarea
                required
                rows={3}
                maxLength={4000}
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label>
            Description
            <textarea
              rows={5}
              required
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        )}
        <p className="muted">
          Saving an edit returns this item to pending review.
        </p>
        <ErrorNotice message={error} />
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
