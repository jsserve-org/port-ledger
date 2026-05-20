"use client";

import { useEffect, useState } from "react";

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await requestJson("/api/unlock", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      onLogin();
    } catch {
      setError("Wrong password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Port Ledger</h1>
        <p>Password required</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            required
          />
          {error && <span className="login-error">{error}</span>}
          <button type="submit" disabled={loading}>
            {loading ? "..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  const [authenticated, setAuthenticated] = useState(null);
  const [currentScan, setCurrentScan] = useState(null);
  const [history, setHistory] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  async function checkAuth() {
    try {
      const payload = await requestJson("/api/auth");
      setAuthenticated(payload.authenticated);
      if (payload.authenticated) await loadData();
    } catch {
      setAuthenticated(false);
    }
  }

  async function loadData() {
    const payload = await requestJson("/api/history");
    setHistory(payload.history);
    setCurrentScan(payload.history[0] || null);
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function refresh() {
    setScanning(true);
    setError("");
    try {
      await requestJson("/api/scan", { method: "POST" });
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  async function logout() {
    try {
      await requestJson("/api/logout", { method: "POST" });
    } catch {}
    setAuthenticated(false);
    setHistory([]);
    setCurrentScan(null);
  }

  if (authenticated === null) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onLogin={() => { setAuthenticated(true); loadData(); }} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo">Port Ledger</span>
          <span className="divider">/</span>
          <span className="target">{currentScan?.target || "—"}</span>
        </div>
        <div className="topbar-right">
          <button className="btn-refresh" onClick={refresh} disabled={scanning} type="button">
            {scanning ? "Scanning..." : "Refresh"}
          </button>
          <button className="btn-logout" onClick={logout} type="button">
            Log out
          </button>
        </div>
      </header>

      {error && <div className="banner-error">{error}</div>}

      <main className="main">
        <section className="results">
          <div className="results-header">
            <h2>
              {currentScan
                ? `${currentScan.open.length} open ports`
                : "No scan data"}
            </h2>
            {currentScan && (
              <span className="meta">
                {currentScan.scannedPorts.toLocaleString()} scanned — {formatTime(currentScan.finishedAt)}
              </span>
            )}
          </div>

          {!currentScan && (
            <div className="empty">
              <p>Press Refresh to scan.</p>
            </div>
          )}

          {currentScan && currentScan.open.length === 0 && (
            <div className="empty">
              <p>No open ports found.</p>
            </div>
          )}

          {currentScan && currentScan.open.length > 0 && (
            <div className="table-wrap">
              <table className="port-table">
                <thead>
                  <tr>
                    <th>Port</th>
                    <th>Service</th>
                    <th>Latency</th>
                    <th>Title</th>
                  </tr>
                </thead>
                <tbody>
                  {currentScan.open.map((item) => (
                    <tr key={item.port}>
                      <td className="col-port">{item.port}</td>
                      <td className="col-service">{item.service}</td>
                      <td className="col-latency">{item.latencyMs} ms</td>
                      <td className="col-title">{item.title || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="sidebar">
          <h3>History</h3>
          <div className="history-list">
            {!history.length && <p className="empty-text">No scans yet.</p>}
            {history.map((entry) => (
              <div
                className={`history-item ${entry.id === currentScan?.id ? "active" : ""}`}
                key={entry.id}
                onClick={() => setCurrentScan(entry)}
              >
                <div className="history-top">
                  <span className="history-target">{entry.target}</span>
                  <span className="history-time">{formatTime(entry.finishedAt)}</span>
                </div>
                <div className="history-ports">
                  {entry.openPorts.slice(0, 8).map((p) => (
                    <span className="history-chip" key={p}>{p}</span>
                  ))}
                  {entry.openPorts.length > 8 && (
                    <span className="history-chip more">+{entry.openPorts.length - 8}</span>
                  )}
                </div>
                {(entry.diff.added.length > 0 || entry.diff.removed.length > 0) && (
                  <div className="history-diff">
                    {entry.diff.added.length > 0 && (
                      <span className="diff-added">+{entry.diff.added.length}</span>
                    )}
                    {entry.diff.removed.length > 0 && (
                      <span className="diff-removed">-{entry.diff.removed.length}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
