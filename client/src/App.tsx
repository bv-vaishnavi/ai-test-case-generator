import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { Loading } from "./components/UI";
import { hasValidSession } from "./lib/session";
const AuthPage = lazy(() => import("./pages/LoginPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ContextPage = lazy(() => import("./pages/ContextPage"));
const DesignPage = lazy(() => import("./pages/DesignPage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route
            path="/"
            element={
              <Navigate
                to={hasValidSession() ? "/home" : "/login"}
                replace
              />
            }
          />
          {["login", "signup"].map(
            (path) => (
              <Route
                key={path}
                path={`/${path}`}
                element={<AuthPage key={path} />}
              />
            ),
          )}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route
                path="/projects/:projectId/context"
                element={<ContextPage />}
              />
              <Route
                path="/projects/:projectId/design"
                element={<DesignPage />}
              />
              <Route
                path="/projects/:projectId/results"
                element={<ResultsPage />}
              />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <div className="page-state">
                <h1>Page not found</h1>
                <a className="btn" href="/">
                  Go to your workspace
                </a>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
