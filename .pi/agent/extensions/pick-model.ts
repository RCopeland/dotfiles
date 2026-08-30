/**
 * pick-model
 *
 * Per-sub-agent model stacks with availability-aware fallback.
 *
 * Config: ~/.pi/agent/agent-models.json   (or $PI_CODING_AGENT_DIR/agent-models.json,
 *                                          or override entirely with $PI_AGENT_MODELS_CONFIG)
 *
 * ```json
 * {
 *   "default": ["provider/model-b", "provider/model-a"],
 *   "thinking": { "architect": "high" },
 *   "agents": {
 *     "architect": ["provider/model-flagship", "provider/model-b", "provider/model-fast"]
 *   }
 * }
 * ```
 *
 * The tool intersects the ordered stack with the live model registry
 * (which provider extensions like bansos already filter to available models)
 * and returns the highest-preference ALIVE model plus a suggested thinking
 * level. Pass the result straight into `subagent({ agent, model, thinking })`.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

interface Config {
  default: string[];
  thinking: Record<string, string>;
  agents: Record<string, string[]>;
}

function defaultConfigPath(): string {
  if (process.env.PI_AGENT_MODELS_CONFIG) return process.env.PI_AGENT_MODELS_CONFIG;
  const base = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
  return join(base, "agent-models.json");
}

const CONFIG_PATH = defaultConfigPath();

function loadConfig(): Config | null {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Record<string, unknown>;
    const asList = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
    if (!asList(raw.default).length && !Object.keys(raw.agents ?? {}).length) return null;
    const thinking: Record<string, string> = {};
    if (raw.thinking && typeof raw.thinking === "object") {
      for (const [k, v] of Object.entries(raw.thinking as Record<string, unknown>)) {
        if (typeof v === "string" && LEVELS.has(v)) thinking[k] = v;
      }
    }
    const agents: Record<string, string[]> = {};
    if (raw.agents && typeof raw.agents === "object") {
      for (const [k, v] of Object.entries(raw.agents as Record<string, unknown>)) {
        const list = asList(v);
        if (list.length) agents[k] = list;
      }
    }
    return { default: asList(raw.default), thinking, agents };
  } catch {
    return null;
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "pick-model",
    label: "Pick model",
    description:
      "Pick the best available model for a named sub-agent from its ordered preference stack (config: agent-models.json). " +
      "Returns the first model in the stack that exists in the live model registry (dead/unavailable models are skipped), " +
      "plus the thinking level configured for that agent (only when the chosen model supports reasoning). " +
      "Use BEFORE spawning: pass the returned model and thinking to subagent().",

    parameters: Type.Object({
      agent: Type.Optional(
        Type.String({ description: "Agent or role name to resolve, e.g. 'architect'. Falls back to 'default' stack." })
      ),
      models: Type.Optional(
        Type.Array(Type.String(), {
          description: "Optional explicit ordered preference list that overrides the configured stack for this call.",
        })
      ),
    }),

    async execute(toolCallId: string, params: { agent?: string; models?: string[] }, _signal: AbortSignal, _onUpdate: unknown, ctx: ExtensionContext) {
      const config = loadConfig();

      if (!config) {
        const text =
          `No model stack config found at ${CONFIG_PATH}.\n` +
          `Create it with per-agent preference lists, e.g.:\n` +
          `{ "default": ["provider/model"], "agents": { "architect": ["provider/model-flagship", "provider/model"] } }\n` +
          `Model IDs must match "pi --list-models" exactly (provider/model-id).`;
        return { content: [{ type: "text" as const, text }], isError: true, details: { configPath: CONFIG_PATH } };
      }

      const stack = params.models?.length ? params.models : (config.agents[params.agent ?? ""] ?? config.default);
      if (!stack.length) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No stack defined for agent "${params.agent ?? ""}" and no default stack configured.` +
                   ` Add one to ${CONFIG_PATH}.`,
            },
          ],
          isError: true,
          details: { configPath: CONFIG_PATH },
        };
      }

      const available = new Set(ctx.modelRegistry.getAvailable().map((m) => `${m.provider}/${m.id}`));
      const live = new Map(ctx.modelRegistry.getAvailable().map((m) => [`${m.provider}/${m.id}`, m]));

      const chosenId = stack.find((id) => available.has(id));
      if (!chosenId) {
        const text =
          `None of the models in the "${params.agent ?? "default"}" stack are currently available.\n` +
          `Stack: ${stack.join(", ")}\n` +
          `Fix one of: add the model (it may be missing/dead), authenticate the provider, or adjust the stack in ${CONFIG_PATH}.`;
        return { content: [{ type: "text" as const, text }], isError: true, details: { stack, available: [...available] } };
      }

      const chosen = live.get(chosenId)!;
      const thinking = config.thinking[params.agent ?? ""];
      const lines = [
        `agent:      ${params.agent ?? "default"}`,
        `model:      ${chosenId}`,
        `reasoning:  ${chosen.reasoning ? "yes" : "no"}`,
        ...(chosen.reasoning && thinking ? [`thinking:   ${thinking}`] : []),
        `remainder:  ${stack.slice(stack.indexOf(chosenId) + 1).join(", ") || "(none)"}`,
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        details: {
          agent: params.agent ?? "default",
          model: chosenId,
          thinking: chosen.reasoning && thinking ? thinking : undefined,
          contextWindow: chosen.contextWindow,
          stack,
        },
      };
    },
  });

  pi.registerCommand("agent-models", {
    description: "Show the per-agent model stack config for pick-model",
    handler: async (_args, ctx) => {
      const config = loadConfig();
      const lines = [`config: ${CONFIG_PATH}`];
      if (config) {
        lines.push(`default: ${config.default.join(", ")}`);
        for (const [agent, stack] of Object.entries(config.agents)) {
          lines.push(`${agent}: ${stack.join(", ")}${config.thinking[agent] ? `  (thinking ${config.thinking[agent]})` : ""}`);
        }
      } else {
        lines.push("(no valid config found)");
      }
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}