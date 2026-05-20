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

function PortRow({ scanId, item, onProtect, onUnlock, index }) {
  const isProtected = item.protected;

  return (
    <article
      className={`port-row ${isProtected ? "locked" : "open"}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="port-number">{isProtected ? "···" : item.port}</div>
      <div className="port-main">
        <strong>{isProtected ? "Protected port" : item.service}</strong>
        <div className="port-meta">
          {!isProtected && (
            <>
              <span>{item.latencyMs} ms</span>
              {item.title && (
                <span className="port-title" title={item.title}>
                  {item.title}
                </span>
              )}
            </>
          )}
          {isProtected && (
            <span>Server redacted — verify password to display</span>
          )}
        </div>
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
  const [scanMeta, setScanMeta] = useState("");

  const currentOpenCount = useMemo(() => {
    return currentScan?.open?.filter((item) => !item.protected).length || 0;
  }, [currentScan]);

  const isFullScan = useMemo(() => {
    return !ports.trim();
  }, [ports]);

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
    setScanMeta(isFullScan ? "Scanning all 65,535 TCP ports — this may take 4–8 minutes" : "Scanning selected ports");

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
        <div className="hero-title-group">
          <p className="eyebrow">Network Exposure Monitor</p>
          <h1>PORT LEDGER</h1>
        </div>
        <StatusPill status={status} />
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
            {isScanning ? "Scanning..." : "Execute Scan"}
          </button>
        </form>
        {scanMeta && (
          <div className="scan-meta">{scanMeta}</div>
        )}
      </section>

      <section className="dashboard">
        <div className="current-area">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Live terminal</p>
              <h2>{currentScan?.target || "No scan yet"}</h2>
            </div>
            <p>
              {currentScan
                ? `${currentOpenCount} visible open ports of ${currentScan.scannedPorts} scanned — ${formatTime(currentScan.finishedAt)}`
                : "Run a scan to display open ports."}
            </p>
          </div>

          <div className="terminal">
            <div className="terminal-header">
              <span className="term-dot red" />
              <span className="term-dot amber" />
              <span className="term-dot green" />
              <span>Port Ledger — {currentScan?.target || "Awaiting target"}</span>
            </div>
            <div className="terminal-body">
              {isScanning && (
                <div className="scanning-state">
                  <div className="scan-radar" />
                  <p>PROBING TARGET...</p>
                </div>
              )}

              {!isScanning && !currentScan && (
                <div className="empty-state">
                  <strong>Waiting for target.</strong>
                  <span>Enter a hostname or IP and execute a scan to probe all TCP ports.</span>
                </div>
              )}

              {!isScanning && currentScan?.open?.length === 0 && (
                <div className="empty-state">
                  <strong>No open ports detected.</strong>
                  <span>The target responded closed on every probed port.</span>
                </div>
              )}

              <div className="port-list">
                {!isScanning && currentScan?.open?.map((item, index) => (
                  <PortRow
                    key={`${currentScan.id}-${item.port || item.redactedId}`}
                    scanId={currentScan.id}
                    item={item}
                    onProtect={protectPort}
                    onUnlock={() => setUnlockOpen(true)}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="history-area">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Mission log</p>
              <h2>Scan history</h2>
            </div>
          </div>
          <div className="history-list">
            {!history.length && (
              <div className="empty-state">
                <strong>No history recorded.</strong>
                <span>Each scan is archived with port diffs against previous results for the same target.</span>
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

      {unlockOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setUnlockOpen(false)}>
          <form className="unlock-form" onSubmit={unlock} onClick={(e) => e.stopPropagation()}>
            <h3>Security clearance required</h3>
            <p>Protected port details are redacted server-side. Verify your credentials to decrypt and view classified rows.</p>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
              autoFocus
            />
            <menu>
              <button type="button" onClick={() => setUnlockOpen(false)}>
                Cancel
              </button>
              <button type="submit">Authenticate</button>
            </menu>
          </form>
        </div>
      )}
    </main>
  );
}
