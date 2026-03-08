"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RunStatus = "running" | "passed" | "failed" | "error";

type TestSpecInfo = {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
};

type ArtifactInfo = {
  relativePath: string;
  name: string;
  kind: "image" | "video" | "text" | "json" | "zip" | "html" | "other";
  size: number;
  updatedAt: string;
};

type RunSummary = {
  runId: string;
  specPath: string | null;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  command: string;
  pid: number | null;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    timedOut: number;
  } | null;
};

type RunDetails = RunSummary & {
  logTail: string;
  artifacts: ArtifactInfo[];
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value: string | null): string => {
  if (!value) return "";
  return new Date(value).toLocaleString();
};

const statusColor = (status: RunStatus): string => {
  if (status === "passed") return "#15803d";
  if (status === "failed") return "#b91c1c";
  if (status === "running") return "#b45309";
  return "#475569";
};

export function TestRunnerWorkbench() {
  const [specs, setSpecs] = useState<TestSpecInfo[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedSpec, setSelectedSpec] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [runFilter, setRunFilter] = useState("");
  const [specContent, setSpecContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [runDetails, setRunDetails] = useState<RunDetails | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState("");
  const [artifactText, setArtifactText] = useState("");
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [clearMessage, setClearMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<number | null>(null);

  const filteredSpecs = useMemo(() => {
    return specs.filter((spec) => spec.name.toLowerCase().includes(specFilter.toLowerCase()) || spec.path.toLowerCase().includes(specFilter.toLowerCase()));
  }, [specs, specFilter]);

  const filteredRuns = useMemo(() => {
    const lower = runFilter.toLowerCase();
    return runs.filter((run) => (run.specPath ?? "full suite").toLowerCase().includes(lower) || run.status.toLowerCase().includes(lower));
  }, [runs, runFilter]);

  const selectedRun = useMemo(() => runs.find((run) => run.runId === selectedRunId) ?? null, [runs, selectedRunId]);
  const dirty = selectedSpec && specContent !== savedContent;
  const artifacts = runDetails?.artifacts ?? [];
  const selectedArtifactInfo = artifacts.find((item) => item.relativePath === selectedArtifact) ?? null;
  const artifactUrl = selectedRunId && selectedArtifact
    ? `/api/dev/test-runner/artifact?runId=${encodeURIComponent(selectedRunId)}&path=${encodeURIComponent(selectedArtifact)}`
    : "";

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/dev/test-runner", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Unable to load tests");
    setSpecs(data.specs ?? []);
    setRuns(data.runs ?? []);
    if (!selectedSpec && data.specs?.length) setSelectedSpec(data.specs[0].path);
    if (!selectedRunId && data.runs?.length) setSelectedRunId(data.runs[0].runId);
  }, [selectedSpec, selectedRunId]);

  const loadSpec = useCallback(async (path: string) => {
    const res = await fetch(`/api/dev/test-runner/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Unable to load file");
    setSpecContent(data.content ?? "");
    setSavedContent(data.content ?? "");
  }, []);

  const loadRun = useCallback(async (runId: string) => {
    const res = await fetch(`/api/dev/test-runner/run?runId=${encodeURIComponent(runId)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Unable to load run");
    setRunDetails(data);
    const nextArtifacts = data.artifacts ?? [];
    if (!selectedArtifact && nextArtifacts.length) setSelectedArtifact(nextArtifacts[0].relativePath);
  }, [selectedArtifact]);

  const loadArtifactPreview = useCallback(async (runId: string, artifactPath: string) => {
    const artifact = (runDetails?.artifacts ?? []).find((item) => item.relativePath === artifactPath);
    if (!artifact || !["text", "json"].includes(artifact.kind)) {
      setArtifactText("");
      return;
    }
    const res = await fetch(`/api/dev/test-runner/artifact?runId=${encodeURIComponent(runId)}&path=${encodeURIComponent(artifactPath)}`, { cache: "no-store" });
    setArtifactText(await res.text());
  }, [runDetails?.artifacts]);

  const saveSpec = useCallback(async () => {
    if (!selectedSpec || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/dev/test-runner/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedSpec, content: specContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to save file");
      setSavedContent(specContent);
      setMessage(`Saved ${selectedSpec}`);
      await loadOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save file");
    } finally {
      setBusy(false);
    }
  }, [selectedSpec, specContent, busy, loadOverview]);

  const runSelected = useCallback(async (specPath: string | null) => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/dev/test-runner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to start run");
      setSelectedRunId(data.runId);
      setRunDetails(data);
      setSelectedArtifact("");
      await loadOverview();
      await loadRun(data.runId);
      setMessage(specPath ? `Started ${specPath}` : "Started full suite");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start run");
    } finally {
      setBusy(false);
    }
  }, [loadOverview, loadRun]);


  const deleteRuns = useCallback(async (runId?: string) => {
    if (busy) return;
    const label = runId ? "Delete this run?" : "Clear all runs?";
    if (!window.confirm(label)) return;
    setBusy(true);
    setMessage("");
    setClearMessage("");
    try {
      const query = runId ? `?runId=${encodeURIComponent(runId)}` : "";
      const res = await fetch(`/api/dev/test-runner${query}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to delete run");
      setClearMessage(runId ? "Run deleted" : "All runs cleared");
      await loadOverview();
      if (runId && runId === selectedRunId) {
        setSelectedRunId("");
        setRunDetails(null);
        setSelectedArtifact("");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete run");
    } finally {
      setBusy(false);
    }
  }, [busy, loadOverview, selectedRunId]);


  async function copyLog() {
    if (!logContent) return;
    try {
      await navigator.clipboard.writeText(logContent);
      setCopyMessage("Copied");
      window.setTimeout(() => setCopyMessage(""), 1500);
    } catch {
      setCopyMessage("Copy failed");
      window.setTimeout(() => setCopyMessage(""), 2000);
    }
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadOverview();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load tests");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedSpec) return;
    void loadSpec(selectedSpec).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load file"));
  }, [selectedSpec, loadSpec]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetails(null);
      setSelectedArtifact("");
      return;
    }
    void loadRun(selectedRunId).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load run"));
  }, [selectedRunId, loadRun]);

  useEffect(() => {
    if (!selectedRunId || !selectedArtifact) {
      setArtifactText("");
      return;
    }
    void loadArtifactPreview(selectedRunId, selectedArtifact);
  }, [selectedRunId, selectedArtifact, loadArtifactPreview]);

  useEffect(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (runDetails?.status !== "running") return;
    pollingRef.current = window.setInterval(() => {
      void loadOverview();
      if (selectedRunId) {
        void loadRun(selectedRunId);
      }
    }, 2000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [runDetails?.status, selectedRunId, loadOverview, loadRun]);

  const logContent = runDetails?.logTail ?? "";
  const runSummary = runDetails?.summary;
  const specMetadata = specs.find((spec) => spec.path === selectedSpec);
  const runPick = runDetails?.specPath ?? selectedRun?.specPath ?? "Full suite";
  const selectedSummary = runDetails ? runDetails.summary : selectedRun?.summary ?? null;

  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "320px 1fr 440px", background: "#f8fafc", color: "#0f172a" }}>
      <aside style={{ borderRight: "1px solid #e5e7eb", background: "#ffffff", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6b7280" }}>Playwright</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Test Runner</div>
          <button onClick={() => void (async () => { setLoading(true); await loadOverview(); setLoading(false); })()} disabled={busy} style={{ marginTop: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>Refresh</button>
        </header>

        <section style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>Specs</div>
          <input value={specFilter} onChange={(event) => setSpecFilter(event.target.value)} placeholder="Filter specs" style={{ width: "100%", padding: "6px 10px", marginBottom: 12, borderRadius: 8, border: "1px solid #d1d5db", background: "#f8fafc" }} />
          <div style={{ display: "grid", gap: 6, maxHeight: "240px", overflowY: "auto" }}>
            {filteredSpecs.map((spec) => (
              <button key={spec.path} onClick={() => setSelectedSpec(spec.path)} style={{ textAlign: "left", padding: 10, borderRadius: 10, border: selectedSpec === spec.path ? "1px solid #2563eb" : "1px solid #e5e7eb", background: selectedSpec === spec.path ? "#eff6ff" : "#ffffff", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spec.name}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{spec.path}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{formatBytes(spec.size)}</div>
              </button>
            ))}
            {!filteredSpecs.length && !loading && <div style={{ fontSize: 13, color: "#6b7280" }}>No specs found.</div>}
          </div>
        </section>

        <section style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6b7280" }}>Runs</div><button onClick={() => void deleteRuns()} disabled={busy} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#ffffff", cursor: busy ? "not-allowed" : "pointer" }}>Clear</button></div>
          <input value={runFilter} onChange={(event) => setRunFilter(event.target.value)} placeholder="Filter runs" style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f8fafc" }} />
          <div style={{ display: "grid", gap: 6, flex: 1, overflowY: "auto" }}>
            {filteredRuns.map((run) => (
              <button key={run.runId} onClick={() => setSelectedRunId(run.runId)} style={{ textAlign: "left", padding: 10, borderRadius: 10, border: selectedRunId === run.runId ? `1px solid ${statusColor(run.status)}` : "1px solid #e5e7eb", background: selectedRunId === run.runId ? "#fefce8" : "#ffffff", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.specPath ?? "Full suite"}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: statusColor(run.status), textTransform: "uppercase" }}>{run.status}</div>
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{formatDate(run.startedAt)}</div>
                {run.summary && (
                  <div style={{ fontSize: 11, color: "#475569" }}>Total: {run.summary.total}, Passed: {run.summary.passed}, Failed: {run.summary.failed}</div>
                )}
              </button>
            ))}
            {!filteredRuns.length && !loading && <div style={{ fontSize: 13, color: "#6b7280" }}>No runs yet.</div>}
          </div>
        </section>
      </aside>

      <main style={{ display: "flex", flexDirection: "column", minWidth: 0, borderRight: "1px solid #e5e7eb" }}>
        <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb", background: "#ffffff", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedSpec || "Select a spec"}</div>
            {specMetadata && <div style={{ fontSize: 12, color: "#6b7280" }}>{formatDate(specMetadata.modifiedAt)}</div>}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => void runSelected(selectedSpec || null)} disabled={!selectedSpec || busy} style={buttonStyle("#2563eb", "#ffffff", busy)}>Run Spec</button>
            <button onClick={() => void runSelected(null)} disabled={busy} style={buttonStyle("#0f766e", "#ffffff", busy)}>Run All</button>
            <button onClick={() => void saveSpec()} disabled={!dirty || busy} style={buttonStyle("#475569", "#ffffff", busy)}>Save</button>
            <button onClick={() => void runSelected(runDetails?.specPath ?? null)} disabled={!runDetails || busy} style={buttonStyle("#2563eb", "#ffffff", busy)}>Re-run Last</button>
          </div>
        </header>

        <textarea
          value={specContent}
          onChange={(event) => setSpecContent(event.target.value)}
          spellCheck={false}
          style={{ flex: 1, padding: 16, border: 0, resize: "none", outline: "none", background: "#0f172a", color: "#e5e7eb", fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", lineHeight: 1.5 }}
        />

        <footer style={{ padding: 12, borderTop: "1px solid #e5e7eb", background: "#ffffff", fontSize: 12, color: dirty ? "#b45309" : "#6b7280" }}>
          {dirty ? "Unsaved changes" : "Saved"}
          {message ? ` • ${message}` : ""}
        </footer>
      </main>

      <aside style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, background: "#ffffff" }}>
        <header style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Run Details</div>
          {runDetails && (
            <div style={{ padding: "4px 10px", borderRadius: 999, background: `${statusColor(runDetails.status)}22`, color: statusColor(runDetails.status), fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{runDetails.status}</div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {clearMessage && <div style={{ fontSize: 12, color: "#0f766e" }}>{clearMessage}</div>}
            <button onClick={() => void deleteRuns(selectedRunId)} disabled={!selectedRunId || busy} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#ffffff", cursor: selectedRunId && !busy ? "pointer" : "not-allowed" }}>Delete</button>
          </div>
        </header>

        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Command</div>
          <div style={{ fontSize: 11, color: "#475569", wordBreak: "break-all" }}>{runDetails?.command || "—"}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{runPick}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{runDetails ? `${formatDate(runDetails.startedAt)}${runDetails.finishedAt ? ` → ${formatDate(runDetails.finishedAt)}` : ""}` : ""}</div>
          {selectedSummary && (
            <div style={{ fontSize: 12, color: "#0f172a" }}>Total: {selectedSummary.total}, Passed: {selectedSummary.passed}, Failed: {selectedSummary.failed}, Skipped: {selectedSummary.skipped}, TimedOut: {selectedSummary.timedOut}</div>
          )}
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{ width: 220, borderRight: "1px solid #e5e7eb", overflow: "auto", background: "#f8fafc" }}>
            <div style={{ padding: 16, fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6b7280" }}>Artifacts</div>
            <div style={{ display: "grid", gap: 6, padding: "0 12px 12px" }}>
              {artifacts.map((artifact) => (
                <button key={artifact.relativePath} onClick={() => setSelectedArtifact(artifact.relativePath)} style={{ textAlign: "left", padding: 8, borderRadius: 8, border: selectedArtifact === artifact.relativePath ? "1px solid #2563eb" : "1px solid #e5e7eb", background: selectedArtifact === artifact.relativePath ? "#eff6ff" : "#ffffff", cursor: "pointer" }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{artifact.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{artifact.relativePath}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{formatBytes(artifact.size)}</div>
                </button>
              ))}
              {!artifacts.length && <div style={{ fontSize: 13, color: "#6b7280" }}>No artifacts yet.</div>}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", background: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedArtifactInfo?.relativePath || "Log"}</div>
              <div style={{ flex: 1 }} />
              {copyMessage && <div style={{ fontSize: 12, color: "#0f766e" }}>{copyMessage}</div>}
              <button onClick={() => void copyLog()} disabled={!logContent} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: logContent ? "pointer" : "not-allowed" }}>Copy</button>
              {artifactUrl && (<a href={artifactUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#2563eb" }}>Open raw</a>)}
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: 16, overflow: "auto", background: "#0f172a", color: "#e2e8f0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}>
              {selectedArtifactInfo?.kind === "image" && artifactUrl ? (
                <a href={artifactUrl} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", cursor: "zoom-in" }}>
                  <img src={artifactUrl} alt={selectedArtifactInfo.name} style={{ maxWidth: "100%", borderRadius: 12 }} />
                </a>
              ) : selectedArtifactInfo?.kind === "video" && artifactUrl ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <video src={artifactUrl} controls style={{ width: "100%", borderRadius: 12 }} />
                  <a href={artifactUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#93c5fd" }}>Open video in new tab</a>
                </div>
              ) : selectedArtifactInfo && ["text", "json"].includes(selectedArtifactInfo.kind) ? (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{artifactText}</pre>
              ) : selectedArtifactInfo ? (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>No preview available. Use <em>Open raw</em>.</div>
              ) : (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{logContent || "Cleared"}</pre>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function buttonStyle(bg: string, fg: string, disabled: boolean) {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid transparent",
    background: bg,
    color: fg,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}
