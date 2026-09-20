import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, FolderOpen, Plus } from "lucide-react";
import api, { errorMessage } from "../services/api";
import { ErrorNotice, Loading } from "../components/UI";
import type { Project } from "../types/project";
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const r = await api.get("/projects", {
          params: { page },
          signal: controller.signal,
        });
        setProjects(r.data.projects);
        setPages(r.data.pages);
      } catch (e) {
        if (!controller.signal.aborted) setError(errorMessage(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page, retry]);
  return (
    <div className="projects-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>Projects</h1>
          <p>Pick up where you left off.</p>
        </div>
        <Link className="btn primary" to="/home">
          <Plus size={16} />
          New project
        </Link>
      </header>
      <ErrorNotice message={error} />
      {error && (
        <button className="btn" onClick={() => setRetry((v) => v + 1)}>
          Try again
        </button>
      )}
      {loading ? (
        <Loading />
      ) : !error && !projects.length ? (
        <div className="empty-state">
          <FolderOpen size={35} />
          <h2>Your next idea starts here</h2>
          <p>Create a project to turn requirements into test cases.</p>
          <Link className="btn primary" to="/home">
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <Link
              className="project-card"
              to={`/projects/${p._id}/${["generated", "completed", "generating"].includes(p.status) ? "results" : p.status === "configured" ? "design" : "context"}`}
              key={p._id}
            >
              <div className="flex items-center justify-between">
                <FolderOpen size={20} />
                <ArrowUpRight size={17} />
              </div>
              <h2>{p.name}</h2>
              <span
                className={`badge ${p.status === "completed" ? "approved" : ""}`}
              >
                {p.status.replaceAll("_", " ")}
              </span>
              <small>
                Updated {new Date(p.updatedAt).toLocaleDateString()}
              </small>
            </Link>
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="pagination">
          <button
            className="btn"
            disabled={page === 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            className="btn"
            disabled={page === pages || loading}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
