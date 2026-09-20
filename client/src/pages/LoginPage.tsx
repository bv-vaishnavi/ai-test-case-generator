import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import api, { errorMessage } from "../services/api";
import { saveSession } from "../lib/session";
import { ErrorNotice, Orb } from "../components/UI";

export default function LoginPage() {
  const signup = useLocation().pathname === "/signup";
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (signup && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (signup && new TextEncoder().encode(password).length > 72) {
      setError("Password must be at most 72 UTF-8 bytes.");
      return;
    }
    setBusy(true);
    try {
      const r = await api.post(`/auth/${signup ? "register" : "login"}`, {
        name,
        email,
        password,
      });
      saveSession(r.data);
      navigate("/home", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <Link className="wordmark" to="/">
        FT <i>/</i> MELO
      </Link>
      <div className="auth-card">
        <Orb large />
        <h1>{signup ? "Create your account" : "Welcome back"}</h1>
        <p>Turn your requirements into thoughtful, comprehensive tests.</p>
        <form onSubmit={submit} className="form-stack">
          {signup && (
            <label>
              Your name
              <input
                autoComplete="name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={visible ? "text" : "password"}
                aria-label="Password"
                autoComplete={signup ? "new-password" : "current-password"}
                required
                minLength={signup ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {signup && (
              <small>At least 8 characters; at most 72 UTF-8 bytes.</small>
            )}
          </label>
          {signup && (
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}
          <ErrorNotice message={error} />
          <button className="btn primary" disabled={busy}>
            {busy ? "Please wait..." : signup ? "Create account" : "Sign in"}
            <ArrowRight size={15} />
          </button>
        </form>
        <p className="auth-switch">
          {signup ? (
            <Link to="/login">Back to sign in</Link>
          ) : (
            <>
              New to MELO? <Link to="/signup">Create an account</Link>
            </>
          )}
        </p>
      </div>
      <p className="auth-footnote">
        AI-assisted testing. Human-reviewed quality.
      </p>
    </div>
  );
}
