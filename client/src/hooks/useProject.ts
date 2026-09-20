import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";
import type { Project } from "../types/project";
export function useProject(id?: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get<{ project: Project }>(
          `/projects/${id}`,
          { signal: controller.signal },
        );
        setProject(response.data.project);
      } catch (e) {
        if (!controller.signal.aborted) setError(errorMessage(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    if (id) void load();
    return () => controller.abort();
  }, [id, revision]);
  return { project, setProject, loading, error, reload };
}
