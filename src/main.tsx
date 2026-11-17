/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  CircleCheck,
  ChevronDown,
  Clock3,
  Database,
  Download,
  FlaskConical,
  GitCompareArrows,
  Layers3,
  LoaderCircle,
  LogOut,
  Play,
  Search,
  Plus,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import {
  blankCase,
  DatasetCases,
  normalizeCases,
  parseCaseJson,
  type TestCase,
} from "./DatasetCases";
import { createDemoApi } from "./demo";
import "./style.css";
type Provider = { id: string; name: string; models: string[] };
export type Dataset = {
  id: string;
  name: string;
  description: string;
  count: number;
  fingerprint: string;
  created: string;
};
type Summary = {
  total: number;
  completed: number;
  passed: number;
  errors: number;
  forbidden_hits: number;
  pass_rate: number;
  p50_ms: number | null;
  p95_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  usage_complete: boolean;
  cost_usd: number | null;
  cost_complete: boolean;
};
export type Result = {
  position: number;
  prompt: string;
  expected: string;
  match: string;
  output: string | null;
  correct: boolean;
  passed: boolean;
  forbidden_hit: boolean;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  error: string | null;
};
export type Run = {
  id: string;
  name: string;
  dataset_id: string;
  dataset_name: string;
  fingerprint: string;
  provider: string;
  model: string;
  instruction: string;
  max_tokens: number;
  status: string;
  cancel_requested: boolean;
  created: string;
  error: string | null;
  summary: Summary;
  results?: Result[];
};
type Comparison = {
  baseline: Run;
  candidate: Run;
  pass_rate_delta: number;
  regressions: number;
  improvements: number;
  cases: {
    position: number;
    prompt: string;
    baseline: boolean;
    candidate: boolean;
    baseline_output: string | null;
    candidate_output: string | null;
  }[];
};
const starter: TestCase[] = [
  {
    prompt: "Uppercase: release ready",
    expected: "RELEASE READY",
    match: "exact",
  },
  {
    prompt: "Lowercase: SAFE DEFAULTS",
    expected: "safe defaults",
    match: "exact",
  },
  { prompt: "Add: 17 and 25", expected: "42", match: "exact" },
  { prompt: "Reverse: backend", expected: "dnekcab", match: "exact" },
  {
    prompt: "Return JSON with status equal to ok",
    expected: '{"status":"ok"}',
    match: "json",
  },
  {
    prompt: "What is the capital of France?",
    expected: "Paris",
    match: "contains",
  },
];
const demo = import.meta.env.MODE === "recruiter";
const demoApi = demo ? createDemoApi(starter) : null;
const percent = (x: number) => (x * 100).toFixed(1) + "%";
const ms = (x: number | null) =>
  x === null
    ? "—"
    : x < 1
      ? "<1 ms"
      : x.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " ms";
const money = (x: number | null) =>
  x === null ? "Not priced" : "$" + x.toFixed(6);
