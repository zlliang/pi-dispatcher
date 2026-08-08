import { registerDispatch } from "./src/dispatch";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * pi-dispatcher picks the model for a session so you don't have to. Dispatch runs once, before the
 * session's first request, so the whole session runs on one model and no prompt cache is built for
 * a model that is about to be replaced.
 */
export default function (pi: ExtensionAPI) {
  registerDispatch(pi);
}
