"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/context/SessionContext";
import { QAD_CALL_PRESETS } from "@/lib/qad/QadCallPresets";

function formatResult(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function labelForProgram(procedure: string): string {
  const base = procedure.replace(/\.p$/i, "");
  return base;
}

export function QadCallWorkbench() {
  const { domain } = useSession();
  const initialPreset = QAD_CALL_PRESETS[0];
  const programOptions = useMemo(
    () => Array.from(new Set(QAD_CALL_PRESETS.map((preset) => preset.procedure))),
    [],
  );
  const [selectedProgram, setSelectedProgram] = useState(initialPreset?.procedure ?? programOptions[0] ?? "");
  const presetOptions = useMemo(
    () => QAD_CALL_PRESETS.filter((preset) => preset.procedure === selectedProgram),
    [selectedProgram],
  );
  const [presetKey, setPresetKey] = useState(initialPreset?.key ?? "");
  const [callDomain, setCallDomain] = useState(domain || "");
  const [procedure, setProcedure] = useState(initialPreset?.procedure ?? "");
  const [entry, setEntry] = useState(initialPreset?.entry ?? "");
  const [input, setInput] = useState(initialPreset?.sampleInput ?? "");
  const [longchar, setLongchar] = useState(initialPreset?.sampleLongchar ?? "");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedPreset = useMemo(
    () => QAD_CALL_PRESETS.find((preset) => preset.key === presetKey) ?? null,
    [presetKey],
  );

  const applyPreset = (nextKey: string) => {
    setPresetKey(nextKey);
    const preset = QAD_CALL_PRESETS.find((item) => item.key === nextKey);
    if (!preset) return;
    setProcedure(preset.procedure);
    setEntry(preset.entry);
    setInput(preset.sampleInput ?? "");
    setLongchar(preset.sampleLongchar ?? "");
    setStatus("");
    setOutput("");
  };

  useEffect(() => {
    if (!presetOptions.length) {
      setPresetKey("");
      setProcedure(selectedProgram);
      setEntry("");
      setInput("");
      setLongchar("");
      return;
    }
    const hasCurrent = presetOptions.some((preset) => preset.key === presetKey);
    if (!hasCurrent) {
      applyPreset(presetOptions[0].key);
    }
  }, [selectedProgram]);

  const runCall = async () => {
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/dev/qad-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shimKey: presetKey || undefined,
          domain: callDomain,
          procedure,
          entry,
          input,
          longchar,
          datasetXml: longchar || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.error || `Call failed (${res.status})`);
        setOutput("");
        return;
      }
      setStatus("Call completed");
      setOutput(formatResult(data.result));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Call failed");
      setOutput("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto", background: "var(--bg-body)", padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 18 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>QAD Call Workbench</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Direct tester for DomainMgr.call() and the typed QAD shim layer.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: 16, border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-surface)" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Backend Program</label>
            <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-body)", color: "var(--text-primary)" }}>
              {programOptions.map((program) => (
                <option key={program} value={program}>{labelForProgram(program)}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6, gridColumn: "span 2" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Sub Procedure</label>
            <select value={presetKey} onChange={(e) => applyPreset(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-body)", color: "var(--text-primary)" }}>
              {presetOptions.map((preset) => (
                <option key={preset.key} value={preset.key}>{preset.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedPreset?.description || "Pick a sub-procedure to populate the fields below."}</div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Domain</label>
            <input value={callDomain} onChange={(e) => setCallDomain(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-body)", color: "var(--text-primary)" }} />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Procedure</label>
            <input value={procedure} onChange={(e) => setProcedure(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-body)", color: "var(--text-primary)" }} />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Entry</label>
            <input value={entry} onChange={(e) => setEntry(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-body)", color: "var(--text-primary)" }} />
          </div>
          <div style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Input</label>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-body)", color: "var(--text-primary)", resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }} />
          </div>
          <div style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Longchar (optional)</label>
            <textarea value={longchar} onChange={(e) => setLongchar(e.target.value)} rows={6} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-body)", color: "var(--text-primary)", resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, gridColumn: "1 / -1" }}>
            <button onClick={runCall} disabled={busy} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)", background: busy ? "var(--bg-surface-alt)" : "var(--color-primary, #2563eb)", color: busy ? "var(--text-muted)" : "white", cursor: busy ? "not-allowed" : "pointer", fontWeight: 600 }}>
              {busy ? "Running..." : "Run Call"}
            </button>
            {status && <div style={{ fontSize: 13, color: status === "Call completed" ? "var(--success-text, #166534)" : "var(--danger-text, #b91c1c)" }}>{status}</div>}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Output</div>
          <textarea value={output} readOnly rows={22} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "#101418", color: "#e5eef7", resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }} />
        </div>
      </div>
    </div>
  );
}
