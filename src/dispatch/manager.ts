import { parseDecision } from "./decision";
import { buildDispatchPrompt, SYSTEM_PROMPT } from "./prompt";
import { resolveCandidates } from "./candidates";
import { clearDispatchingWidget, setDispatchingWidget } from "./widget";
import { DISPATCH_ENTRY_TYPE, type DispatchEntryData } from "./entry";
import { matchesModelPreference, parseMagicInstructions } from "./magic";
import { formatModel, sanitizeText } from "../utils/format";
import { completeBackground, resolveModelSettings } from "../utils/model";

import type { ModelThinkingLevel, SimpleStreamOptions, Usage } from "@earendil-works/pi-ai";
import type { BeforeAgentStartEvent, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { DispatchDecision } from "./decision";
import type { DispatchCandidate } from "./candidates";
import type { MagicInstruction } from "./magic";
import type { RuleFile } from "../resources";
import type { UserConfig } from "../utils/schema";
import type { ModelSettings } from "../utils/model";

const MAX_TOKENS = 500;
const TIMEOUT_MS = 15_000; // Dispatch blocks the session's first request, so give up quickly and keep the current model.

type DispatchOutcome = {
  decision: DispatchDecision;
  candidate: DispatchCandidate;
  dispatcher: DispatchEntryData["dispatcher"];
  usage: Usage | undefined;
};

export class DispatchManager {
  private pi: ExtensionAPI;
  private config: UserConfig;
  private rules: RuleFile[];
  private pendingInstruction: MagicInstruction | undefined;
  private inflight: AbortController | undefined;
  private attempted = false;

  constructor(pi: ExtensionAPI, config: UserConfig, rules: RuleFile[]) {
    this.pi = pi;
    this.config = config;
    this.rules = rules;
  }

  prepareInput(ctx: ExtensionContext, request: string): string {
    if (this.attempted || !this.isFirstPrompt(ctx)) return request;

    const parsed = parseMagicInstructions(request);
    this.pendingInstruction = parsed.instruction;

    return parsed.request;
  }

  /**
   * Dispatch the session once, before its first request.
   *
   * Everything here fails open: on a bad config, an unavailable dispatcher model, a timeout, or an
   * unrecognized answer, the session simply keeps the model the user already had.
   */
  async run(ctx: ExtensionContext, event: BeforeAgentStartEvent): Promise<void> {
    if (this.attempted || !this.isFirstPrompt(ctx)) return;

    // One attempt per session: a failed dispatch must not bill again on the next prompt.
    this.attempted = true;

    const instruction = this.pendingInstruction;
    this.pendingInstruction = undefined;
    if (instruction?.type === "keep") return;

    const { candidates, warnings: candidateWarnings } = await resolveCandidates(ctx, this.config.candidates ?? []);
    if (candidates.length === 0) {
      ctx.ui.notify(`Dispatcher has no usable candidate${candidateWarnings.length > 0 ? `: ${candidateWarnings.join("; ")}` : ""}`, "warning");
      return;
    }

    const controller = new AbortController();
    this.inflight = controller;

    try {
      const modelSettings = await resolveModelSettings(ctx, this.config.dispatcher ?? {}, "dispatcher");
      if (!modelSettings) return;

      const warnings = [...candidateWarnings];
      if (modelSettings.warning) warnings.push(modelSettings.warning);

      const preference = instruction?.preference;

      const outcome = await this.decideWithLoader(ctx, candidates, event, controller, modelSettings, warnings, preference);
      if (controller.signal.aborted || this.inflight !== controller || !outcome) return;

      const { decision, candidate, dispatcher } = outcome;
      const thinkingLevel = decision.thinkingLevel;
      const reason = decision.reason ? sanitizeText(decision.reason) : undefined;
      if (!(await this.apply(ctx, candidate, thinkingLevel))) return;

      if (preference && !matchesModelPreference(preference, decision)) {
        const warning = `Selected ${formatModel(decision.provider, decision.model, thinkingLevel)} does not match model preference ${sanitizeText(preference)}.`;
        warnings.push(warning);
      }

      this.pi.appendEntry<DispatchEntryData>(DISPATCH_ENTRY_TYPE, {
        decision: {
          provider: candidate.model.provider,
          model: candidate.model.id,
          thinkingLevel,
          reason,
        },
        dispatcher,
        candidates: candidates.map((entry) => ({
          provider: entry.model.provider,
          model: entry.model.id,
          thinkingLevels: entry.thinkingLevels,
          hint: entry.hint,
        })),
        preference,
        warnings,
        usage: outcome.usage,
      });
    } catch (error) {
      if (controller.signal.aborted || this.inflight !== controller) return;

      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Dispatch failed, keeping the current model: ${sanitizeText(message)}`, "warning");
    } finally {
      if (this.inflight === controller) this.inflight = undefined;
    }
  }

  dispose(): void {
    this.inflight?.abort();
    this.inflight = undefined;
  }

  private isFirstPrompt(ctx: ExtensionContext): boolean {
    return !ctx.sessionManager.getBranch().some((entry) => {
      if (entry.type === "message") return entry.message.role === "assistant";
      return entry.type === "custom" && entry.customType === DISPATCH_ENTRY_TYPE;
    });
  }

  private async decideWithLoader(ctx: ExtensionContext, candidates: DispatchCandidate[], event: BeforeAgentStartEvent, controller: AbortController, modelSettings: ModelSettings, warnings: string[], preference?: string): Promise<DispatchOutcome | undefined> {
    const stopListening = setDispatchingWidget(ctx, () => controller.abort(), warnings.join(" ") || undefined);

    try {
      return await this.decide(ctx, candidates, event, controller.signal, modelSettings, preference);
    } finally {
      stopListening();
      clearDispatchingWidget(ctx);
    }
  }

  private async decide(ctx: ExtensionContext, candidates: DispatchCandidate[], event: BeforeAgentStartEvent, signal: AbortSignal, modelSettings: ModelSettings, preference?: string): Promise<DispatchOutcome | undefined> {
    const { model, thinkingLevel } = modelSettings;

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) throw new Error(auth.error);

    const options: SimpleStreamOptions = { maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS, signal };
    if (auth.apiKey) options.apiKey = auth.apiKey;
    if (auth.headers) options.headers = auth.headers;
    if (auth.env) options.env = auth.env;
    if (thinkingLevel !== "off") options.reasoning = thinkingLevel;

    const prompt = buildDispatchPrompt({
      candidates,
      rules: this.rules,
      cwd: ctx.cwd,
      currentModel: formatModel(ctx.model?.provider, ctx.model?.id, this.pi.getThinkingLevel()),
      imageCount: event.images?.length ?? 0,
      preference,
      request: event.prompt,
    });

    const response = await completeBackground(model, {
      systemPrompt: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [{ type: "text", text: prompt }],
        timestamp: Date.now(),
      }],
    }, options);

    if (response.stopReason === "error") {
      throw new Error(response.errorMessage ?? "Dispatch request failed");
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const parsed = parseDecision(text, candidates);
    if (!parsed) throw new Error("No known candidate");

    return {
      ...parsed,
      dispatcher: { provider: model.provider, model: model.id, thinkingLevel },
      usage: response.usage,
    };
  }

  private async apply(ctx: ExtensionContext, candidate: DispatchCandidate, thinkingLevel: ModelThinkingLevel): Promise<boolean> {
    const current = ctx.model;
    if (current?.provider === candidate.model.provider && current?.id === candidate.model.id && this.pi.getThinkingLevel() === thinkingLevel) return true;

    const success = await this.pi.setModel(candidate.model);
    if (!success) {
      ctx.ui.notify(`Dispatcher could not switch to ${candidate.id}: no credentials available`, "error");
      return false;
    }

    this.pi.setThinkingLevel(thinkingLevel);

    return true;
  }
}