const terminal = (r: Run) => !["running", "queued"].includes(r.status);
function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <Activity size={22} />
      </span>{" "}
      gauge<span className="brand-dot">.</span>
    </span>
  );
}
function Instrument() {
  return (
    <div className="instrument" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <span />
      <b />
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon" onClick={close} aria-label="Close dialog">
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function App() {
  const [authenticated, setAuthenticated] = useState(false),
    [boot, setBoot] = useState(true),
    [backendUnavailable, setBackendUnavailable] = useState(false),
    [csrf, setCsrf] = useState(""),
    [providers, setProviders] = useState<Provider[]>([]),
    [accessKey, setAccessKey] = useState(""),
    [page, setPage] = useState("Runs"),
    [datasets, setDatasets] = useState<Dataset[]>([]),
    [runs, setRuns] = useState<Run[]>([]),
    [selected, setSelected] = useState<Run | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(""),
    [filter, setFilter] = useState(""),
    [query, setQuery] = useState(""),
    [loaded, setLoaded] = useState(false),
    [datasetName, setDatasetName] = useState(""),
    [description, setDescription] = useState(""),
    [cases, setCases] = useState<TestCase[]>([blankCase]),
    [caseJson, setCaseJson] = useState(""),
    [caseMode, setCaseMode] = useState<"form" | "json">("form"),
    [datasetId, setDatasetId] = useState(""),
    [runName, setRunName] = useState(""),
    [provider, setProvider] = useState("mock"),
    [model, setModel] = useState("deterministic-v1"),
    [instruction, setInstruction] = useState(""),
    [maxTokens, setMaxTokens] = useState(256),
    [inputPrice, setInputPrice] = useState(""),
    [outputPrice, setOutputPrice] = useState(""),
    [baseline, setBaseline] = useState(""),
    [candidate, setCandidate] = useState(""),
    [comparison, setComparison] = useState<Comparison | null>(null),
    [datasetView, setDatasetView] = useState<{
      name: string;
      cases: TestCase[];
    } | null>(null);
  const selectedId = useRef("");
  selectedId.current = selected?.id || "";
  async function api(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    if (csrf) headers.set("X-CSRF-Token", csrf);
    const r = await (demoApi
      ? demoApi(path, init)
      : fetch("/api" + path, { ...init, headers }));
    if (!r.ok) {
      if (r.status === 401) setAuthenticated(false);
      const d = await r.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(
        typeof d.detail === "string"
          ? d.detail
          : "Please check the input format and limits.",
      );
    }
    return r;
  }
  async function initialize() {
    try {
      const d = await (await api("/me")).json();
      setCsrf(d.csrf);
      setProviders(d.providers);
      setBackendUnavailable(false);
      setAuthenticated(true);
    } catch (e) {
      setBackendUnavailable((e as Error).message !== "Sign in required");
    } finally {
      setBoot(false);
    }
  }
  async function refresh() {
    const [ds, rs] = await Promise.all([
      api("/datasets").then((r) => r.json()),
      api("/runs").then((r) => r.json()),
    ]);
    setDatasets(ds);
    setRuns(rs);
    setLoaded(true);
    setDatasetId((current) => current || ds[0]?.id || "");
    const rid = selectedId.current;
    if (rid) {
      const detail = await (await api("/runs/" + rid)).json();
      if (selectedId.current === rid) setSelected(detail);
    }
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void initialize();
  }, []);
  useEffect(() => {
    if (authenticated) void refresh().catch((e) => setError(e.message));
  }, [authenticated]);
  useEffect(() => {
    if (!authenticated || !runs.some((r) => !terminal(r))) return;
    const t = setInterval(
      () => void refresh().catch((e) => setError(e.message)),
      1500,
    );
    return () => clearInterval(t);
  }, [authenticated, runs]);
  function navigate(name: string) {
    setPage(name);
    setSelected(null);
    setDatasetView(null);
    setError("");
    setNotice("");
    setFilter("");
    setQuery("");
  }
  const completed = runs.filter((r) => r.status === "completed");
  const active = runs.filter((r) => !terminal(r));
  const searchTerm = query.trim().toLowerCase();
  const visibleRuns = runs.filter(
    (run) =>
      (!filter || run.status === filter) &&
      [run.name, run.dataset_name, run.model].some((value) =>
        value.toLowerCase().includes(searchTerm),
      ),
  );
  const baselineRun = completed.find((run) => run.id === baseline);
  const candidates = completed.filter(
    (run) =>
      run.id !== baseline &&
      (!baselineRun || run.fingerprint === baselineRun.fingerprint),
  );
  async function openRun(id: string) {
    await action(async () => {
      setSelected(await (await api("/runs/" + id)).json());
      setPage("Runs");
    });
  }
  async function exportRun() {
    if (!selected) return;
    const data = await (await api("/runs/" + selected.id)).json();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    a.download = "gauge-run-" + selected.id + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  if (boot)
    return (
      <div className="center">
        <LoaderCircle className="spin" /> Opening Gauge…
      </div>
    );
  if (!authenticated)
    return (
      <main className="login">
        <section className="login-identity">
          <Brand />
          <Instrument />
          <div className="login-identity-copy">
            <h2>
              AI evaluations,
              <br />
              case by case.
            </h2>
            <p>
              Test model behavior, inspect every output, and compare releases
              against the same dataset.
            </p>
          </div>
        </section>
        <section className="login-card">
          <h1>{demo ? "Explore Gauge" : "Sign in to Gauge"}</h1>
          {demo ? (
            <div className="service-status">
              <p>
                Explore sample runs, create datasets, and compare mock results.
                Changes stay in this browser tab.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await api("/session", { method: "POST" });
                    await initialize();
                  })
                }
              >
                Open demo <ArrowRight size={16} />
              </button>
            </div>
          ) : backendUnavailable ? (
            <div className="service-status">
              <p role="status">
                The Gauge backend is unavailable. Connect a running backend to
                sign in and start evaluations.
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void action(initialize)}
              >
                Retry connection
              </button>
            </div>
          ) : (
            <>
              <p>
                Use your operator access key to open the evaluation workspace.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    const d = await (
                      await api("/session", {
                        method: "POST",
                        body: JSON.stringify({ key: accessKey }),
                      })
                    ).json();
                    setAccessKey("");
                    setCsrf(d.csrf);
                    await initialize();
                  });
                }}
              >
                <label htmlFor="access">Operator access key</label>
                <input
                  id="access"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder="Enter your configured access key"
                />
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    "Open workspace"
                  )}
                  <ArrowRight size={16} />
                </button>
              </form>
              {error && (
                <div className="alert error" role="alert">
                  {error}
                </div>
              )}
              <div className="login-foot">
                <ShieldCheck size={15} /> Server-side session
              </div>
            </>
          )}
        </section>
      </main>
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          href="/"
          className="brand-link"
          onClick={(event) => {
            event.preventDefault();
            navigate("Runs");
          }}
          aria-label="Gauge home"
        >
          <Brand />
        </a>
        <div className="workspace">
          <span className="workspace-symbol">
            <Layers3 size={17} />
          </span>
          <div>
            <strong>Evaluation workspace</strong>
            <small>Single operator</small>
          </div>
        </div>
        <span className="nav-label">Workspace</span>
        <nav aria-label="Main navigation">
          {[
            { name: "Runs", icon: FlaskConical },
            { name: "Datasets", icon: Database },
            { name: "Compare", icon: GitCompareArrows },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              onClick={() => navigate(name)}
              className={"nav-item " + (page === name ? "selected" : "")}
            >
              <Icon size={17} />
              {name}
              {name === "Runs" && active.length > 0 && (
                <span className="nav-count">{active.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="logout"
            onClick={() =>
              void action(async () => {
                await api("/session", { method: "DELETE" });
                setAuthenticated(false);
                setCsrf("");
              })
            }
          >
            <span className="avatar">OP</span>
            <span>
              <strong>Operator</strong>
              <small>Workspace administrator</small>
            </span>
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            Workspace <span>/</span>
            <strong>{page}</strong>
            {selected && (
              <>
                <span>/</span>
                <strong>Run details</strong>
              </>
            )}
          </div>
          <span className="top-note">
            <span className="dot" />{" "}
            {providers.some((p) => p.id === "openai")
              ? "Mock + OpenAI configured"
              : demo
                ? "Recruiter demo · browser only"
                : "Mock provider available"}
          </span>
          <button
            className="icon mobile-logout"
            aria-label="Sign out"
            onClick={() =>
              void action(async () => {
                await api("/session", { method: "DELETE" });
                setAuthenticated(false);
              })
            }
          >
            <LogOut size={16} />
          </button>
        </header>
        <main className="content">
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button
                className="icon"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}
          {page === "Runs" && !selected && (
            <>
              <div className="page-head runs-head">
                <Instrument />
                <div>
                  <h1>Evaluation runs</h1>
                  <p>Track evaluations and inspect individual test results.</p>
                </div>
                <button
                  className="primary"
                  disabled={!loaded}
                  onClick={() => {
                    if (!datasets.length) {
                      setModal("dataset");
                      setNotice("Create a dataset before starting a run.");
                    } else {
                      setRunName("");
                      setModal("run");
                    }
                  }}
                >
                  <Plus size={16} /> New evaluation
                </button>
              </div>
              <div className="stats">
                <div>
                  <span>
                    Total runs
                    <span className="stat-icon">
                      <FlaskConical size={17} />
                    </span>
                  </span>
                  <strong>{loaded ? runs.length : "—"}</strong>
                  <small>Latest 100 evaluations</small>
                </div>
                <div>
                  <span>
                    In progress
                    <span className="stat-icon">
                      <Clock3 size={17} />
                    </span>
                  </span>
                  <strong>
                    {loaded ? active.length : "—"}
                    <span
                      className={"stat-dot " + (active.length ? "live" : "")}
                    />
                  </strong>
                  <small>Queued or processing</small>
                </div>
                <div>
                  <span>
                    Completed
                    <span className="stat-icon">
                      <CircleCheck size={17} />
                    </span>
                  </span>
                  <strong>{loaded ? completed.length : "—"}</strong>
                  <small>Ready for comparison</small>
                </div>
                <div>
                  <span>
                    Datasets
                    <span className="stat-icon">
                      <Database size={17} />
                    </span>
                  </span>
                  <strong>{loaded ? datasets.length : "—"}</strong>
                  <small>Latest 100 datasets</small>
                </div>
              </div>
              <div className="list-head">
                <div>
                  <h2>Recent evaluations</h2>
                </div>
                <div className="list-tools">
                  <label className="search-field">
                    <Search size={16} aria-hidden="true" />
                    <input
                      type="search"
                      aria-label="Search evaluations"
                      placeholder="Search evaluations…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filter runs"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {[
                      "queued",
                      "running",
                      "completed",
                      "cancelled",
                      "interrupted",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <section className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>EVALUATION</th>
                      <th>STATUS</th>
                      <th>PASS RATE</th>
                      <th>P95 LATENCY</th>
                      <th>PROVIDER</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRuns.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <button
                            className="row-link"
                            onClick={() => void openRun(r.id)}
                          >
                            {r.name}
                          </button>
                          <small>
                            {r.dataset_name} · {r.model}
                          </small>
                        </td>
                        <td>
                          <span className={"badge " + r.status}>
                            <span className="dot" />
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <strong>{percent(r.summary.pass_rate)}</strong>
                          <small>
                            {r.summary.completed}/{r.summary.total} evaluated
                          </small>
                        </td>
                        <td>{ms(r.summary.p95_ms)}</td>
                        <td>
                          <span className="provider-tag">
                            {r.provider === "mock" ? "MOCK" : "OPENAI"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="icon"
                            title={"Open " + r.name}
                            onClick={() => void openRun(r.id)}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!loaded && (
                  <div className="empty" role="status">
                    {error
                      ? "Evaluations unavailable."
                      : "Loading evaluations…"}
                  </div>
                )}
                {loaded && !runs.length && (
                  <div className="empty">
                    <FlaskConical size={26} />
                    <h3>No evaluations yet</h3>
                    <p>
                      {datasets.length
                        ? "Run an evaluation using an existing dataset."
                        : "Create a dataset with prompts and expected outputs to start evaluating."}
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        setModal(datasets.length ? "run" : "dataset")
                      }
                    >
                      <Plus size={15} />{" "}
                      {datasets.length
                        ? "Start an evaluation"
                        : "Create a dataset"}
                    </button>
                  </div>
                )}
                {runs.length > 0 && !visibleRuns.length && (
                  <div className="empty">
                    <Search size={24} />
                    <h3>No matching evaluations</h3>
                    <button
                      className="secondary"
                      onClick={() => {
                        setQuery("");
                        setFilter("");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </section>
              <div className="info-strip">
                <ShieldCheck size={15} />
                <p>
                  Pass rate is calculated across all cases in the dataset,
                  including cases with errors.
                </p>
              </div>
            </>
          )}
          {selected && page === "Runs" && (
            <>
              <button className="back" onClick={() => setSelected(null)}>
                <ArrowLeft size={14} /> All evaluations
              </button>
              <div className="page-head">
                <div>
                  <span className="eyebrow">
                    RUN / {selected.id.slice(0, 8)}
                  </span>
                  <h1>{selected.name}</h1>
                  <p>
                    {selected.dataset_name} <span className="separator">/</span>{" "}
                    {selected.model}{" "}
                    <span className="provider-tag">
                      {selected.provider === "mock" ? "MOCK" : "OPENAI"}
                    </span>
                  </p>
                </div>
                <div className="actions">
                  {!terminal(selected) && (
                    <button
                      className="secondary"
                      disabled={busy || selected.cancel_requested}
                      onClick={() =>
                        void action(async () => {
                          await api("/runs/" + selected.id + "/cancel", {
                            method: "POST",
                          });
                          await refresh();
                        })
                      }
                    >
                      <Square size={13} />
                      {selected.cancel_requested ? "Stopping…" : "Cancel run"}
                    </button>
                  )}
                  <button
                    className="secondary"
                    onClick={() => void action(exportRun)}
                  >
                    <Download size={15} /> Export JSON
                  </button>
                </div>
              </div>
              <div className="run-state">
                <span className={"badge " + selected.status}>
                  <span className="dot" />
                  {selected.status}
                </span>
                <span>
                  {selected.summary.completed} of {selected.summary.total} cases
                  evaluated
                </span>
                <progress
                  aria-label="Cases evaluated"
                  max={selected.summary.total}
                  value={selected.summary.completed}
                />
              </div>
              {selected.error && (
                <div className="alert error">{selected.error}</div>
              )}
              <div className="stats">
                <div>
                  <span>
                    Pass rate{" "}
                    {selected.summary.completed < selected.summary.total &&
                      "· partial"}
                  </span>
                  <strong>{percent(selected.summary.pass_rate)}</strong>
                  <small>
                    {selected.summary.passed} / {selected.summary.total} total
                    cases
                  </small>
                </div>
                <div>
                  <span>P95 latency</span>
                  <strong className="smaller">
                    {ms(selected.summary.p95_ms)}
                  </strong>
                  <small>Successful requests only</small>
                </div>
                <div>
                  <span>Reported output tokens</span>
                  <strong>
                    {selected.summary.output_tokens.toLocaleString()}
                  </strong>
                  <small>
                    {selected.provider === "mock"
                      ? "Mock · zero billable tokens"
                      : selected.summary.usage_complete
                        ? "Provider-reported usage"
                        : "Partial or unknown usage"}
                  </small>
                </div>
                <div>
                  <span>
                    {selected.provider === "mock"
                      ? "Mock cost"
                      : "Estimated cost"}
                  </span>
                  <strong className="smaller">
                    {money(selected.summary.cost_usd)}
                  </strong>
                  <small>
                    {selected.provider === "mock"
                      ? "No external requests"
                      : selected.summary.cost_complete
                        ? "User-supplied token prices"
                        : "Unpriced or incomplete"}
                  </small>
                </div>
              </div>
              <div className="list-head">
                <div>
                  <h2>Case results</h2>
                  <p>
                    Expected behavior, actual output, and a transparent verdict.
                  </p>
                </div>
                <span className="muted">
                  {selected.summary.errors} errors ·{" "}
                  {selected.summary.forbidden_hits} forbidden-term hits
                </span>
              </div>
              <div className="result-list">
                {selected.results?.map((r) => (
                  <details className="panel result" key={r.position}>
                    <summary>
                      <span
                        className={"verdict " + (r.passed ? "pass" : "fail")}
                      >
                        {r.passed ? <Check size={14} /> : <X size={14} />}
                      </span>
                      <span className="case-prompt">
                        <span className="case-number">
                          {String(r.position + 1).padStart(2, "0")}
                        </span>
                        {r.prompt}
                      </span>
                      <span className="result-latency">{ms(r.latency_ms)}</span>
                      <span
                        className={
                          "badge " +
                          (r.passed
                            ? "completed"
                            : r.error
                              ? "interrupted"
                              : "failed")
                        }
                      >
                        {r.error ? "error" : r.passed ? "passed" : "failed"}
                      </span>
                      <ChevronDown size={14} />
                    </summary>
                    <div className="result-body">
                      <div>
                        <label>
                          EXPECTED <span>{r.match}</span>
                        </label>
                        <pre>{r.expected}</pre>
                      </div>
                      <div>
                        <label>ACTUAL OUTPUT</label>
                        <pre>{r.output ?? "No output recorded."}</pre>
                      </div>
                      {r.error && <div className="alert error">{r.error}</div>}
                      {r.forbidden_hit && (
                        <p className="danger">
                          Output matched a forbidden term. This check is a
                          substring assertion, not a comprehensive safety
                          assessment.
                        </p>
                      )}
                      <p className="micro">
                        Input tokens: {r.input_tokens ?? "unknown"} · Output
                        tokens: {r.output_tokens ?? "unknown"} ·{" "}
                        {money(r.cost_usd)}
                      </p>
                    </div>
                  </details>
                ))}
                {!selected.results?.length && (
                  <div className="panel empty">
                    <Clock3 size={25} />
                    <h3>
                      {selected.status === "cancelled"
                        ? "Cancelled before processing"
                        : "Waiting for case results"}
                    </h3>
                    <p>The worker processes cases in the background.</p>
                  </div>
                )}
              </div>
              <details className="panel configuration">
                <summary>
                  Reproducibility details <ChevronDown size={14} />
                </summary>
                <dl>
                  <dt>Dataset SHA-256</dt>
                  <dd>{selected.fingerprint}</dd>
                  <dt>Maximum output tokens per case</dt>
                  <dd>{selected.max_tokens}</dd>
                  <dt>System instruction</dt>
                  <dd>{selected.instruction || "None"}</dd>
                  <dt>Created</dt>
                  <dd>{new Date(selected.created).toLocaleString()}</dd>
                </dl>
              </details>
            </>
          )}
          {page === "Datasets" && (
            <>
              <div className="page-head">
                <div>
                  <h1>Datasets</h1>
                  <p>
                    Manage the prompts and expected outputs used in evaluations.
                  </p>
                </div>
                <button className="primary" onClick={() => setModal("dataset")}>
                  <Plus size={16} /> New dataset
                </button>
              </div>
              <div className="dataset-grid">
                {datasets.map((d) => (
                  <button
                    className="panel dataset-card"
                    key={d.id}
                    onClick={() =>
                      void action(async () => {
                        setDatasetView(
                          await (await api("/datasets/" + d.id)).json(),
                        );
                      })
                    }
                  >
                    <div className="dataset-icon">
                      <Database size={20} />
                    </div>
                    <span className="dataset-count">{d.count} cases</span>
                    <h2>{d.name}</h2>
                    <p>{d.description || "No description provided."}</p>
                    <div className="dataset-footer">
                      <code>{d.fingerprint.slice(0, 12)}</code>
                      <span>
                        Inspect dataset <ArrowUpRight size={13} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {!loaded && (
                <section className="panel empty" role="status">
                  {error ? "Datasets unavailable." : "Loading datasets…"}
                </section>
              )}
              {loaded && !datasets.length && (
                <section className="panel empty">
                  <Database size={28} />
                  <h3>No datasets yet</h3>
                  <p>
                    Create your own assertions or load the synthetic starter
                    examples.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setModal("dataset")}
                  >
                    Create a dataset <Plus size={15} />
                  </button>
                </section>
              )}
              <div className="info-strip">
                <Layers3 size={15} />
                <p>
                  Each evaluation keeps a snapshot of its dataset. Create a new
                  dataset to change test cases.
                </p>
              </div>
              {datasetView && (
                <Modal
                  title={datasetView.name}
                  close={() => setDatasetView(null)}
                >
                  <div className="dataset-cases">
                    {datasetView.cases.map((c, i) => (
                      <div key={i}>
                        <span className="eyebrow">
                          CASE {i + 1} · {c.match.toUpperCase()}
                        </span>
                        <strong>{c.prompt}</strong>
                        <pre>{c.expected}</pre>
                        {!!c.forbidden?.length && (
                          <p className="micro">
                            Forbidden terms: {c.forbidden.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Modal>
              )}
            </>
          )}
          {page === "Compare" && (
            <>
              <div className="page-head">
                <div>
                  <h1>Compare evaluations</h1>
                  <p>
                    Find regressions and improvements on the same test
                    collection.
                  </p>
                </div>
              </div>
              <form
                className="panel compare-picker"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    setComparison(
                      await (
                        await api(
                          "/compare?baseline=" +
                            encodeURIComponent(baseline) +
                            "&candidate=" +
                            encodeURIComponent(candidate),
                        )
                      ).json(),
                    );
                  });
                }}
              >
                <div>
                  <label htmlFor="baseline">Baseline run</label>
                  <select
                    id="baseline"
                    required
                    value={baseline}
                    onChange={(e) => {
                      const next = completed.find(
                        (run) => run.id === e.target.value,
                      );
                      setBaseline(e.target.value);
                      if (
                        next &&
                        !completed.some(
                          (run) =>
                            run.id === candidate &&
                            run.id !== next.id &&
                            run.fingerprint === next.fingerprint,
                        )
                      )
                        setCandidate("");
                      setComparison(null);
                    }}
                  >
                    <option value="">Choose a completed run</option>
                    {completed.map((r) => (
                      <option value={r.id} key={r.id}>
                        {r.name} · {r.model}
                      </option>
                    ))}
                  </select>
                </div>
                <GitCompareArrows size={19} />
                <div>
                  <label htmlFor="candidate">Candidate run</label>
                  <select
                    id="candidate"
                    required
                    value={candidate}
                    onChange={(e) => {
                      setCandidate(e.target.value);
                      setComparison(null);
                    }}
                  >
                    <option value="">
                      {baseline && !candidates.length
                        ? "No matching completed runs"
                        : "Choose a completed run"}
                    </option>
                    {candidates.map((r) => (
                      <option value={r.id} key={r.id}>
                        {r.name} · {r.model}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="primary"
                  disabled={
                    busy || !baseline || !candidate || baseline === candidate
                  }
                >
                  Compare <ArrowRight size={15} />
                </button>
              </form>
              {comparison ? (
                <>
                  <div className="stats compare-stats">
                    <div>
                      <span>Pass-rate change</span>
                      <strong>
                        {comparison.pass_rate_delta > 0 ? "+" : ""}
                        {(comparison.pass_rate_delta * 100).toFixed(1)}
                        <em> pp</em>
                      </strong>
                      <small>
                        {percent(comparison.baseline.summary.pass_rate)} →{" "}
                        {percent(comparison.candidate.summary.pass_rate)}
                      </small>
                    </div>
                    <div>
                      <span>Regressions</span>
                      <strong>{comparison.regressions}</strong>
                      <small>Previously passed, now failed</small>
                    </div>
                    <div>
                      <span>Improvements</span>
                      <strong>{comparison.improvements}</strong>
                      <small>Previously failed, now passed</small>
                    </div>
                  </div>
                  <section className="panel table-wrap comparison-table">
                    <table>
                      <thead>
                        <tr>
                          <th>TEST CASE</th>
                          <th>BASELINE</th>
                          <th>CANDIDATE</th>
                          <th>CHANGE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.cases.map((c) => (
                          <tr key={c.position}>
                            <td>
                              <details className="comparison-case">
                                <summary>
                                  {c.prompt}
                                  <ChevronDown size={14} />
                                </summary>
                                <div className="comparison-outputs">
                                  <div>
                                    <strong>Baseline output</strong>
                                    <pre>
                                      {c.baseline_output ??
                                        "No output recorded."}
                                    </pre>
                                  </div>
                                  <div>
                                    <strong>Candidate output</strong>
                                    <pre>
                                      {c.candidate_output ??
                                        "No output recorded."}
                                    </pre>
                                  </div>
                                </div>
                              </details>
                            </td>
                            <td>
                              <span
                                className={
                                  "badge " +
                                  (c.baseline ? "completed" : "failed")
                                }
                              >
                                {c.baseline ? "Passed" : "Failed"}
                              </span>
                            </td>
                            <td>
                              <span
                                className={
                                  "badge " +
                                  (c.candidate ? "completed" : "failed")
                                }
                              >
                                {c.candidate ? "Passed" : "Failed"}
                              </span>
                            </td>
                            <td>
                              {c.baseline === c.candidate
                                ? "Unchanged"
                                : c.candidate
                                  ? "Improved"
                                  : "Regression"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                  <div className="info-strip">
                    <ShieldCheck size={15} />
                    <p>
                      Matched dataset fingerprints verified. Expand a case to
                      inspect both outputs.
                    </p>
                  </div>
                </>
              ) : (
                <section className="empty compare-empty">
                  <GitCompareArrows size={30} />
                  <h3>Select two completed runs</h3>
                  <p>Compare runs from the same dataset snapshot.</p>
                </section>
              )}
            </>
          )}
        </main>
      </div>
      {modal === "dataset" && (
        <Modal title="Create a dataset" close={() => setModal("")}>
          <p className="modal-intro">
            Define expected behavior with exact text, case-insensitive contains,
            or JSON equality.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const parsed =
                  caseMode === "json"
                    ? parseCaseJson(caseJson)
                    : normalizeCases(cases);
                await api("/datasets", {
                  method: "POST",
                  body: JSON.stringify({
                    name: datasetName,
                    description,
                    cases: parsed,
                  }),
                });
                await refresh();
                setModal("");
                setDatasetName("");
                setDescription("");
                setCases([blankCase]);
                setCaseJson("");
                setCaseMode("form");
                setPage("Datasets");
                setNotice("Dataset created. Its cases are immutable.");
              });
            }}
          >
            <label htmlFor="dataset-name">Dataset name</label>
            <input
              id="dataset-name"
              required
              maxLength={100}
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="e.g. Support response checks"
            />
            <label htmlFor="description">
              Description <span>optional</span>
            </label>
            <input
              id="description"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <DatasetCases
              cases={cases}
              setCases={setCases}
              json={caseJson}
              setJson={setCaseJson}
              mode={caseMode}
              setMode={setCaseMode}
              loadExamples={() => {
                setDatasetName(
                  (current) => current || "Text operations · starter",
                );
                setDescription(
                  (current) =>
                    current ||
                    "Six synthetic checks, including one the mock intentionally cannot answer.",
                );
                setCases(starter);
                setCaseJson(JSON.stringify(starter, null, 2));
              }}
            />
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setModal("")}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Create dataset <ArrowRight size={15} />
              </button>
            </div>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
          </form>
        </Modal>
      )}
      {modal === "run" && (
        <Modal title="New evaluation" close={() => setModal("")}>
          <p className="modal-intro">
            Each run stores its dataset snapshot and model configuration.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const r = await (
                  await api("/runs", {
                    method: "POST",
                    headers: { "Idempotency-Key": crypto.randomUUID() },
                    body: JSON.stringify({
                      dataset_id: datasetId,
                      name: runName,
                      provider,
                      model,
                      instruction,
                      max_tokens: maxTokens,
                      input_price:
                        inputPrice === "" ? null : Number(inputPrice),
                      output_price:
                        outputPrice === "" ? null : Number(outputPrice),
                    }),
                  })
                ).json();
                await refresh();
                setModal("");
                await openRun(r.id);
              });
            }}
          >
            <label htmlFor="run-name">Evaluation name</label>
            <input
              id="run-name"
              required
              maxLength={100}
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder="e.g. Release candidate 01"
            />
            <label htmlFor="run-dataset">Dataset</label>
            <select
              id="run-dataset"
              required
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.count} cases
                </option>
              ))}
            </select>
            <div className="form-grid">
              <div>
                <label htmlFor="provider">Provider</label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setModel(
                      providers.find((p) => p.id === e.target.value)!.models[0],
                    );
                  }}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="model">Model</label>
                <select
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {providers
                    .find((p) => p.id === provider)
                    ?.models.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                </select>
              </div>
            </div>
            <label htmlFor="instruction">
              System instruction <span>optional · ignored by mock</span>
            </label>
            <textarea
              id="instruction"
              rows={3}
              maxLength={2000}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <label htmlFor="max-tokens">Maximum output tokens per case</label>
            <input
              id="max-tokens"
              type="number"
              min={16}
              max={1000}
              required
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
            />
            {provider !== "mock" && (
              <details className="pricing">
                <summary>Optional cost estimation</summary>
                <p className="micro">
                  Enter your provider’s current USD prices per million tokens.
                  Costs are estimates, not billing records.
                </p>
                <div className="form-grid">
                  <div>
                    <label htmlFor="input-price">Input / 1M tokens</label>
                    <input
                      id="input-price"
                      type="number"
                      min="0"
                      step="any"
                      value={inputPrice}
                      onChange={(e) => setInputPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="output-price">Output / 1M tokens</label>
                    <input
                      id="output-price"
                      type="number"
                      min="0"
                      step="any"
                      value={outputPrice}
                      onChange={(e) => setOutputPrice(e.target.value)}
                    />
                  </div>
                </div>
              </details>
            )}
            <div className="info-strip">
              <FlaskConical size={15} />
              <p>
                {provider === "mock"
                  ? "Mock mode runs a small deterministic ruleset. It does not call an AI model."
                  : "This run sends each test prompt to OpenAI and may incur charges. Use provider-side spending limits."}
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setModal("")}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy || !datasetId}>
                <Play size={14} /> Start evaluation
              </button>
            </div>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
