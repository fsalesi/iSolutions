"use client";

import { useEffect, useRef, useState } from "react";

type RunStatus = "running" | "passed" | "failed" | "error";

type TestSpecInfo = {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
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

type ArtifactInfo = {
  relativePath: string;
  name: string;
  kind: "image" | "text" | "json" | "zip" | "html" | "other";
  size: number;
  updatedAt: string;
};

type RunDetails = RunSummary & {
  logTail: string;
  artifacts: ArtifactInfo[];
};

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function statusColor(status: RunStatus): string {
  if (status === "passed") return "#15803d";
  if (status === "failed") return "#b91c1c";
  if (status === "running") return "#b45309";
  return "#475569";
}

export function TestRunnerWorkbench() {
  const [specs, setSpecs] = useState<TestSpecInfo[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedSpec, setSelectedSpec] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [specContent, setSpecContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [runDetails, setRunDetails] = useState<RunDetails | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState("");
  const [artifactText, setArtifactText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<number | null>(null);

  const isDirty = selectedSpec !== "" && specContent !== savedContent;
  const artifacts = runDetails?.artifacts ?? [];
  const selectedArtifactInfo = artifacts.find((artifact) => artifact.relativePath === selectedArtifact) ?? null;
  const artifactUrl = selectedRunId && selectedArtifact
    ? `/api/dev/test-runner/artifact?runId=${encodeURIComponent(selectedRunId)}&path=${encodeURIComponent(selectedArtifact)}`
    : "";

  async function loadOverview() {
    const res = await fetch("/api/dev/test-runner", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Unable to load tests");
    setSpecs(data.specs ?? []);
    setRuns(data.runs ?? []);

    if (!selectedSpec && data.specs?.length) {
      setSelectedSpec(data.specs[0].path);
    }
    if (!selectedRunId && data.runs?.length) {
      setSelectedRunId(data.runs[0].runId);
    }
  }

  async function loadSpec(path: string) {
    const res = await fetch(`/api/dev/test-runner/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Unable to load file");
    setSpecContent(data.content ?? "");
    setSavedContent(data.content ?? "");
  }

  async function loadRun(runId: string) {
    const res = await fetch(`/api/dev/test-runner/run?runId=${encodeURIComponent(runId)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Unable to load run");
    setRunDetails(data);
    const nextArtifacts = data.artifacts ?? [];
    if (!selectedArtifact && nextArtifacts.length) {
      setSelectedArtifact(nextArtifacts[0].relativePath);
    }
  }

  async function loadArtifactPreview(runId: string, artifactPath: string) {
    const artifact = (runDetails?.artifacts ?? []).find((item) => item.relativePath === artifactPath);
    if (!artifact || !["text", "json"].includes(artifact.kind)) {
      setArtifactText("");
      return;
    }
    const res = await fetch(`/api/dev/test-runner/artifact?runId=${encodeURIComponent(runId)}&path=${encodeURIComponent(artifactPath)}`, { cache: "no-store" });
    setArtifactText(await res.text());
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await loadOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load test runner");
    } finally {
      setLoading(false);
    }
  }

  async function saveSpec() {
    if (!selectedSpec) return;
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
  }

  async function runSelected(specPath: string | null) {
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
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    if (!selectedSpec) return;
    void loadSpec(selectedSpec).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load file");
    });
  }, [selectedSpec]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetails(null);
      setSelectedArtifact("");
      return;
    }
    void loadRun(selectedRunId).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load run");
    });
  }, [selectedRunId]);

  useEffect(() => {
    if (!selectedRunId || !selectedArtifact) {
      setArtifactText("");
      return;
    }
    void loadArtifactPreview(selectedRunId, selectedArtifact);
  }, [selectedRunId, selectedArtifact, runDetails]);

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
  }, [runDetails?.status, selectedRunId]);

  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "280px minmax(420px, 1fr) minmax(380px, 520px)", background: "#f3f4f6", color: "#111827" }}>
      <aside style={{ borderRight: "1px solid #d1d5db", background: "#ffffff", overflow: "auto" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280" }}>Playwright</div>
          <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700 }}>Test Runner</div>
          <button onClick={() => void refreshAll()} disabled={busy} style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>Refresh</button>
        </div>

        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", marginBottom: 12 }}>Specs</div>
          <div style={{ display: "grid", gap: 8 }}>
            {specs.map((spec) => (
              <button
                key={spec.path}
                onClick={() => setSelectedSpec(spec.path)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 10,
                  border: selectedSpec === spec.path ? "1px solid #2563eb" : "1px solid #e5e7eb",
                  background: selectedSpec === spec.path ? "#eff6ff" : "#ffffff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{spec.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{spec.path}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{fmtBytes(spec.size)}</div>
              </button>
            ))}
            {!specs.length && !loading && <div style={{ fontSize: 13, color: "#6b7280" }}>No specs found in `e2e/`.</div>}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", marginBottom: 12 }}>Recent Runs</div>
          <div style={{ display: "grid", gap: 8 }}>
            {runs.map((run) => (
              <button
                key={run.runId}
                onClick={() => setSelectedRunId(run.runId)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 10,
                  border: selectedRunId === run.runId ? `1px solid ${statusColor(run.status)}` : "1px solid #e5e7eb",
                  background: selectedRunId === run.runId ? "#f8fafc" : "#ffffff",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{run.specPath ?? "Full suite"}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: statusColor(run.status), textTransform: "uppercase" }}>{run.status}</div>
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{fmtDate(run.startedAt)}</div>
              </button>
            ))}
            {!runs.length && !loading && <div style={{ fontSize: 13, color: "#6b7280" }}>No runs yet.</div>}
          </div>
        </div>
      </aside>

      <section style={{ display: "flex", flexDirection: "column", minWidth: 0, borderRight: "1px solid #d1d5db" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 18, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{selectedSpec || "Select a spec"}</div>
            <div style={{ flex: 1 }} />
            <button onClick={() => void runSelected(selectedSpec || null)} disabled={!selectedSpec || busy} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #2563eb", background: "#2563eb", color: "#ffffff", cursor: "pointer" }}>Run Spec</button>
            <button onClick={() => void runSelected(null)} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", cursor: "pointer" }}>Run All</button>
            <button onClick={() => void saveSpec()} disabled={!isDirty || busy} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #475569", background: "#ffffff", cursor: "pointer" }}>Save</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: isDirty ? "#b45309" : "#6b7280" }}>
            {isDirty ? "Unsaved changes" : "Saved"}
            {message ? ` • ${message}` : ""}
          </div>
        </div>

        <textarea
          value={specContent}
          onChange={(event) => setSpecContent(event.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            width: "100%",
            border: 0,
            padding: 16,
            resize: "none",
            outline: "none",
            background: "#0f172a",
            color: "#e5e7eb",
            fontSize: 13,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            lineHeight: 1.5,
          }}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Run Details</div>
            {runDetails && <div style={{ padding: "4px 8px", borderRadius: 999, background: `${statusColor(runDetails.status)}22`, color: statusColor(runDetails.status), fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{runDetails.status}</div>}
          </div>
          {runDetails ? (
            <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12, color: "#475569" }}>
              <div>{runDetails.specPath ?? "Full suite"}</div>
              <div>{runDetails.command}</div>
              <div>{fmtDate(runDetails.startedAt)}{runDetails.finishedAt ? ` → ${fmtDate(runDetails.finishedAt)}` : ""}</div>
              {runDetails.summary && (
                <div>Tests: {runDetails.summary.total} total, {runDetails.summary.passed} passed, {runDetails.summary.failed} failed, {runDetails.summary.skipped} skipped, {runDetails.summary.timedOut} timed out</div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>Select a run to inspect logs and artifacts.</div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: 0, flex: 1 }}>
          <div style={{ borderRight: "1px solid #e5e7eb", background: "#ffffff", overflow: "auto" }}>
            <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280" }}>Artifacts</div>
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {artifacts.map((artifact) => (
                <button
                  key={artifact.relativePath}
                  onClick={() => setSelectedArtifact(artifact.relativePath)}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 10,
                    border: selectedArtifact === artifact.relativePath ? "1px solid #2563eb" : "1px solid #e5e7eb",
                    background: selectedArtifact === artifact.relativePath ? "#eff6ff" : "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{artifact.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{artifact.relativePath}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", background: "#ffffff", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{selectedArtifactInfo?.relativePath || "Log"}</div>
              <div style={{ flex: 1 }} />
              {artifactUrl && (
                <a href={artifactUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}>Open raw</a>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#ffffff" }}>
              {selectedArtifactInfo?.kind === "image" && artifactUrl ? (
                <div style={{ padding: 16 }}>
                  <img src={artifactUrl} alt={selectedArtifactInfo.name} style={{ display: "block", maxWidth: "100%", borderRadius: 12, border: "1px solid #e5e7eb" }} />
                </div>
              ) : selectedArtifactInfo && ["text", "json"].includes(selectedArtifactInfo.kind) ? (
                <pre style={{ margin: 0, padding: 16, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5, color: "#0f172a" }}>{artifactText}</pre>
              ) : selectedArtifactInfo ? (
                <div style={{ padding: 16, fontSize: 13, color: "#475569" }}>
                  Preview is not built for this file type. Use <em>Open raw</em>.
                </div>
              ) : (
                <pre style={{ margin: 0, padding: 16, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5, color: "#0f172a" }}>{runDetails?.logTail || "No output yet."}</pre>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
