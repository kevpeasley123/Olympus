import { runProjectRingHarness } from "./services/projectRing.harness";

const result = document.querySelector<HTMLPreElement>("#result");
if (!result) throw new Error("Harness result target is missing.");

try {
  const report = runProjectRingHarness();
  result.dataset.status = "passed";
  result.textContent = JSON.stringify(report, null, 2);
} catch (error) {
  result.dataset.status = "failed";
  result.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
}
