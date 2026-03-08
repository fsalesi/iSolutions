import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

export type RunStatus = "running" | "passed" | "failed" | "error";

export interface TestSpecInfo {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
}

export interface ArtifactInfo {
  relativePath: string;
  name: string;
  kind: "image" | "video" | "text" | "json" | "zip" | "html" | "other";
  size: number;
  updatedAt: string;
}

export type RunTarget = "spec" | "suite" | "last-failed";

export interface RunSummary {
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
}

export interface RunDetails extends RunSummary {
  logTail: string;
  artifacts: ArtifactInfo[];
}

interface RunMeta extends RunSummary {
  logPath: string;
  outputDir: string;
  resultsPath: string;
}

const PROJECT_ROOT = process.cwd();
const SPEC_ROOT = path.join(PROJECT_ROOT, "test", "e2e");
const RUN_ROOT = path.join(PROJECT_ROOT, "test", ".test-runner");

const g = global as typeof globalThis & {
  __testRunnerChildren?: Map<string, number>;
};

if (!g.__testRunnerChildren) g.__testRunnerChildren = new Map();
const childRegistry = g.__testRunnerChildren;

function ensureInside(baseDir: string, targetPath: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget === resolvedBase) return resolvedTarget;
  if (!resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error("Path is outside the allowed directory");
  }
  return resolvedTarget;
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function walkFiles(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function classifyArtifact(filePath: string): ArtifactInfo["kind"] {
  const ext = path.extname(filePath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return "image";
  if ([".webm", ".mp4", ".m4v", ".mov"].includes(ext)) return "video";
  if ([".log", ".txt", ".md"].includes(ext)) return "text";
  if (ext === ".json") return "json";
  if (ext === ".zip") return "zip";
  if (ext === ".html") return "html";
  return "other";
}

function summarizeResults(raw: any): RunSummary["summary"] {
  if (!raw || !Array.isArray(raw.suites)) return null;

  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let timedOut = 0;

  const visitSpec = (spec: any) => {
    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        total += 1;
        const status = String(result.status ?? "");
        if (status === "passed") passed += 1;
        else if (status === "skipped") skipped += 1;
        else if (status === "timedOut") timedOut += 1;
        else if (status) failed += 1;
      }
    }
  };

  const visitSuite = (suite: any) => {
    for (const spec of suite.specs ?? []) visitSpec(spec);
    for (const child of suite.suites ?? []) visitSuite(child);
  };

  for (const suite of raw.suites) visitSuite(suite);
  return { total, passed, failed, skipped, timedOut };
}

