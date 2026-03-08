"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

type RunStatus = "running" | "passed" | "failed" | "error";
type RunTarget = "spec" | "suite" | "last-failed";

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
  target: RunTarget;
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

type DetailTab = "overview" | "artifacts" | "log" | "source";

const STATUS_META: Record<RunStatus, { label: string; fg: string; bg: string; border: string }> = {
  running: { label: "Running", fg: "#9a6700", bg: "#fff7d6", border: "#f4d98b" },
  passed: { label: "Passed", fg: "#166534", bg: "#dcfce7", border: "#86efac" },
  failed: { label: "Failed", fg: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
  error: { label: "Error", fg: "#475569", bg: "#e2e8f0", border: "#cbd5e1" },
};

const SURFACE = "#fbfbf8";
const PANEL = "#fffdf8";
const PANEL_ALT = "#f4efe3";
const INK = "#201a12";
const MUTED = "#746a5d";
const BORDER = "#d8cfc1";
const ACCENT = "#0f766e";
const ACCENT_SOFT = "#d3f0ea";
const FAILURE = "#b42318";
const CODE_BG = "#171717";

const buttonBase: CSSProperties = {
  borderRadius: 999,
  border: `1px solid ${BORDER}`,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  background: PANEL,
  color: INK,
};

const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs < 1000) return durationMs === 0 ? "0s" : "";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function statusMeta(status: RunStatus) {
  return STATUS_META[status] ?? STATUS_META.error;
}

function artifactRank(kind: ArtifactInfo["kind"]): number {
  if (kind === "image") return 0;
  if (kind === "video") return 1;
  if (kind === "json") return 2;
  if (kind === "text") return 3;
  return 4;
}

function describeRunTarget(target: RunTarget, specPath: string | null): string {
  if (target === "last-failed") return "Last failed tests";
  if (target === "suite") return "Full suite";
  return specPath || "Selected spec";
}

