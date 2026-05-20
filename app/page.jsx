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
      <span />
      <strong>{status.text}</strong>
    </div>
  );
}

function PortRow({ scanId, item, onProtect, onUnlock }) {
  const isProtected = item.protected;

  return (
    <article className={`port-row ${isProtected ? "locked" : ""}`}>
      <div className="port-number">{isProtected ? "..." : item.port}</div>
      <div className="port-main">
        <strong>{isProtected ? "Protected port" : item.service}</strong>
        <span>
          {isProtected
            ? "Server redacted this row until the password is verified"
            : `Open TCP port - ${item.latencyMs} ms response`}
        </span>
      </div>
      <button
        className={`row-switch ${isProtected ? "off" : "on"}`}
        type="button"
        aria-pressed={!isProtected}
        title={isProtected ? "Enter password to display this port" : "Protect this row on the server"}
        onClick={() => {
          if (isProtected) onUnlock();
          else onProtect(scanId, item.port);
        }}
      >
        <span className="track">
          <span className="thumb" />
        </span>
      </button>
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

export default function Page() {
  const [target, setTarget] = useState("");
  const [ports, setPorts] = useState("");
  const [currentScan, setCurrentScan] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState({ text: "Ready", mode: "ready" });
  const [isScanning, setIsScanning] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [password, setPassword] = useState("");

  const currentOpenCount = useMemo(() => {
    return currentScan?.open?.filter((item) => !item.protected).length || 0;
  }, [currentScan]);

  async function loadHistory() {
    const payload = await requestJson("/api/history");
    setHistory(payload.history);
    setCurrentScan((existing) => existing || payload.history[0] || null);
  }

  useEffect(() => {
    loadHistory().catch((error) => setStatus({ text: error.message, mode: "error" }));
  }, []);

  async function submitScan(event) {
    event.preventDefault();
    setIsScanning(true);
    setStatus({ text: "Scanning", mode: "busy" });

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
    }
  }

  async function protectPort(scanId, port) {
    try {
      const payload = await requestJson("/api/protect-port", {
        method: "POST",
        body: JSON.stringify({ scanId, port })
      });
      setCurrentScan(payload.scan);
      await loadHistory();
      setStatus({ text: "Protected", mode: "ready" });
    } catch (error) {
      setStatus({ text: error.message, mode: "error" });
    }
  }

  async function unlock(event) {
    event.preventDefault();
    try {
      await requestJson("/api/unlock", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      setPassword("");
      setUnlockOpen(false);
      const payload = await requestJson("/api/history");
      setHistory(payload.history);
      setCurrentScan(payload.history.find((entry) => entry.id === currentScan?.id) || payload.history[0] || null);
      setStatus({ text: "Unlocked", mode: "ready" });
    } catch (error) {
      setStatus({ text: "Wrong password", mode: "error" });
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">TCP exposure monitor</p>
          <h1>Port Ledger</h1>
        </div>
        <StatusPill status={status} />
      </section>

      <section className="scan-panel" aria-label="Scan controls">
        <form className="scan-form" onSubmit={submitScan}>
          <label>
            <span>IP or hostname</span>
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="127.0.0.1"
              required
              autoComplete="off"
            />
          </label>
          <label>
            <span>Ports</span>
            <input
              value={ports}
              onChange={(event) => setPorts(event.target.value)}
              placeholder="Default common ports, or 22,80,443,8000-8080"
            />
          </label>
          <button type="submit" disabled={isScanning}>
            <span className="button-icon">Scan</span>
            New scan
          </button>
        </form>
      </section>

      <section className="dashboard">
        <div className="current-area">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current result</p>
              <h2>{currentScan?.target || "No scan yet"}</h2>
            </div>
            <p>
              {currentScan
                ? `${currentOpenCount} visible open ports of ${currentScan.scannedPorts} scanned - ${formatTime(currentScan.finishedAt)}`
                : "Run a scan to show open ports."}
            </p>
          </div>

          <div className="port-list">
            {!currentScan && (
              <div className="empty-state">
                <strong>Waiting for a target.</strong>
                <span>The page will display only ports that respond as open.</span>
              </div>
            )}

            {currentScan?.open?.length === 0 && (
              <div className="empty-state">
                <strong>No open ports found.</strong>
                <span>Try a different target or a custom port list if you expected a service.</span>
              </div>
            )}

            {currentScan?.open?.map((item) => (
              <PortRow
                key={`${currentScan.id}-${item.port || item.redactedId}`}
                scanId={currentScan.id}
                item={item}
                onProtect={protectPort}
                onUnlock={() => setUnlockOpen(true)}
              />
            ))}
          </div>
        </div>

        <aside className="history-area">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">History</p>
              <h2>Changes</h2>
            </div>
          </div>
          <div className="history-list">
            {!history.length && (
              <div className="empty-state">
                <strong>No history yet.</strong>
                <span>Each scan records ports added and removed against the previous scan for that target.</span>
              </div>
            )}
            {history.map((entry) => (
              <article className="history-item" key={entry.id} onClick={() => setCurrentScan(entry)}>
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

      {unlockOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="unlock-form" onSubmit={unlock}>
            <h3>Unlock protected rows</h3>
            <p>The server will only return protected port details after the password is verified.</p>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              autoFocus
            />
            <menu>
              <button type="button" onClick={() => setUnlockOpen(false)}>
                Cancel
              </button>
              <button type="submit">Unlock</button>
            </menu>
          </form>
        </div>
      )}
    </main>
  );
}