async function listArtifacts(outputDir: string, resultsPath: string, logPath: string): Promise<ArtifactInfo[]> {
  const paths = new Set<string>();
  for (const filePath of await walkFiles(outputDir)) paths.add(filePath);
  paths.add(resultsPath);
  paths.add(logPath);

  const artifacts: ArtifactInfo[] = [];
  for (const filePath of paths) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat?.isFile()) continue;
    const rel = path.relative(outputDir, filePath);
    const relativePath = rel.startsWith("..") ? path.basename(filePath) : rel;
    artifacts.push({
      relativePath,
      name: path.basename(filePath),
      kind: classifyArtifact(filePath),
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  artifacts.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return artifacts;
}

function buildRunPaths(runId: string) {
  const runDir = path.join(RUN_ROOT, runId);
  return {
    runDir,
    metaPath: path.join(runDir, "meta.json"),
    logPath: path.join(runDir, "run.log"),
    outputDir: path.join(runDir, "artifacts"),
    resultsPath: path.join(runDir, "results.json"),
  };
}

async function loadMeta(runId: string): Promise<RunMeta | null> {
  const { metaPath } = buildRunPaths(runId);
  return readJson<RunMeta>(metaPath);
}

function createRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}`;
}

export async function listSpecFiles(): Promise<TestSpecInfo[]> {
  await ensureDir(SPEC_ROOT);
  const files = await walkFiles(SPEC_ROOT);
  const specs: TestSpecInfo[] = [];

  for (const filePath of files) {
    if (!/\.(ts|tsx|js|mjs)$/.test(filePath)) continue;
    const stat = await fs.stat(filePath);
    specs.push({
      path: path.relative(SPEC_ROOT, filePath).replace(/\\/g, "/"),
      name: path.basename(filePath),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }

  specs.sort((a, b) => a.path.localeCompare(b.path));
  return specs;
}

export async function readSpecFile(relativePath: string): Promise<string> {
  const normalized = relativePath.replace(/\\/g, "/");
  const absolute = ensureInside(SPEC_ROOT, path.join(SPEC_ROOT, normalized));
  return fs.readFile(absolute, "utf8");
}

export async function writeSpecFile(relativePath: string, content: string): Promise<void> {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!/\.(ts|tsx|js|mjs)$/.test(normalized)) {
    throw new Error("Only script files under e2e can be edited here");
  }
  const absolute = ensureInside(SPEC_ROOT, path.join(SPEC_ROOT, normalized));
  await ensureDir(path.dirname(absolute));
  await fs.writeFile(absolute, content, "utf8");
}

export async function startRun(specPath: string | null, target: RunTarget = specPath ? "spec" : "suite"): Promise<RunSummary> {
  await ensureDir(RUN_ROOT);
  const runId = createRunId();
  const { runDir, metaPath, logPath, outputDir, resultsPath } = buildRunPaths(runId);
  await ensureDir(runDir);
  await ensureDir(outputDir);

  const safeSpecPath = specPath ? specPath.replace(/\\/g, "/") : null;
  let specArg: string | null = null;
  if (safeSpecPath) {
    const absoluteSpec = ensureInside(SPEC_ROOT, path.join(SPEC_ROOT, safeSpecPath));
    specArg = path.relative(PROJECT_ROOT, absoluteSpec).replace(/\\/g, "/");
  }

  const args = ["playwright", "test"];
  if (target === "last-failed") args.push("--last-failed");
  else if (specArg) args.push(specArg);
  args.push(`--output=${outputDir}`);
  args.push("--reporter=line,json");

  const command = ["npx", ...args].join(" ");
  const startedAt = new Date().toISOString();

  const meta: RunMeta = {
    runId,
    specPath: safeSpecPath,
    target,
    status: "running",
    startedAt,
    finishedAt: null,
    durationMs: null,
    exitCode: null,
    command,
    pid: null,
    summary: null,
    logPath,
    outputDir,
    resultsPath,
  };

  await writeJson(metaPath, meta);
  await fs.writeFile(logPath, `# ${command}\n# started ${startedAt}\n\n`, "utf8");

  const child = spawn("npx", args, {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PLAYWRIGHT_JSON_OUTPUT_NAME: resultsPath,
    },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  meta.pid = child.pid ?? null;
  await writeJson(metaPath, meta);
  childRegistry.set(runId, child.pid ?? -1);

  const appendLog = async (chunk: Buffer) => {
    await fs.appendFile(logPath, chunk.toString("utf8"));
  };

  child.stdout?.on("data", (chunk: Buffer) => {
    void appendLog(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    void appendLog(chunk);
  });

  child.on("close", async (code) => {
    const finishedAt = new Date().toISOString();
    const current = (await loadMeta(runId)) ?? meta;
    const results = await readJson<any>(resultsPath);
    const summary = summarizeResults(results);
    const status: RunStatus = code === 0 ? "passed" : (summary?.failed || summary?.timedOut ? "failed" : "error");

    current.status = status;
    current.finishedAt = finishedAt;
    current.durationMs = Date.parse(finishedAt) - Date.parse(current.startedAt);
    current.exitCode = code ?? null;
    current.summary = summary;
    await fs.appendFile(logPath, `\n# finished ${finishedAt} exit=${code ?? "null"}\n`);
    await writeJson(metaPath, current);
    childRegistry.delete(runId);
  });

  child.unref();
  return meta;
}

export async function listRuns(): Promise<RunSummary[]> {
  await ensureDir(RUN_ROOT);
  const runDirs = await fs.readdir(RUN_ROOT, { withFileTypes: true }).catch(() => []);
  const runs: RunSummary[] = [];

  for (const entry of runDirs) {
    if (!entry.isDirectory()) continue;
    const meta = await loadMeta(entry.name);
    if (!meta) continue;
    runs.push({
      runId: meta.runId,
      specPath: meta.specPath,
      target: meta.target ?? (meta.specPath ? "spec" : "suite"),
      status: meta.status,
      startedAt: meta.startedAt,
      finishedAt: meta.finishedAt,
      durationMs: meta.durationMs,
      exitCode: meta.exitCode,
      command: meta.command,
      pid: meta.pid,
      summary: meta.summary,
    });
  }

  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return runs;
}

export async function getRunDetails(runId: string): Promise<RunDetails | null> {
  const meta = await loadMeta(runId);
  if (!meta) return null;

  const logText = await fs.readFile(meta.logPath, "utf8").catch(() => "");
  const artifacts = await listArtifacts(meta.outputDir, meta.resultsPath, meta.logPath);

  return {
    runId: meta.runId,
    specPath: meta.specPath,
    target: meta.target ?? (meta.specPath ? "spec" : "suite"),
    status: meta.status,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
    durationMs: meta.durationMs,
    exitCode: meta.exitCode,
    command: meta.command,
    pid: meta.pid,
    summary: meta.summary,
    logTail: logText.slice(-100_000),
    artifacts,
  };
}


export async function deleteRun(runId: string): Promise<void> {
  if (childRegistry.has(runId)) {
    throw new Error("Run is still running");
  }
  const { runDir } = buildRunPaths(runId);
  const resolved = ensureInside(RUN_ROOT, runDir);
  await fs.rm(resolved, { recursive: true, force: true });
}

export async function clearRuns(): Promise<void> {
  await ensureDir(RUN_ROOT);
  const runDirs = await fs.readdir(RUN_ROOT, { withFileTypes: true }).catch(() => []);
  for (const entry of runDirs) {
    if (!entry.isDirectory()) continue;
    await deleteRun(entry.name);
  }
}

export async function readRunArtifact(runId: string, relativePath: string): Promise<{ filePath: string; buffer: Buffer }> {
  const meta = await loadMeta(runId);
  if (!meta) throw new Error("Run not found");

  let absolutePath: string;
  if (["run.log", "results.json"].includes(relativePath)) {
    absolutePath = relativePath === "run.log" ? meta.logPath : meta.resultsPath;
  } else {
    absolutePath = ensureInside(meta.outputDir, path.join(meta.outputDir, relativePath));
  }

  const buffer = await fs.readFile(absolutePath);
  return { filePath: absolutePath, buffer };
}