function artifactLooksImportant(artifact: ArtifactInfo): boolean {
  const name = artifact.relativePath.toLowerCase();
  return (
    name.includes("test-failed") ||
    name.includes("error-context") ||
    name.includes("video") ||
    name.includes("trace") ||
    name.endsWith("results.json") ||
    name.endsWith("run.log")
  );
}

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
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<number | null>(null);

  const selectedRun = useMemo(() => runs.find((run) => run.runId === selectedRunId) ?? null, [runs, selectedRunId]);
  const selectedSummary = runDetails?.summary ?? selectedRun?.summary ?? null;
  const dirty = !!selectedSpec && specContent !== savedContent;
  const logContent = runDetails?.logTail ?? "";
  const artifacts = runDetails?.artifacts ?? [];

  const filteredSpecs = useMemo(() => {
    const lower = specFilter.trim().toLowerCase();
    if (!lower) return specs;
    return specs.filter((spec) => spec.name.toLowerCase().includes(lower) || spec.path.toLowerCase().includes(lower));
  }, [specFilter, specs]);

  const filteredRuns = useMemo(() => {
    const lower = runFilter.trim().toLowerCase();
    if (!lower) return runs;
    return runs.filter((run) => {
      const target = `${run.specPath ?? "full suite"} ${run.status} ${run.runId}`.toLowerCase();
      return target.includes(lower);
    });
  }, [runFilter, runs]);

  const latestRunBySpec = useMemo(() => {
    const next = new Map<string, RunSummary>();
    for (const run of runs) {
      const key = run.specPath ?? "__full_suite__";
      if (!next.has(key)) next.set(key, run);
    }
    return next;
  }, [runs]);

  const selectedRunArtifacts = useMemo(() => {
    return [...artifacts].sort((a, b) => {
      const important = Number(artifactLooksImportant(b)) - Number(artifactLooksImportant(a));
      if (important !== 0) return important;
      const rank = artifactRank(a.kind) - artifactRank(b.kind);
      if (rank !== 0) return rank;
      return a.relativePath.localeCompare(b.relativePath);
    });
  }, [artifacts]);

  const selectedArtifactInfo = useMemo(() => {
    return selectedRunArtifacts.find((artifact) => artifact.relativePath === selectedArtifact) ?? null;
  }, [selectedArtifact, selectedRunArtifacts]);

  const artifactUrl = selectedRunId && selectedArtifact
    ? `/api/dev/test-runner/artifact?runId=${encodeURIComponent(selectedRunId)}&path=${encodeURIComponent(selectedArtifact)}`
    : "";

  const runTotals = useMemo(() => {
    let running = 0;
    let passed = 0;
    let failed = 0;
    let errored = 0;
    for (const run of runs) {
      if (run.status === "running") running += 1;
      else if (run.status === "passed") passed += 1;
      else if (run.status === "failed") failed += 1;
      else errored += 1;
    }
    return { running, passed, failed, errored };
  }, [runs]);

  const runHeading = runDetails?.specPath ?? selectedRun?.specPath ?? selectedSpec ?? "Full suite";
  const highlightedArtifacts = useMemo(() => selectedRunArtifacts.filter(artifactLooksImportant), [selectedRunArtifacts]);

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
    const nextArtifacts: ArtifactInfo[] = data.artifacts ?? [];
    if (!nextArtifacts.length) {
      setSelectedArtifact("");
      setArtifactText("");
      return;
    }
    setSelectedArtifact((current) => {
      if (current && nextArtifacts.some((artifact) => artifact.relativePath === current)) return current;
      const preferred = nextArtifacts.find(artifactLooksImportant) ?? nextArtifacts[0];
      return preferred.relativePath;
    });
  }, []);

  const loadArtifactPreview = useCallback(async (runId: string, artifactPath: string, artifactKind: ArtifactInfo["kind"]) => {
    if (!["text", "json", "html"].includes(artifactKind)) {
      setArtifactText("");
      return;
    }
    const res = await fetch(`/api/dev/test-runner/artifact?runId=${encodeURIComponent(runId)}&path=${encodeURIComponent(artifactPath)}`, { cache: "no-store" });
    setArtifactText(await res.text());
  }, []);

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
  }, [busy, loadOverview, selectedSpec, specContent]);

  const runSelected = useCallback(async (target: RunTarget, specPath: string | null = null) => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/dev/test-runner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, specPath: target === "spec" ? specPath : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to start run");
      setSelectedRunId(data.runId);
      setDetailTab("overview");
      await loadOverview();
      await loadRun(data.runId);
      setMessage(
        target === "last-failed"
          ? "Started last failed tests"
          : target === "suite"
            ? "Started full suite"
            : `Started ${specPath}`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start run");
    } finally {
      setBusy(false);
    }
  }, [loadOverview, loadRun]);

  const deleteRuns = useCallback(async (runId?: string) => {
    if (busy) return;
    const prompt = runId ? "Delete this run?" : "Clear all runs?";
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setMessage("");
    try {
      const query = runId ? `?runId=${encodeURIComponent(runId)}` : "";
      const res = await fetch(`/api/dev/test-runner${query}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to delete run");
      await loadOverview();
      if (runId && runId === selectedRunId) {
        setSelectedRunId("");
        setRunDetails(null);
        setSelectedArtifact("");
      }
      setMessage(runId ? "Run deleted" : "Run history cleared");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete run");
    } finally {
      setBusy(false);
    }
  }, [busy, loadOverview, selectedRunId]);

  const copyText = useCallback(async (value: string, okMessage: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(okMessage);
      window.setTimeout(() => setCopyMessage(""), 1500);
    } catch {
      setCopyMessage("Copy failed");
      window.setTimeout(() => setCopyMessage(""), 2000);
    }
  }, []);

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
  }, [loadSpec, selectedSpec]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetails(null);
      setSelectedArtifact("");
      return;
    }
    void loadRun(selectedRunId).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load run"));
  }, [loadRun, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId || !selectedArtifactInfo) {
      setArtifactText("");
      return;
    }
    void loadArtifactPreview(selectedRunId, selectedArtifactInfo.relativePath, selectedArtifactInfo.kind);
  }, [loadArtifactPreview, selectedArtifactInfo, selectedRunId]);

  useEffect(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (runDetails?.status !== "running") return;
    pollingRef.current = window.setInterval(() => {
      void loadOverview();
      if (selectedRunId) void loadRun(selectedRunId);
    }, 2000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [loadOverview, loadRun, runDetails?.status, selectedRunId]);

  return (
    <div style={{ position: "absolute", inset: 0, background: SURFACE, color: INK, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(15,118,110,0.11), transparent 26%), radial-gradient(circle at bottom right, rgba(180,83,9,0.08), transparent 22%)" }} />
      <div style={{ position: "relative", inset: 0, height: "100%", display: "grid", gridTemplateColumns: "320px minmax(560px, 1fr) 460px", gap: 14, padding: 14 }}>
        <section style={{ minWidth: 0, minHeight: 0, border: `1px solid ${BORDER}`, borderRadius: 24, background: PANEL, display: "grid", gridTemplateRows: "auto auto 1fr", overflow: "hidden", boxShadow: "0 20px 50px rgba(32,26,18,0.08)" }}>
          <div style={{ padding: 20, borderBottom: `1px solid ${BORDER}`, background: `linear-gradient(180deg, ${PANEL}, ${PANEL_ALT})` }}>
            <div style={{ fontSize: 11, letterSpacing: "0.26em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>Playwright</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>Workbench</div>
            <div style={{ marginTop: 10, fontSize: 13, color: MUTED }}>Spec explorer, run history, and failure review in one place.</div>
          </div>

          <div style={{ padding: 16, borderBottom: `1px solid ${BORDER}`, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <MetricCard label="Specs" value={String(specs.length)} tone="neutral" />
              <MetricCard label="Runs" value={String(runs.length)} tone="neutral" />
              <MetricCard label="Passing" value={String(runTotals.passed)} tone="success" />
              <MetricCard label="Failures" value={String(runTotals.failed + runTotals.errored)} tone="failure" />
            </div>
            <input
              value={specFilter}
              onChange={(event) => setSpecFilter(event.target.value)}
              placeholder="Filter specs"
              style={inputStyle}
            />
          </div>

          <div style={{ minHeight: 0, overflow: "auto", padding: 12, display: "grid", gap: 10 }}>
            {filteredSpecs.map((spec) => {
              const latestRun = latestRunBySpec.get(spec.path);
              const active = spec.path === selectedSpec;
              return (
                <button
                  key={spec.path}
                  onClick={() => {
                    setSelectedSpec(spec.path);
                    setDetailTab("source");
                  }}
                  style={{
                    textAlign: "left",
                    borderRadius: 18,
                    border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                    padding: 14,
                    background: active ? ACCENT_SOFT : PANEL,
                    cursor: "pointer",
                    boxShadow: active ? "0 10px 30px rgba(15,118,110,0.12)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spec.name}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 4, wordBreak: "break-word" }}>{spec.path}</div>
                    </div>
                    {latestRun && <StatusPill status={latestRun.status} />}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12, fontSize: 11, color: MUTED }}>
                    <span>{formatBytes(spec.size)}</span>
                    <span>{formatDate(spec.modifiedAt)}</span>
                  </div>
                  {latestRun?.summary && (
                    <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 11, color: INK }}>
                      <span>{latestRun.summary.passed} passed</span>
                      <span>{latestRun.summary.failed + latestRun.summary.timedOut} failed</span>
                    </div>
                  )}
                </button>
              );
            })}
            {!filteredSpecs.length && !loading && <EmptyState title="No specs match" body="Adjust the filter or create a new spec under src/test/e2e." />}
          </div>
        </section>

        <section style={{ minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "auto auto 1fr", gap: 14 }}>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 24, background: `linear-gradient(135deg, ${PANEL}, ${PANEL_ALT})`, padding: 20, boxShadow: "0 20px 50px rgba(32,26,18,0.08)" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.24em", textTransform: "uppercase", color: MUTED }}>Current Target</div>
                <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.05, marginTop: 10 }}>{selectedSpec || "Choose a spec"}</div>
                <div style={{ marginTop: 10, fontSize: 13, color: MUTED }}>
                  {selectedRun ? `Selected run ${selectedRun.runId} · ${describeRunTarget(selectedRun.target, selectedRun.specPath)}` : "No run selected yet. Pick a spec, run it, then inspect failures and artifacts here."}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                <ActionButton label="Refresh" onClick={() => void (async () => { setLoading(true); await loadOverview(); setLoading(false); })()} disabled={busy} />
                <ActionButton label="Run Spec" onClick={() => void runSelected("spec", selectedSpec || null)} disabled={!selectedSpec || busy} tone="primary" />
                <ActionButton label="Run All" onClick={() => void runSelected("suite")} disabled={busy} tone="success" />
                <ActionButton label="Re-run Failed" onClick={() => void runSelected("last-failed")} disabled={busy} />
                <ActionButton label="Re-run" onClick={() => void runSelected(runDetails?.target ?? selectedRun?.target ?? "suite", runDetails?.specPath ?? selectedRun?.specPath ?? null)} disabled={busy || (!runDetails && !selectedRun)} />
                <ActionButton label="Delete Run" onClick={() => void deleteRuns(selectedRunId)} disabled={busy || !selectedRunId} tone="danger" />
                <ActionButton label="Clear History" onClick={() => void deleteRuns()} disabled={busy || !runs.length} />
              </div>
            </div>
            {(message || copyMessage) && (
              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {message && <Notice tone="info" text={message} />}
                {copyMessage && <Notice tone="success" text={copyMessage} />}
              </div>
            )}
          </div>

          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 24, background: PANEL, padding: 16, boxShadow: "0 20px 50px rgba(32,26,18,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.24em", textTransform: "uppercase", color: MUTED }}>Run Radar</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>Latest executions</div>
              </div>
              <input value={runFilter} onChange={(event) => setRunFilter(event.target.value)} placeholder="Filter runs" style={{ ...inputStyle, width: 220 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <MetricCard label="Running" value={String(runTotals.running)} tone="warning" />
              <MetricCard label="Passed" value={String(runTotals.passed)} tone="success" />
              <MetricCard label="Failed" value={String(runTotals.failed)} tone="failure" />
              <MetricCard label="Errors" value={String(runTotals.errored)} tone="neutral" />
            </div>
          </div>

          <div style={{ minHeight: 0, border: `1px solid ${BORDER}`, borderRadius: 24, background: PANEL, display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", boxShadow: "0 20px 50px rgba(32,26,18,0.06)" }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.24em", textTransform: "uppercase", color: MUTED }}>Run History</div>
                <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>Review failures quickly</div>
              </div>
              <div style={{ fontSize: 12, color: MUTED }}>{filteredRuns.length} visible</div>
            </div>
            <div style={{ minHeight: 0, overflow: "auto", padding: 12, display: "grid", gap: 10 }}>
              {filteredRuns.map((run) => {
                const active = run.runId === selectedRunId;
                const meta = statusMeta(run.status);
                const title = run.specPath ?? "Full suite";
                return (
                  <button
                    key={run.runId}
                    onClick={() => {
                      setSelectedRunId(run.runId);
                      setDetailTab("overview");
                    }}
                    style={{
                      textAlign: "left",
                      borderRadius: 20,
                      border: active ? `1px solid ${meta.fg}` : `1px solid ${BORDER}`,
                      background: active ? meta.bg : PANEL,
                      padding: 16,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>{run.runId}</div>
                      </div>
                      <StatusPill status={run.status} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
                      <MiniMetric label="Started" value={formatDate(run.startedAt) || "-"} />
                      <MiniMetric label="Duration" value={formatDuration(run.durationMs) || "-"} />
                      <MiniMetric label="Exit" value={String(run.exitCode ?? "-")} />
                      <MiniMetric label="Failures" value={String((run.summary?.failed ?? 0) + (run.summary?.timedOut ?? 0))} accent={run.status === "failed" ? FAILURE : undefined} />
                    </div>
                    {run.summary && (
                      <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap", fontSize: 12, color: INK }}>
                        <span>{run.summary.total} total</span>
                        <span>{run.summary.passed} passed</span>
                        <span>{run.summary.skipped} skipped</span>
                        <span>{run.summary.timedOut} timed out</span>
                      </div>
                    )}
                  </button>
                );
              })}
              {!filteredRuns.length && !loading && <EmptyState title="No runs yet" body="Run a single spec or the full suite to start building history." />}
            </div>
          </div>
        </section>

        <section style={{ minWidth: 0, minHeight: 0, border: `1px solid ${BORDER}`, borderRadius: 24, background: PANEL, display: "grid", gridTemplateRows: "auto auto 1fr", overflow: "hidden", boxShadow: "0 20px 50px rgba(32,26,18,0.08)" }}>
          <div style={{ padding: 18, borderBottom: `1px solid ${BORDER}`, background: `linear-gradient(180deg, ${PANEL}, ${PANEL_ALT})` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.24em", textTransform: "uppercase", color: MUTED }}>Inspector</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8, lineHeight: 1.05 }}>{runHeading}</div>
              </div>
              {selectedRun && <StatusPill status={selectedRun.status} />}
            </div>
            {selectedRun && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Chip text={selectedRun.runId} />
                <Chip text={formatDate(selectedRun.startedAt)} />
                {selectedRun.durationMs != null && <Chip text={formatDuration(selectedRun.durationMs)} />}
                {selectedRun.exitCode != null && <Chip text={`exit ${selectedRun.exitCode}`} />}
              </div>
            )}
          </div>

          <div style={{ padding: 12, borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 8, flexWrap: "wrap", background: PANEL }}>
            <TabButton label="Overview" active={detailTab === "overview"} onClick={() => setDetailTab("overview")} />
            <TabButton label={`Artifacts${selectedRunArtifacts.length ? ` (${selectedRunArtifacts.length})` : ""}`} active={detailTab === "artifacts"} onClick={() => setDetailTab("artifacts")} />
            <TabButton label="Log" active={detailTab === "log"} onClick={() => setDetailTab("log")} />
            <TabButton label="Spec Source" active={detailTab === "source"} onClick={() => setDetailTab("source")} />
          </div>

          <div style={{ minHeight: 0, overflow: "hidden" }}>
            {detailTab === "overview" && (
              <div style={{ height: "100%", overflow: "auto", padding: 16, display: "grid", gap: 14 }}>
                {!selectedRun && <EmptyState title="No run selected" body="Pick a run from the center column to inspect errors, logs, screenshots, and video." />}
                {selectedRun && (
                  <>
                    <PanelCard title="Summary" action={selectedRun.command ? <InlineAction label="Copy command" onClick={() => void copyText(selectedRun.command, "Command copied")} /> : undefined}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                        <MetricCard label="Total" value={String(selectedSummary?.total ?? 0)} tone="neutral" />
                        <MetricCard label="Passed" value={String(selectedSummary?.passed ?? 0)} tone="success" />
                        <MetricCard label="Failed" value={String((selectedSummary?.failed ?? 0) + (selectedSummary?.timedOut ?? 0))} tone="failure" />
                        <MetricCard label="Skipped" value={String(selectedSummary?.skipped ?? 0)} tone="neutral" />
                      </div>
                      <div style={{ marginTop: 14, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{selectedRun.command}</div>
                    </PanelCard>

                    <PanelCard title="Failure-first artifacts" action={highlightedArtifacts.length ? <InlineAction label="Open artifacts" onClick={() => setDetailTab("artifacts")} /> : undefined}>
                      {highlightedArtifacts.length ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {highlightedArtifacts.map((artifact) => (
                            <button
                              key={artifact.relativePath}
                              onClick={() => {
                                setSelectedArtifact(artifact.relativePath);
                                setDetailTab("artifacts");
                              }}
                              style={{
                                textAlign: "left",
                                borderRadius: 14,
                                border: `1px solid ${BORDER}`,
                                background: PANEL,
                                padding: 12,
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{artifact.name}</div>
                              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{artifact.relativePath}</div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: MUTED }}>No screenshots, video, or error context captured for this run.</div>
                      )}
                    </PanelCard>

                    <PanelCard title="Quick actions">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <ActionButton label="Copy log" onClick={() => void copyText(logContent, "Log copied")} disabled={!logContent} compact />
                        <ActionButton label="Open log tab" onClick={() => setDetailTab("log")} compact />
                        <ActionButton label="Open source" onClick={() => setDetailTab("source")} compact />
                        <ActionButton label="Re-run this target" onClick={() => void runSelected(selectedRun.target, selectedRun.specPath ?? null)} disabled={busy} compact tone="primary" />
                        <ActionButton label="Re-run Failed" onClick={() => void runSelected("last-failed")} disabled={busy} compact />
                      </div>
                    </PanelCard>
                  </>
                )}
              </div>
            )}

            {detailTab === "artifacts" && (
              <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", height: "100%" }}>
                <div style={{ minHeight: 0, overflow: "auto", borderRight: `1px solid ${BORDER}`, background: PANEL_ALT, padding: 12, display: "grid", gap: 8 }}>
                  {selectedRunArtifacts.map((artifact) => (
                    <button
                      key={artifact.relativePath}
                      onClick={() => setSelectedArtifact(artifact.relativePath)}
                      style={{
                        textAlign: "left",
                        borderRadius: 14,
                        border: selectedArtifact === artifact.relativePath ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                        background: selectedArtifact === artifact.relativePath ? ACCENT_SOFT : PANEL,
                        padding: 12,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.35 }}>{artifact.name}</div>
                        <span style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>{artifact.kind}</span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 10, color: MUTED, wordBreak: "break-word" }}>{artifact.relativePath}</div>
                      <div style={{ marginTop: 8, fontSize: 10, color: MUTED }}>{formatBytes(artifact.size)}</div>
                    </button>
                  ))}
                  {!selectedRunArtifacts.length && <EmptyState title="No artifacts" body="Run selection does not have stored screenshots, videos, JSON, or logs yet." compact />}
                </div>
                <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr" }}>
                  <div style={{ padding: 12, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{selectedArtifactInfo?.name ?? "Artifact preview"}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{selectedArtifactInfo?.relativePath ?? "Select an artifact from the left."}</div>
                    </div>
                    {artifactUrl && <InlineAction label="Open raw" onClick={() => window.open(artifactUrl, "_blank", "noreferrer")} />}
                    {artifactText && <InlineAction label="Copy text" onClick={() => void copyText(artifactText, "Artifact copied")} />}
                  </div>
                  <div style={{ minHeight: 0, overflow: "auto", background: CODE_BG, color: "#f4f4f5", padding: 16 }}>
                    {selectedArtifactInfo?.kind === "image" && artifactUrl ? (
                      <a href={artifactUrl} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center" }}>
                        <img src={artifactUrl} alt={selectedArtifactInfo.name} style={{ maxWidth: "100%", borderRadius: 18 }} />
                      </a>
                    ) : selectedArtifactInfo?.kind === "video" && artifactUrl ? (
                      <div style={{ display: "grid", gap: 12 }}>
                        <video src={artifactUrl} controls style={{ width: "100%", borderRadius: 18 }} />
                        <a href={artifactUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#93c5fd" }}>Open video in new tab</a>
                      </div>
                    ) : selectedArtifactInfo?.kind && ["text", "json", "html"].includes(selectedArtifactInfo.kind) ? (
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: monoFont }}>{artifactText}</pre>
                    ) : selectedArtifactInfo ? (
                      <div style={{ fontSize: 13, color: "#cbd5e1" }}>No preview available. Use Open raw.</div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#cbd5e1" }}>Select an artifact to preview it here.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {detailTab === "log" && (
              <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%" }}>
                <div style={{ padding: 12, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>Run log</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Streaming tail capped to the latest 100,000 characters.</div>
                  </div>
                  <InlineAction label="Copy log" onClick={() => void copyText(logContent, "Log copied")} />
                </div>
                <div style={{ minHeight: 0, overflow: "auto", background: CODE_BG, color: "#f4f4f5", padding: 16 }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: monoFont }}>{logContent || "No log output yet."}</pre>
                </div>
              </div>
            )}

            {detailTab === "source" && (
              <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", height: "100%" }}>
                <div style={{ padding: 12, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{selectedSpec || "Spec source"}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Edit, save, and rerun without leaving the workbench.</div>
                  </div>
                  <ActionButton label="Save" onClick={() => void saveSpec()} disabled={!dirty || busy} compact tone="primary" />
                  <ActionButton label="Run" onClick={() => void runSelected("spec", selectedSpec || null)} disabled={!selectedSpec || busy} compact />
                </div>
                <textarea
                  value={specContent}
                  onChange={(event) => setSpecContent(event.target.value)}
                  spellCheck={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: 0,
                    border: 0,
                    outline: "none",
                    resize: "none",
                    background: CODE_BG,
                    color: "#f4f4f5",
                    padding: 16,
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontFamily: monoFont,
                  }}
                />
                <div style={{ padding: 12, borderTop: `1px solid ${BORDER}`, fontSize: 12, color: dirty ? "#9a6700" : MUTED }}>
                  {dirty ? "Unsaved changes" : "Saved"}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "neutral" | "success" | "failure" | "warning" }) {
  const palette = {
    neutral: { bg: PANEL, fg: INK },
    success: { bg: "#ecfdf3", fg: "#166534" },
    failure: { bg: "#fef3f2", fg: FAILURE },
    warning: { bg: "#fff7d6", fg: "#9a6700" },
  }[tone];
  return (
    <div style={{ borderRadius: 18, border: `1px solid ${BORDER}`, background: palette.bg, padding: 14 }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.16em" }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1, fontWeight: 900, color: palette.fg }}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${BORDER}`, background: PANEL, padding: 10 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: accent ?? INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled, tone = "default", compact = false }: { label: string; onClick: () => void; disabled?: boolean; tone?: "default" | "primary" | "success" | "danger"; compact?: boolean }) {
  const palette = tone === "primary"
    ? { background: ACCENT, color: "#f8fffd", border: ACCENT }
    : tone === "success"
      ? { background: "#166534", color: "#f0fdf4", border: "#166534" }
      : tone === "danger"
        ? { background: "#fff1f2", color: FAILURE, border: "#fecdd3" }
        : { background: PANEL, color: INK, border: BORDER };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...buttonBase,
        padding: compact ? "7px 12px" : buttonBase.padding,
        background: palette.background,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: RunStatus }) {
  const meta = statusMeta(status);
  return (
    <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${meta.border}`, background: meta.bg, color: meta.fg, fontSize: 11, fontWeight: 800, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {meta.label}
    </span>
  );
}

function Chip({ text }: { text: string }) {
  return <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${BORDER}`, background: PANEL, fontSize: 11, color: MUTED }}>{text}</span>;
}

function Notice({ tone, text }: { tone: "info" | "success"; text: string }) {
  const palette = tone === "success"
    ? { bg: "#ecfdf3", fg: "#166534", border: "#86efac" }
    : { bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd" };
  return <div style={{ padding: "8px 12px", borderRadius: 999, background: palette.bg, color: palette.fg, border: `1px solid ${palette.border}`, fontSize: 12, fontWeight: 700 }}>{text}</div>;
}

function PanelCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ borderRadius: 20, border: `1px solid ${BORDER}`, background: PANEL, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function InlineAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: "transparent", border: 0, color: ACCENT, cursor: "pointer", fontSize: 12, fontWeight: 800 }}>
      {label}
    </button>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
        background: active ? ACCENT_SOFT : PANEL,
        color: active ? ACCENT : MUTED,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function EmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div style={{ borderRadius: compact ? 16 : 20, border: `1px dashed ${BORDER}`, background: PANEL_ALT, padding: compact ? 14 : 18 }}>
      <div style={{ fontSize: 14, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.55, color: MUTED }}>{body}</div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 999,
  border: `1px solid ${BORDER}`,
  padding: "10px 14px",
  background: PANEL,
  color: INK,
  fontSize: 13,
  outline: "none",
};
