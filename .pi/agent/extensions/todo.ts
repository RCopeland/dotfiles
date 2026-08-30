/**
 * todo — task tracking for the agent pipeline (planner creates, worker claims/closes).
 *
 * Storage: <cwd>/.pi/todos.json  (one store per project; sub-agent panes share it
 * when they run with the same cwd — verify with the /todos command or the tool output).
 *
 * Todo shape:
 * {
 *   id: "TODO-0001",
 *   title: "Add UserService.updateProfile",
 *   body: "...",                    // examples/references/constraints/acceptance criteria (see write-todos skill)
 *   tags: ["plan-name"],
 *   status: "open" | "in_progress" | "closed" | "blocked",
 *   createdAt: 1234567890,
 *   updatedAt: 1234567890
 * }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const STATUSES = ["open", "in_progress", "closed", "blocked"] as const;
type Status = (typeof STATUSES)[number];

interface Todo {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: Status;
  createdAt: number;
  updatedAt: number;
}

function todosFile(cwd: string): string {
  return join(cwd, ".pi", "todos.json");
}

function loadTodos(cwd: string): Todo[] {
  const file = todosFile(cwd);
  if (!existsSync(file)) return [];
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as { todos?: Todo[] };
    return Array.isArray(raw.todos) ? raw.todos : [];
  } catch {
    return [];
  }
}

function saveTodos(cwd: string, todos: Todo[]): void {
  const file = todosFile(cwd);
  mkdirSync(join(cwd, ".pi"), { recursive: true });
  writeFileSync(file, JSON.stringify({ todos }, null, 2) + "\n", "utf8");
}

function nextId(todos: Todo[]): string {
  let max = 0;
  for (const t of todos) {
    const n = /^TODO-(\d+)$/.exec(t.id);
    if (n) max = Math.max(max, parseInt(n[1], 10));
  }
  return `TODO-${String(max + 1).padStart(4, "0")}`;
}

function describe(t: Todo): string {
  return `${t.id} [${t.status}] ${t.title}${t.tags.length ? `  (${t.tags.join(", ")})` : ""}`;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "todo",
    label: "Todo",
    description:
      "Manage pipeline todos (used by the planner to create and workers to claim/close). " +
      "Actions: create (title + body with code example/reference, constraints, acceptance criteria), " +
      "list (optionally by status), get (by id), claim (id), update (id + status: open|in_progress|closed|blocked). " +
      "Storage: <cwd>/.pi/todos.json. Follow the write-todos skill when creating.",

    parameters: Type.Object({
      action: Type.Union(
        [Type.Literal("create"), Type.Literal("list"), Type.Literal("get"), Type.Literal("claim"), Type.Literal("update")],
        { description: "Operation to perform" }
      ),
      id: Type.Optional(Type.String({ description: "Todo id (TODO-0001). Required for get/claim/update." })),
      title: Type.Optional(Type.String({ description: "Title for create. Concrete action, not a vibe." })),
      body: Type.Optional(
        Type.String({ description: "Body for create: code example or file reference, constraints, anti-patterns, acceptance criteria." })
      ),
      tags: Type.Optional(Type.Array(Type.String(), { description: "Tags for create, e.g. the plan name." })),
      status: Type.Optional(
        Type.Union(
          [Type.Literal("open"), Type.Literal("in_progress"), Type.Literal("closed"), Type.Literal("blocked")],
          { description: "New status for update." }
        )
      ),
    }),

    async execute(toolCallId: string, params: {
      action: "create" | "list" | "get" | "claim" | "update";
      id?: string;
      title?: string;
      body?: string;
      tags?: string[];
      status?: Status;
    }, _signal: AbortSignal, _onUpdate: unknown, ctx: ExtensionContext) {
      const cwd = ctx.cwd;
      const todos = loadTodos(cwd);
      const file = todosFile(cwd);

      switch (params.action) {
        case "create": {
          if (!params.title || !params.body) {
            return {
              content: [{ type: "text" as const, text: "create requires both a title and a body (see the write-todos skill for required body structure)." }],
              isError: true,
              details: { file },
            };
          }
          const todo: Todo = {
            id: nextId(todos),
            title: params.title,
            body: params.body,
            tags: params.tags ?? [],
            status: "open",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          todos.push(todo);
          saveTodos(cwd, todos);
          return {
            content: [{ type: "text" as const, text: `created ${todo.id}: ${todo.title}\nstatus: open (${file})` }],
            details: { id: todo.id, status: todo.status, file },
          };
        }

        case "list": {
          if (!todos.length) {
            return { content: [{ type: "text" as const, text: "no todos yet" }], details: { file } };
          }
          const filter = params.status;
          const rows = (filter ? todos.filter((t) => t.status === filter) : todos)
            .sort((a, b) => a.createdAt - b.createdAt);
          const text = rows.length
            ? rows.map(describe).join("\n")
            : `no todos with status "${filter}"`;
          return {
            content: [{ type: "text" as const, text }],
            details: { file, count: rows.length, status: filter },
          };
        }

        case "get": {
          const todo = todos.find((t) => t.id === params.id);
          if (!todo) {
            return { content: [{ type: "text" as const, text: `todo ${params.id} not found` }], isError: true, details: { file } };
          }
          const text = `${describe(todo)}\n---\n${todo.body}`;
          return { content: [{ type: "text" as const, text }], details: { id: todo.id, status: todo.status, file } };
        }

        case "claim": {
          const todo = todos.find((t) => t.id === params.id);
          if (!todo) {
            return { content: [{ type: "text" as const, text: `todo ${params.id} not found` }], isError: true, details: { file } };
          }
          if (todo.status === "closed") {
            return { content: [{ type: "text" as const, text: `${todo.id} is already closed — refusing to reopen` }], isError: true, details: { id: todo.id, status: todo.status } };
          }
          todo.status = "in_progress";
          todo.updatedAt = Date.now();
          saveTodos(cwd, todos);
          return { content: [{ type: "text" as const, text: `claimed ${todo.id} (in_progress)` }], details: { id: todo.id, status: "in_progress", file } };
        }

        case "update": {
          const todo = todos.find((t) => t.id === params.id);
          if (!todo) {
            return { content: [{ type: "text" as const, text: `todo ${params.id} not found` }], isError: true, details: { file } };
          }
          if (!params.status || !STATUSES.includes(params.status)) {
            return { content: [{ type: "text" as const, text: `update requires status: ${STATUSES.join(" | ")}` }], isError: true, details: { id: todo.id } };
          }
          todo.status = params.status;
          todo.updatedAt = Date.now();
          saveTodos(cwd, todos);
          return { content: [{ type: "text" as const, text: `${todo.id} → ${params.status}` }], details: { id: todo.id, status: params.status, file } };
        }
      }
    },
  });

  pi.registerCommand("todos", {
    description: "List the current todo store",
    handler: async (_args, ctx) => {
      const todos = loadTodos(ctx.cwd);
      const lines = todos.length
        ? todos.map(describe)
        : ["(no todos)"];
      ctx.ui.notify([`${todosFile(ctx.cwd)}:`, ...lines].join("\n"), "info");
    },
  });
}