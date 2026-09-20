import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ClipboardList,
  LogOut,
  FolderOpen,
  ChevronDown,
} from "lucide-react";
import api, { errorMessage } from "../services/api";
import { clearSession, currentUser } from "../lib/session";
import { ErrorNotice } from "./UI";
export default function AppLayout() {
  const user = currentUser();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/logout");
      clearSession();
      navigate("/login", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <NavLink to="/home" className="sidebar-logo" aria-label="MELO home">
          <Sparkles size={27} strokeWidth={1.2} />
        </NavLink>
        <nav>
          <NavLink
            to="/home"
            className="rail-link"
            title="Test case generation"
            aria-label="Test case generation"
          >
            <ClipboardList size={18} />
          </NavLink>
          <NavLink
            to="/projects"
            className="rail-link"
            title="Saved projects"
            aria-label="Saved projects"
          >
            <FolderOpen size={18} />
          </NavLink>
        </nav>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <NavLink to="/home" className="wordmark">
            <span>FT</span>
            <i>/</i> MELO
          </NavLink>
          <div className="profile-menu">
            <button
              className="profile-button"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <span className="avatar">
                {user?.name.charAt(0).toUpperCase() || "U"}
              </span>
              <span>{user?.name || "Your account"}</span>
              <ChevronDown size={13} />
            </button>
            {menu && (
              <div className="profile-dropdown">
                <small>{user?.email}</small>
                <button className="btn" onClick={logout} disabled={busy}>
                  <LogOut size={15} />
                  {busy ? "Signing out…" : "Sign out"}
                </button>
                <ErrorNotice message={error} />
              </div>
            )}
          </div>
        </header>
        <main id="main-content" className="workspace">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
