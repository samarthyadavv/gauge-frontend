import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test("create a dataset, evaluate, inspect failures, export, compare and sign out", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Operator access key").fill(process.env.E2E_ADMIN_KEY!);
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Evaluation runs" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Datasets" })
    .click();
  await page.getByRole("button", { name: "New dataset" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Load starter examples" }).click();
  await dialog.getByRole("button", { name: "JSON", exact: true }).click();
  const jsonEditor = dialog.getByLabel("Test cases · JSON array");
  const starterJson = await jsonEditor.inputValue();
  await jsonEditor.fill("[");
  await dialog.getByRole("button", { name: "Form", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Fix the JSON syntax before switching to the form.",
  );
  await jsonEditor.fill(starterJson);
  await dialog.getByRole("button", { name: "Form", exact: true }).click();
  await expect(dialog.getByLabel("Prompt", { exact: true })).toHaveCount(6);
  await dialog.getByRole("button", { name: "Add case", exact: true }).click();
  await dialog.getByRole("button", { name: "Remove case 7" }).click();
  const name = "Browser suite " + Date.now();
  await dialog.getByLabel("Dataset name").fill(name);
  await dialog
    .getByRole("button", { name: "Create dataset", exact: false })
    .click();
  await expect(dialog).toHaveCount(0);
  const runNames = ["Baseline " + Date.now(), "Candidate " + Date.now()];
  for (const runName of runNames) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Runs" })
      .click();
    await page.getByRole("button", { name: "New evaluation" }).click();
    await page.getByRole("dialog").getByLabel("Evaluation name").fill(runName);
    await page
      .getByRole("dialog")
      .getByLabel("Dataset", { exact: true })
      .selectOption({ label: name + " · 6 cases" });
    await page.getByRole("button", { name: "Start evaluation" }).click();
    await expect(page.locator(".run-state .badge")).toHaveText("completed", {
      timeout: 30000,
    });
    await expect(page.locator(".result")).toHaveCount(6);
    await expect(page.locator(".stats")).toContainText("83.3%");
  }
  await page.getByRole("button", { name: "All evaluations" }).click();
  await page
    .getByRole("searchbox", { name: "Search evaluations" })
    .fill(runNames[0]);
  await expect(
    page.getByRole("button", { name: runNames[0], exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: runNames[1], exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Filter runs" })
    .selectOption("running");
  await expect(
    page.getByRole("heading", { name: "No matching evaluations" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByRole("button", { name: runNames[1], exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/workspace.png", fullPage: true });
  await page.getByRole("button", { name: runNames[1], exact: true }).click();
  await page.locator(".result").last().locator("summary").click();
  await expect(page.locator(".result").last()).toContainText(
    "Mock provider: no supported instruction.",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/run-desktop.png",
    fullPage: true,
  });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await pending;
  await download.saveAs("test-results/export.json");
  const exported = JSON.parse(
    await fs.readFile("test-results/export.json", "utf8"),
  );
  expect(exported.summary.passed).toBe(5);
  expect(exported.results).toHaveLength(6);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/run-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Compare" })
    .click();
  await page
    .getByLabel("Baseline run")
    .selectOption({ label: runNames[0] + " · deterministic-v1" });
  await page
    .getByLabel("Candidate run")
    .selectOption({ label: runNames[1] + " · deterministic-v1" });
  await page
    .getByRole("button", { name: "Compare", exact: false })
    .filter({ hasText: "Compare" })
    .last()
    .click();
  await expect(
    page.getByText("Matched dataset fingerprints verified.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".compare-stats")).toContainText("0.0");
  await page.locator(".comparison-case summary").first().click();
  await expect(
    page
      .locator(".comparison-outputs")
      .first()
      .getByText("RELEASE READY", { exact: true }),
  ).toHaveCount(2);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Operator access key")).toBeVisible();
});
