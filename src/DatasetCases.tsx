import { useState } from "react";
import { Braces, List, Plus, Trash2 } from "lucide-react";

export type TestCase = {
  prompt: string;
  expected: string;
  match: "exact" | "contains" | "json";
  forbidden?: string[];
};

export const blankCase: TestCase = { prompt: "", expected: "", match: "exact" };

function readCases(text: string): TestCase[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) {
    throw new Error("Enter a JSON array with 1–100 test cases.");
  }
  return parsed.map((value, index) => {
    if (
      !value ||
      typeof value.prompt !== "string" ||
      typeof value.expected !== "string" ||
      ![undefined, "exact", "contains", "json"].includes(value.match) ||
      (value.forbidden !== undefined &&
        (!Array.isArray(value.forbidden) ||
          value.forbidden.some((term: unknown) => typeof term !== "string")))
    ) {
      throw new Error(
        `Case ${index + 1} has an invalid prompt, expected value, rule, or forbidden-term list.`,
      );
    }
    return { ...value, match: value.match ?? "exact" };
  });
}

export function DatasetCases({
  cases,
  setCases,
  json,
  setJson,
  mode,
  setMode,
  loadExamples,
}: {
  cases: TestCase[];
  setCases: (value: TestCase[]) => void;
  json: string;
  setJson: (value: string) => void;
  mode: "form" | "json";
  setMode: (value: "form" | "json") => void;
  loadExamples: () => void;
}) {
  const [conversionError, setConversionError] = useState("");
  function switchMode(next: "form" | "json") {
    if (mode === next) return;
    setConversionError("");
    if (next === "json") {
      setJson(JSON.stringify(normalizeCases(cases), null, 2));
    } else {
      try {
        setCases(readCases(json));
      } catch (error) {
        setConversionError(
          error instanceof SyntaxError
            ? "Fix the JSON syntax before switching to the form."
            : (error as Error).message,
        );
        return;
      }
    }
    setMode(next);
  }

  return (
    <section className="case-editor" aria-label="Dataset test cases">
      <div className="editor-toolbar">
        <div className="segmented" role="group" aria-label="Case editor mode">
          <button
            type="button"
            aria-pressed={mode === "form"}
            onClick={() => switchMode("form")}
          >
            <List size={14} /> Form
          </button>
          <button
            type="button"
            aria-pressed={mode === "json"}
            onClick={() => switchMode("json")}
          >
            <Braces size={14} /> JSON
          </button>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setConversionError("");
            loadExamples();
          }}
        >
          Load starter examples
        </button>
      </div>
      {mode === "json" ? (
        <>
          <label htmlFor="cases">Test cases · JSON array</label>
          <textarea
            id="cases"
            className="code-input"
            rows={9}
            required
            value={json}
            onChange={(event) => {
              setJson(event.target.value);
              setConversionError("");
            }}
          />
          {conversionError && (
            <p className="alert error" role="alert">
              {conversionError}
            </p>
          )}
        </>
      ) : (
        <>
          {cases.map((item, index) => {
            const update = (change: Partial<TestCase>) =>
              setCases(
                cases.map((entry, position) =>
                  position === index ? { ...entry, ...change } : entry,
                ),
              );
            return (
              <fieldset className="case-fields" key={index}>
                <legend>Case {index + 1}</legend>
                <button
                  type="button"
                  className="icon remove-case"
                  disabled={cases.length === 1}
                  aria-label={`Remove case ${index + 1}`}
                  onClick={() =>
                    setCases(cases.filter((_, position) => position !== index))
                  }
                >
                  <Trash2 size={16} />
                </button>
                <label htmlFor={`prompt-${index}`}>Prompt</label>
                <textarea
                  id={`prompt-${index}`}
                  rows={2}
                  required
                  maxLength={4000}
                  value={item.prompt}
                  onChange={(event) => update({ prompt: event.target.value })}
                />
                <div className="form-grid assertion-fields">
                  <div>
                    <label htmlFor={`expected-${index}`}>Expected output</label>
                    <textarea
                      id={`expected-${index}`}
                      rows={2}
                      required
                      maxLength={4000}
                      value={item.expected}
                      onChange={(event) =>
                        update({ expected: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor={`match-${index}`}>Match rule</label>
                    <select
                      id={`match-${index}`}
                      value={item.match}
                      onChange={(event) =>
                        update({
                          match: event.target.value as TestCase["match"],
                        })
                      }
                    >
                      <option value="exact">Exact text</option>
                      <option value="contains">Contains text</option>
                      <option value="json">JSON equality</option>
                    </select>
                  </div>
                </div>
                <label htmlFor={`forbidden-${index}`}>
                  Forbidden terms <span>optional · one per line</span>
                </label>
                <textarea
                  id={`forbidden-${index}`}
                  rows={1}
                  value={item.forbidden?.join("\n") ?? ""}
                  onChange={(event) =>
                    update({ forbidden: event.target.value.split("\n") })
                  }
                />
              </fieldset>
            );
          })}
          <button
            type="button"
            className="secondary"
            disabled={cases.length >= 100}
            onClick={() => setCases([...cases, { ...blankCase }])}
          >
            <Plus size={15} /> Add case
          </button>
        </>
      )}
    </section>
  );
}

export function normalizeCases(cases: TestCase[]) {
  return cases.map((item) => ({
    ...item,
    forbidden: item.forbidden?.filter((term) => term.trim()) ?? [],
  }));
}

export function parseCaseJson(json: string) {
  try {
    return readCases(json);
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("Cases must be a valid JSON array.");
    throw error;
  }
}
