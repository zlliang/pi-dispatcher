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

  // Strip magic instructions before Pi expands and persists the first user request. The manager
  // keeps the parsed instruction until `before_agent_start` performs (or skips) dispatch.
  pi.on("input", (event, ctx) => {
    if (!dispatchManager) return { action: "continue" };

    const request = dispatchManager.prepareInput(ctx, event.text);
    if (request === event.text) return { action: "continue" };

    return { action: "transform", text: request, images: event.images };
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
