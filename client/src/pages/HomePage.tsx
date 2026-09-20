import { useState, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api, { errorMessage } from "../services/api";
import Composer from "../components/Composer";
import { ErrorNotice, Notice, Orb } from "../components/UI";
export default function HomePage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let id = createdId;
      if (!id) {
        const r = await api.post("/projects", {
          name: name.trim(),
          description: prompt.trim(),
        });
        id = r.data.project._id;
        setCreatedId(id);
      }
      if (file) {
        const form = new FormData();
        form.append("file", file);
        await api.post(`/projects/${id}/context/file`, form);
      }
      navigate(`/projects/${id}/context`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`home-page ${naming ? "naming-page" : ""}`}>
      {!naming ? (
        <div className="welcome">
          <Orb large />
          <h1>
            Welcome to the world of Test Case Generation.
            <br />
            What would you like to do today?
          </h1>
          <p className="welcome-description">
            Start with a user story, a feature, or a requirements document.
          </p>
          <Composer
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => {
              setError("");
              setNaming(true);
            }}
            file={file}
            onFile={setFile}
            onError={setError}
          />
          <ErrorNotice message={error} />
          <div className="welcome-examples">
            <span>Try a requirement</span>
            {[
              "User login with email and password",
              "Shopping cart and checkout",
              "Password reset by email",
            ].map((example) => (
              <button key={example} onClick={() => setPrompt(example)}>
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flow-column naming-content">
            <Notice>
              I'm creating a new project for testcase generation. Please enter a
              name for your project.
            </Notice>
            <form ref={formRef} className="name-form" onSubmit={create}>
              <label className="sr-only" htmlFor="project-name">
                Project name
              </label>
              <input
                id="project-name"
                placeholder="Enter Project Name"
                autoFocus
                required
                maxLength={100}
                value={name}
                disabled={busy || !!createdId}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="btn primary" disabled={busy || !name.trim()}>
                {busy ? "Creating…" : createdId ? "Retry upload" : "Continue"}
              </button>
            </form>
            <ErrorNotice message={error} />
            {createdId && error && (
              <button
                className="text-link"
                onClick={() => navigate(`/projects/${createdId}/context`)}
              >
                Continue to project and add context there
              </button>
            )}
            <button
              className="text-link"
              disabled={busy || !!createdId}
              onClick={() => {
                setNaming(false);
                setError("");
              }}
            >
              Back to requirement
            </button>
          </div>
          <div className="bottom-composer">
            <Composer
              value={prompt}
              onChange={setPrompt}
              onSubmit={() => formRef.current?.requestSubmit()}
              file={file}
              onFile={setFile}
              onError={setError}
              busy={busy || !!createdId}
            />
          </div>
        </>
      )}
    </div>
  );
}
