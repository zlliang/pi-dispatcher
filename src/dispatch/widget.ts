import { keyHint } from "@earendil-works/pi-coding-agent";
import { getKeybindings, Loader, truncateToWidth } from "@earendil-works/pi-tui";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "dispatcher";

export function setDispatchingWidget(ctx: ExtensionContext, cancel: () => void, warning?: string): () => void {
  ctx.ui.setWidget(WIDGET_KEY, (tui, theme) => {
    const loader = new Loader(tui, (text) => theme.fg("accent", text), (text) => theme.fg("muted", text), "Choosing a model...");
    loader.start();

    return {
      render: (width: number) => {
        const lines = loader.render(width);
        if (lines[0] === "") lines.shift();

        const loaderLine = `${(lines[0] ?? "").trimEnd()} (${keyHint("app.interrupt", "to cancel")})`;
        const line = `${loaderLine}${warning ? ` ${theme.fg("warning", `(Warning: ${warning})`)}` : ""}`;
        return [truncateToWidth(line, width), ""];
      },
      invalidate: () => loader.invalidate(),
      dispose: () => loader.stop(),
    };
  });

  return ctx.ui.onTerminalInput((data) => {
    if (!getKeybindings().matches(data, "app.interrupt")) return;
    cancel();
    return { consume: true };
  });
}

export function clearDispatchingWidget(ctx: ExtensionContext): void {
  ctx.ui.setWidget(WIDGET_KEY, undefined);
}
