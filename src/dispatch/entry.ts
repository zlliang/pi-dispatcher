import { keyHint } from "@earendil-works/pi-coding-agent";
import { Box, Spacer, Text } from "@earendil-works/pi-tui";
import { formatModel } from "../utils/format";

import type { Usage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import type { CandidateConfig, ModelConfig } from "../utils/schema";
import type { DispatchDecision } from "./decision";

export const DISPATCH_ENTRY_TYPE = "dispatch";

export type DispatchEntryData = {
  decision: DispatchDecision;
  dispatcher: ModelConfig;
  candidates: CandidateConfig[];
  warnings: string[];
  usage: Usage | undefined;
};

export class DispatchEntryComponent extends Box {
  private data: DispatchEntryData;
  private theme: Theme;
  private expanded: boolean;

  constructor(data: DispatchEntryData, expanded: boolean, theme: Theme) {
    super(1, 1, (text) => theme.bg("customMessageBg", text));
    this.data = data;
    this.expanded = expanded;
    this.theme = theme;

    this.rebuild();
  }

  override invalidate(): void {
    super.invalidate();
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();

    const { provider, model, thinkingLevel } = this.data.decision;

    const label = this.theme.fg("customMessageLabel", this.theme.bold("[dispatch]"));
    const decision = this.theme.fg("customMessageText", formatModel(provider, model, thinkingLevel));
    const expandHint = !this.expanded && (this.data.decision.reason || this.data.warnings.length > 0)
      ? ` ${this.theme.fg("muted", "(")}${keyHint("app.tools.expand", "to expand")}${this.theme.fg("muted", ")")}`
      : "";
    this.addChild(new Text(`${label} ${decision}${expandHint}`, 0, 0));

    if (this.expanded && this.data.decision.reason) {
      this.addChild(new Spacer(1));
      this.addChild(new Text(this.theme.fg("customMessageText", this.data.decision.reason), 0, 0));
    }

    if (this.expanded && this.data.warnings.length > 0) {
      this.addChild(new Spacer(1));
      this.addChild(new Text(this.theme.fg("warning", `Warning: ${this.data.warnings.join(" ")}`), 0, 0));
    }
  }
}

export function registerDispatchEntry(pi: ExtensionAPI): void {
  pi.registerEntryRenderer<DispatchEntryData>(DISPATCH_ENTRY_TYPE, (entry, { expanded }, theme) => {
    if (!entry.data) return undefined;
    return new DispatchEntryComponent(entry.data, expanded, theme);
  });
}
