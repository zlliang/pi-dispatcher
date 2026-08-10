import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

import { resolveCandidates } from "../src/dispatch/candidates";
import { buildDispatchPrompt, SYSTEM_PROMPT } from "../src/dispatch/prompt";
import { loadResources } from "../src/resources";

const { session } = await createAgentSession({
  cwd: process.cwd(),
  sessionManager: SessionManager.inMemory(),
});

try {
  const ctx = session.createReplacedSessionContext();
  const { config, rules } = loadResources(ctx);
  const { candidates, warnings } = await resolveCandidates(ctx, config.candidates ?? []);
  if (candidates.length === 0) {
    throw new Error(`Dispatcher has no usable candidates${warnings.length > 0 ? `: ${warnings.join("; ")}` : ""}`);
  }

  const userPrompt = buildDispatchPrompt({
    candidates,
    rules,
    cwd: ctx.cwd,
    currentModel: "openai-codex/gpt-5.6-sol:high",
    imageCount: 0,
    preference: "deepseek/deepseek-v4-flash:max",
    request: "This is an example request.",
  });

  const systemTokens = estimateTokens(SYSTEM_PROMPT);
  const userTokens = estimateTokens(userPrompt);

  printSectionTitle("[Dispatcher system prompt]");
  console.log(SYSTEM_PROMPT);
  printSectionTitle("\n[Dispatcher user prompt]");
  console.log(userPrompt);
  printSectionTitle("\n[Estimated tokens]");
  console.log(`System: ${systemTokens}`);
  console.log(`User: ${userTokens}`);
  console.log(`Total: ${systemTokens + userTokens}`);

  if (warnings.length > 0) {
    printSectionTitle("\n[Resolution warnings]");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
} finally {
  session.dispose();
}

function printSectionTitle(title: string): void {
  console.log(`\u001b[1;36m${title}\u001b[0m\n`);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
