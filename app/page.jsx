"use client";

import { useEffect, useMemo, useState } from "react";

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
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

function StatusPill({ status }) {
  return (
    <div className={`status-pill ${status.mode}`}>
      <span className="dot" />
      <strong>{status.text}</strong>
    </div>
  );
}

function PortRow({ item }) {
  return (
    <article className="port-row">
      <div className="port-number">{item.port}</div>
      <div className="port-main">
        <strong>{item.service}</strong>
        <div className="port-meta">
          <span>{item.latencyMs} ms</span>
          {item.title && (
            <span className="port-title" title={item.title}>
              {item.title}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function tagList(items, type, prefix) {
  if (!items.length) return <span className="tag open">{prefix} none</span>;
  return items.map((port) => (
    <span className={`tag ${type}`} key={`${type}-${port}`}>
      {prefix} {port}
    </span>
  ));
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
      setError("Incorrect password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <h1>Port Ledger</h1>
        <p className="subtitle">Enter password to access scan results and history.</p>
        <form onSubmit={handleSubmit}>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Authenticating..." : "Access System"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  const [authenticated, setAuthenticated] = useState(null);
  const [target, setTarget] = useState("");
  const [ports, setPorts] = useState("");
  const [currentScan, setCurrentScan] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState({ text: "Ready", mode: "ready" });
  const [isScanning, setIsScanning] = useState(false);
  const [scanMeta, setScanMeta] = useState("");

  const currentOpenCount = useMemo(() => {
    return currentScan?.open?.length || 0;
  }, [currentScan]);

  const isFullScan = useMemo(() => {
    return !ports.trim();
  }, [ports]);

  async function checkAuth() {
    try {
      const payload = await requestJson("/api/auth");
      setAuthenticated(payload.authenticated);
      if (payload.authenticated) {
        await loadHistory();
      }
    } catch {
      setAuthenticated(false);
    }
  }

  async function loadHistory() {
    const payload = await requestJson("/api/history");
    setHistory(payload.history);
    setCurrentScan((existing) => existing || payload.history[0] || null);
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function submitScan(event) {
    event.preventDefault();
    setIsScanning(true);
    setStatus({ text: "Scanning", mode: "busy" });
    setScanMeta(isFullScan ? "Scanning all 65,535 TCP ports" : "Scanning selected ports");

    try {
      const payload = await requestJson("/api/scan", {
        method: "POST",
        body: JSON.stringify({ target, ports })
      });
      setCurrentScan(payload.scan);
      await loadHistory();
      setStatus({ text: "Ready", mode: "ready" });
    } catch (error) {
      setStatus({ text: error.message, mode: "error" });
    } finally {
      setIsScanning(false);
      setScanMeta("");
    }
  }

  async function logout() {
    try {
      await requestJson("/api/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setAuthenticated(false);
    setHistory([]);
    setCurrentScan(null);
  }

  if (authenticated === null) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <p className="subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onLogin={() => { setAuthenticated(true); loadHistory(); }} />;
  }

  return (
    <main className="shell">
      <section className="hero">
        <h1>Port Ledger</h1>
        <div className="hero-actions">
          <StatusPill status={status} />
          <button className="btn-logout" onClick={logout} type="button">
            Log out
          </button>
        </div>
      </section>

      <section className="scan-panel" aria-label="Scan controls">
        <form className="scan-form" onSubmit={submitScan}>
          <label>
            <span>Target host</span>
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="192.168.1.1"
              required
              autoComplete="off"
            />
          </label>
          <label>
            <span>Port range</span>
            <input
              value={ports}
              onChange={(event) => setPorts(event.target.value)}
              placeholder="Leave empty to scan all 1–65535"
            />
          </label>
          <button type="submit" disabled={isScanning}>
            {isScanning ? "Scanning..." : "Scan"}
          </button>
        </form>
        {scanMeta && <div className="scan-meta">{scanMeta}</div>}
      </section>

      <section className="dashboard">
        <div className="current-area">
          <div className="section-heading">
            <h2>{currentScan?.target || "No scan yet"}</h2>
            <p>
              {currentScan
                ? `${currentOpenCount} open ports of ${currentScan.scannedPorts} scanned — ${formatTime(currentScan.finishedAt)}`
                : "Run a scan to display open ports."}
            </p>
          </div>

          <div className="terminal">
            <div className="terminal-header">
              <span className="term-dot red" />
              <span className="term-dot amber" />
              <span className="term-dot green" />
              <span>Results — {currentScan?.target || "Awaiting target"}</span>
            </div>
            <div className="terminal-body">
              {isScanning && (
                <div className="scanning-state">
                  <p>Scanning in progress...</p>
                </div>
              )}

              {!isScanning && !currentScan && (
                <div className="empty-state">
                  <strong>Waiting for target.</strong>
                  <span>Enter a hostname or IP and run a scan.</span>
                </div>
              )}

              {!isScanning && currentScan?.open?.length === 0 && (
                <div className="empty-state">
                  <strong>No open ports detected.</strong>
                  <span>The target responded closed on every probed port.</span>
                </div>
              )}

              <div className="port-list">
                {!isScanning &&
                  currentScan?.open?.map((item) => (
                    <PortRow key={`${currentScan.id}-${item.port}`} item={item} />
                  ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="history-area">
          <div className="section-heading compact">
            <h2>History</h2>
          </div>
          <div className="history-list">
            {!history.length && (
              <div className="empty-state">
                <strong>No history yet.</strong>
                <span>Each scan is saved with port diffs.</span>
              </div>
            )}
            {history.map((entry) => (
              <article
                className={`history-item ${entry.id === currentScan?.id ? "active" : ""}`}
                key={entry.id}
                onClick={() => setCurrentScan(entry)}
              >
                <header>
                  <strong>{entry.target}</strong>
                  <time>{formatTime(entry.finishedAt)}</time>
                </header>
                <div className="change-row">{tagList(entry.diff.added, "added", "+")}</div>
                <div className="change-row">{tagList(entry.diff.removed, "removed", "-")}</div>
                <div className="change-row">{tagList(entry.openPorts, "open", "open")}</div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
