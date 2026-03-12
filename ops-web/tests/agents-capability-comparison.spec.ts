import { expect, test, type Locator, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

const listUrl = "/#/agents";
const dialogSurface = ".MuiDialog-paper";

test.describe.configure({ mode: "serial" });

async function openCapabilityComparison(page: Page, url: string = listUrl): Promise<Locator> {
  await page.goto(url);

  const trigger = page.getByRole("button", {
    name: "Сравнительная таблица Rules, Tools, Skills, MCP",
  });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.locator(dialogSurface).last();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Сравнительная таблица Rules, Tools, Skills, MCP", { exact: true })).toBeVisible();

  return dialog;
}

test.describe("Agents capability comparison", () => {
  test("updates UI freshness after final canonical event and capability snapshot publish", async ({ page }) => {
    const stamp = Date.now();
    const runId = `run-ui-refresh-${stamp}`;
    const taskId = `task-ui-refresh-${stamp}`;
    const traceId = `trace-ui-refresh-${stamp}`;

    execSync(
      [
        "python3 ../scripts/agent_telemetry.py log",
        "--agent-id analyst-agent",
        `--task-id ${taskId}`,
        `--run-id ${runId}`,
        `--trace-id ${traceId}`,
        "--step step_9_publish_snapshots",
        "--status completed",
        "--outcome \"ui freshness integration smoke\"",
        "--artifact-read docs/agents/registry.yaml",
        "--artifact-write artifacts/capability_trials/analyst-agent/capability_snapshot.json",
        "--tokens-in 21",
        "--tokens-out 13",
        "--enforce-step-contract warning",
        "--log-dir ../.logs/agents",
      ].join(" "),
      { stdio: "pipe" },
    );

    execSync(
      [
        "python3 ../scripts/agent_telemetry.py report",
        "--log-dir ../.logs/agents",
        "--out-json ../artifacts/agent_telemetry_summary.json",
        "--out-md ../artifacts/agent_telemetry_summary.md",
        "--out-cycle-json ../artifacts/agent_cycle_validation_report.json",
        "--out-latest-analyst-json public/generated/agent-latest-cycle-analyst.json",
        "--benchmark-summary-json ../artifacts/agent_benchmark_summary.json",
      ].join(" "),
      { stdio: "pipe" },
    );

    execSync("node scripts/build_content_index.mjs", { stdio: "pipe" });

    const dialog = await openCapabilityComparison(page, `/?v=${stamp}#/agents`);
    await expect(dialog.getByText("Run ID:", { exact: false })).toBeVisible();
    await expect(dialog.getByText("Freshness: Fresh", { exact: false })).toBeVisible();
  });

  test("shows snapshot-backed comparison table and capability journal", async ({ page }) => {
    const dialog = await openCapabilityComparison(page);

    await expect(dialog.getByText("Capability refresh:", { exact: false })).toBeVisible();
    await expect(dialog.getByText("Freshness:", { exact: false })).toBeVisible();
    await expect(dialog.getByText("Snapshot path:", { exact: false })).toBeVisible();
    await expect(dialog.getByText("Какие источники анализируются", { exact: true })).toBeVisible();
    await expect(dialog.getByText("skills.sh", { exact: true })).toBeVisible();
    await expect(dialog.getByText("QMD retrieval", { exact: true })).toBeVisible();
    await expect(dialog.getByText("openai-docs", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Нужен human approve", { exact: true }).first()).toBeVisible();

    await expect(page.getByText("Сводка", { exact: true }).first()).toBeVisible();
    await page.getByText("Сводка", { exact: true }).first().click();

    const journalDialog = page.locator(dialogSurface).last();
    await expect(journalDialog).toBeVisible();
    await expect(journalDialog.getByText("Журнал и сравнение capability", { exact: true })).toBeVisible();
    await expect(journalDialog.getByText("Capability:", { exact: false })).toBeVisible();
    await expect(journalDialog.getByText("Current contract", { exact: true })).toBeVisible();
    await expect(journalDialog.getByText("Candidate contract", { exact: true })).toBeVisible();
    await expect(journalDialog.getByText("Shadow-trial status", { exact: true })).toBeVisible();
    await expect(journalDialog.getByText("openai-docs", { exact: true })).toBeVisible();
    await expect(journalDialog.getByText("Связанные артефакты", { exact: true })).toBeVisible();
  });
});
