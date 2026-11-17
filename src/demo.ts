import type { TestCase } from "./DatasetCases";
import type { Dataset, Result, Run } from "./main";

type DemoDataset = Dataset & { cases: TestCase[] };
type RunInput = Pick<Run, "name" | "dataset_id" | "instruction" | "max_tokens">;

function mockOutput(prompt: string): string {
  const add = /^Add: (-?\d{1,6}) and (-?\d{1,6})$/.exec(prompt);
  if (add) return String(Number(add[1]) + Number(add[2]));
  if (prompt.startsWith("Uppercase: ")) return prompt.slice(11).toUpperCase();
  if (prompt.startsWith("Lowercase: ")) return prompt.slice(11).toLowerCase();
  if (prompt.startsWith("Reverse: "))
    return Array.from(prompt.slice(9)).reverse().join("");
  if (prompt === "Return JSON with status equal to ok")
    return '{"status":"ok"}';
  return "Mock provider: no supported instruction.";
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
}

function check(item: TestCase, output: string): boolean {
  if (item.match === "exact") return output.trim() === item.expected.trim();
  if (item.match === "contains")
    return output.toLowerCase().includes(item.expected.toLowerCase());
  try {
    return (
      canonicalJson(JSON.parse(output)) ===
      canonicalJson(JSON.parse(item.expected))
    );
  } catch {
    return false;
  }
}

async function makeDataset(
  name: string,
  description: string,
  cases: TestCase[],
): Promise<DemoDataset> {
  if (
    !name.trim() ||
    !cases.length ||
    cases.length > 100 ||
    cases.some((item) => !item.prompt.trim() || !item.expected.trim())
  ) {
    throw new Error(
      "Enter a dataset name and 1–100 cases with a prompt and expected output.",
    );
  }
  for (const item of cases) {
    if (item.match === "json") {
      try {
        JSON.parse(item.expected);
      } catch {
        throw new Error(
          "Expected output must be valid JSON when using the JSON rule.",
        );
      }
    }
  }
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(cases)),
  );
  const fingerprint = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    id: crypto.randomUUID(),
    name,
    description,
    cases,
    count: cases.length,
    fingerprint,
    created: new Date().toISOString(),
  };
}

function evaluate(input: RunInput, dataset: DemoDataset): Run {
  const results: Result[] = dataset.cases.map((item, position) => {
    const start = performance.now();
    const output = mockOutput(item.prompt);
    const latency_ms = performance.now() - start;
    const correct = check(item, output);
    const forbidden_hit = (item.forbidden ?? []).some((term) =>
      output.toLowerCase().includes(term.toLowerCase()),
    );
    return {
      ...item,
      position,
      output,
      correct,
      forbidden_hit,
      passed: correct && !forbidden_hit,
      latency_ms,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      error: null,
    };
  });
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  return {
    ...input,
    id: crypto.randomUUID(),
    dataset_name: dataset.name,
    fingerprint: dataset.fingerprint,
    provider: "mock",
    model: "deterministic-v1",
    status: "completed",
    cancel_requested: false,
    created: new Date().toISOString(),
    error: null,
    results,
    summary: {
      total,
      completed: total,
      passed,
      errors: 0,
      forbidden_hits: results.filter((result) => result.forbidden_hit).length,
      pass_rate: passed / total,
      p50_ms: null,
      p95_ms: null,
      input_tokens: 0,
      output_tokens: 0,
      usage_complete: true,
      cost_usd: 0,
      cost_complete: true,
    },
  };
}

export function createDemoApi(starter: TestCase[]) {
  const datasets: DemoDataset[] = [];
  const runs: Run[] = [];
  let open = false;
  let seed: Promise<void> | undefined;
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  return async function demoApi(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const url = new URL(path, "https://demo.invalid");
    const method = init.method ?? "GET";
    if (url.pathname === "/session" && method === "POST") {
      seed ??= makeDataset(
        "Text operations · sample",
        "Six synthetic cases, including one outside the mock provider’s rules.",
        starter,
      ).then((dataset) => {
        datasets.push(dataset);
        for (const name of ["Sample baseline", "Sample candidate"]) {
          runs.unshift(
            evaluate(
              {
                name,
                dataset_id: dataset.id,
                instruction: "",
                max_tokens: 256,
              },
              dataset,
            ),
          );
        }
      });
      await seed;
      open = true;
      return json({});
    }
    if (!open) return json({ detail: "Sign in required" }, 401);
    if (url.pathname === "/session" && method === "DELETE") {
      open = false;
      return json({ ok: true });
    }
    if (url.pathname === "/me")
      return json({
        csrf: "",
        providers: [
          {
            id: "mock",
            name: "Deterministic mock",
            models: ["deterministic-v1"],
          },
        ],
      });
    if (url.pathname === "/datasets") {
      if (method === "GET") return json(datasets);
      const { name, description, cases } = JSON.parse(String(init.body));
      try {
        const dataset = await makeDataset(name, description, cases);
        datasets.unshift(dataset);
        return json({ id: dataset.id }, 201);
      } catch (error) {
        return json({ detail: (error as Error).message }, 422);
      }
    }
    if (url.pathname === "/runs") {
      if (method === "GET") return json(runs);
      const input: RunInput = JSON.parse(String(init.body));
      const dataset = datasets.find((entry) => entry.id === input.dataset_id);
      if (!dataset) return json({ detail: "Dataset not found" }, 404);
      const run = evaluate(input, dataset);
      runs.unshift(run);
      return json({ id: run.id }, 201);
    }
    if (url.pathname === "/compare") {
      const baseline = runs.find(
        (run) => run.id === url.searchParams.get("baseline"),
      );
      const candidate = runs.find(
        (run) => run.id === url.searchParams.get("candidate"),
      );
      if (
        !baseline ||
        !candidate ||
        baseline.fingerprint !== candidate.fingerprint
      )
        return json(
          { detail: "Choose runs with the same dataset fingerprint." },
          422,
        );
      const cases = baseline.results!.map((result, index) => {
        const next = candidate.results![index];
        return {
          position: result.position,
          prompt: result.prompt,
          baseline: result.passed,
          candidate: next.passed,
          baseline_output: result.output,
          candidate_output: next.output,
        };
      });
      return json({
        baseline,
        candidate,
        cases,
        pass_rate_delta:
          candidate.summary.pass_rate - baseline.summary.pass_rate,
        regressions: cases.filter((item) => item.baseline && !item.candidate)
          .length,
        improvements: cases.filter((item) => !item.baseline && item.candidate)
          .length,
      });
    }
    const [, collection, id] = url.pathname.split("/");
    const entry = (
      collection === "datasets" ? datasets : collection === "runs" ? runs : []
    ).find((item) => item.id === id);
    return entry ? json(entry) : json({ detail: "Not found" }, 404);
  };
}
