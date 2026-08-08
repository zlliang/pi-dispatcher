import { DispatchManager } from "./manager";
import { registerDispatchEntry } from "./entry";
import { loadResources } from "../resources";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerDispatch(pi: ExtensionAPI): void {
  let dispatchManager: DispatchManager | undefined = undefined;

  registerDispatchEntry(pi);

  pi.on("session_start", (_event, ctx) => {
    const { config, rules } = loadResources(ctx);
    if (!config.candidates?.length) return;

    dispatchManager = new DispatchManager(pi, config, rules);
  });

  // Dispatch before the session's first request, so the whole session runs on one model and no
  // prompt cache is built for a model that is about to be replaced.
  pi.on("before_agent_start", async (event, ctx) => {
    await dispatchManager?.run(ctx, event);
  });

  pi.on("session_shutdown", () => {
    dispatchManager?.dispose();
    dispatchManager = undefined;
  });
}
