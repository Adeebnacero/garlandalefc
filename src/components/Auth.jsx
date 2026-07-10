import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { T, GLOBAL_CSS } from "../theme.js";
import BADGE_SRC from "../assets/badge.png";

export function LoginView({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
      onLoggedIn();
    } catch (e) {
      setError(e.message || "Could not log in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gfc-app" style={{ alignItems: "center", justifyContent: "center" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: 360, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <img src={BADGE_SRC} alt="Garlandale FC crest" style={{ width: 64, height: 64, margin: "0 auto 10px" }} />
          <div className="gfc-display" style={{ color: T.indigo, fontSize: 20 }}>Garlandale FC</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>Club Management Login</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gfc-field">
            <label className="gfc-label">Email</label>
            <input type="email" className="gfc-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="gfc-field">
            <label className="gfc-label">Password</label>
            <input type="password" className="gfc-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div style={{ color: T.danger, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <button type="submit" className="gfc-btn gfc-btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function AcceptInviteView({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      onDone();
    } catch (e) {
      setError(e.message || "Could not set password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gfc-app" style={{ alignItems: "center", justifyContent: "center" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: 380, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <img src={BADGE_SRC} alt="Garlandale FC crest" style={{ width: 64, height: 64, margin: "0 auto 10px" }} />
          <div className="gfc-display" style={{ color: T.indigo, fontSize: 18 }}>Welcome to Garlandale FC</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>Set a password to finish setting up your account</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gfc-field">
            <label className="gfc-label">New password</label>
            <input type="password" className="gfc-input" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          </div>
          <div className="gfc-field">
            <label className="gfc-label">Confirm password</label>
            <input type="password" className="gfc-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <div style={{ color: T.danger, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <button type="submit" className="gfc-btn gfc-btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
            {busy ? "Saving…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function NoAccessView({ email, onLogout }) {
  return (
    <div className="gfc-app" style={{ alignItems: "center", justifyContent: "center" }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ width: 380, textAlign: "center", padding: 32 }}>
        <div className="gfc-display" style={{ color: T.danger, fontSize: 20, marginBottom: 10 }}>No access assigned</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20 }}>
          {email} is logged in, but doesn't have a role assigned in Garlandale FC yet. Ask an Admin to invite this email address, or check with them if your access may have been removed.
        </div>
        <button className="gfc-btn gfc-btn-outline" onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}
