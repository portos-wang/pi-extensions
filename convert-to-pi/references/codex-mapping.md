# OpenAI Codex to Pi Extension Mapping

## Quick Reference

| Codex Feature | Pi Equivalent | Pi API |
|---------------|---------------|--------|
| `AGENTS.md` | System prompt injection | `before_agent_start` event |
| Custom instructions | System prompt injection | `before_agent_start` event |
| Tool overrides / policies | Tool call interception | `tool_call` event |
| Policy files | Tool call blocking | `tool_call` event with `return { block: true }` |
| Custom tools | Custom tools | `pi.registerTool()` |
| Approval modes | Permission handling | `tool_call` event + `ctx.ui.confirm()` |
| Notification rules | Event handlers | Various event handlers |

---

## Detailed Mapping

### 1. AGENTS.md Files

**Codex behavior:** `AGENTS.md` files provide project context and instructions to the agent. They're loaded into the system prompt automatically.

**Pi equivalent:** Use `before_agent_start` to read and inject the content.

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function agentsMdExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const agentsPath = path.join(ctx.cwd, "AGENTS.md");
    
    if (fs.existsSync(agentsPath)) {
      const content = fs.readFileSync(agentsPath, "utf-8");
      return {
        systemPrompt: event.systemPrompt + `\n\n## Project Instructions\n\n${content}`,
      };
    }
  });
}
```

### 2. Custom Instructions / System Prompts

**Codex behavior:** Users can define custom instructions that shape agent behavior.

**Pi equivalent:** Inject via `before_agent_start`, or use prompt templates.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CUSTOM_INSTRUCTIONS = `
## Code Style Rules
- Use TypeScript strict mode
- Prefer functional components in React
- Always add error handling for async operations
`;

export default function customInstructionsExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt: event.systemPrompt + "\n\n" + CUSTOM_INSTRUCTIONS,
    };
  });
}
```

### 3. Tool Overrides and Policies

**Codex behavior:** Policies that control when and how tools can be used. May include approval requirements for certain operations.

**Pi equivalent:** Use `tool_call` event to intercept, modify, or block tool calls.

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function toolPoliciesExtension(pi: ExtensionAPI) {
  // Example: Require confirmation for destructive operations
  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("bash", event)) {
      const cmd = event.input.command;
      
      // Require approval for package management
      if (cmd.match(/^(npm|yarn|pnpm)\s+(install|uninstall|update)/)) {
        const ok = await ctx.ui.confirm(
          "Package Manager",
          `Allow: ${cmd}?`
        );
        if (!ok) {
          return { block: true, reason: "User denied package operation" };
        }
      }

      // Block network operations in restricted mode
      if (cmd.match(/curl|wget|fetch/)) {
        return { block: true, reason: "Network operations disabled" };
      }
    }
  });

  // Example: Restrict file operations
  pi.on("tool_call", async (event) => {
    if (isToolCallEventType("write", event)) {
      const restrictedPaths = [
        /package-lock\.json$/,
        /yarn\.lock$/,
        /\.config\//,
      ];
      
      for (const pattern of restrictedPaths) {
        if (pattern.test(event.input.path)) {
          return { block: true, reason: `Cannot modify: ${event.input.path}` };
        }
      }
    }
  });
}
```

### 4. Approval Modes

**Codex behavior:** Different modes (suggest, auto-edit, full-auto) control how much the agent can do without approval.

**Pi equivalent:** Implement approval logic in `tool_call` handlers.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ApprovalMode = "suggest" | "auto-edit" | "full-auto";

let currentMode: ApprovalMode = "auto-edit";

export default function approvalModesExtension(pi: ExtensionAPI) {
  // Command to switch modes
  pi.registerCommand("mode", {
    description: "Set approval mode: suggest, auto-edit, full-auto",
    handler: async (args, ctx) => {
      const mode = args?.trim() as ApprovalMode;
      if (["suggest", "auto-edit", "full-auto"].includes(mode)) {
        currentMode = mode;
        ctx.ui.notify(`Approval mode: ${mode}`, "info");
      } else {
        ctx.ui.notify("Invalid mode. Use: suggest, auto-edit, or full-auto", "warning");
      }
    },
  });

  // Apply mode logic
  pi.on("tool_call", async (event, ctx) => {
    if (currentMode === "suggest") {
      // Always ask for confirmation
      const ok = await ctx.ui.confirm(
        "Approve Tool Call",
        `Allow ${event.toolName}?`
      );
      if (!ok) return { block: true, reason: "User denied" };
    }
    
    if (currentMode === "auto-edit") {
      // Auto-allow reads, confirm writes
      if (event.toolName === "write" || event.toolName === "edit") {
        const ok = await ctx.ui.confirm(
          "Approve Edit",
          `Allow ${event.toolName} to ${event.input.path || "file"}?`
        );
        if (!ok) return { block: true, reason: "User denied" };
      }
    }
    
    // full-auto: no confirmations needed
  });
}
```

### 5. Notification Rules

**Codex behavior:** Rules that determine when and how the user is notified about agent actions.

**Pi equivalent:** Use `ctx.ui.notify()` in event handlers, or subscribe to specific events.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function notificationsExtension(pi: ExtensionAPI) {
  // Notify on session start
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Session started", "info");
  });

  // Notify on long-running tool executions
  pi.on("tool_execution_start", async (event, ctx) => {
    if (event.toolName === "bash") {
      ctx.ui.setStatus("executing", `Running: ${event.args.command?.slice(0, 50)}...`);
    }
  });

  // Notify on errors
  pi.on("tool_result", async (event, ctx) => {
    if (event.isError) {
      ctx.ui.notify(`Error in ${event.toolName}: ${event.content[0]?.text}`, "error");
    }
  });

  // Notify on agent completion
  pi.on("agent_end", async (_event, ctx) => {
    ctx.ui.notify("Agent finished", "info");
  });
}
```

### 6. Custom Tools

**Codex behavior:** Users can define custom tools that extend agent capabilities.

**Pi equivalent:** Use `pi.registerTool()` to register tools with schemas and handlers.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function customToolsExtension(pi: ExtensionAPI) {
  // Example: A tool to run database queries
  pi.registerTool({
    name: "db_query",
    label: "Database Query",
    description: "Execute a read-only SQL query against the project database",
    promptSnippet: "Run SQL queries for data retrieval",
    promptGuidelines: [
      "Use db_query when you need to fetch data from the database.",
      "Only use SELECT queries - INSERT/UPDATE/DELETE are not allowed.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "SQL SELECT query to execute" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Validate query is read-only
      if (!params.query.trim().toUpperCase().startsWith("SELECT")) {
        return {
          content: [{ type: "text", text: "Error: Only SELECT queries are allowed" }],
          isError: true,
        };
      }

      // Execute query (example)
      // const result = await db.query(params.query);
      return {
        content: [{ type: "text", text: `Query results for: ${params.query}` }],
        details: { query: params.query },
      };
    },
  });

  // Example: A tool to manage project dependencies
  pi.registerTool({
    name: "manage_deps",
    label: "Manage Dependencies",
    description: "Add, remove, or update project dependencies",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("add"),
        Type.Literal("remove"),
        Type.Literal("update"),
      ], { description: "Action to perform" }),
      package: Type.String({ description: "Package name" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      let command: string;
      switch (params.action) {
        case "add":
          command = `npm install ${params.package}`;
          break;
        case "remove":
          command = `npm uninstall ${params.package}`;
          break;
        case "update":
          command = `npm update ${params.package}`;
          break;
      }
      
      return {
        content: [{ type: "text", text: `Would execute: ${command}` }],
        details: { action: params.action, package: params.package },
      };
    },
  });
}
```

---

## Behavioral Differences

### Architecture
- **Codex:** Monolithic agent with configuration files
- **Pi:** Modular extension system with event-driven architecture

### Configuration
- **Codex:** File-based configuration (AGENTS.md, policy files)
- **Pi:** Code-based configuration via TypeScript extensions

### Tool Management
- **Codex:** Built-in tools with override policies
- **Pi:** Built-in tools + dynamically registrable custom tools

### Permission Model
- **Codex:** Global approval modes (suggest, auto-edit, full-auto)
- **Pi:** Per-tool-call permission handlers with full flexibility

### State Management
- **Codex:** Implicit state in conversation
- **Pi:** Explicit session lifecycle with `SessionManager` API

### User Interaction
- **Codex:** Limited to tool results
- **Pi:** Direct user interaction via `ctx.ui` (confirm, select, input, notify)

---

## Common Codex Patterns → Pi Patterns

### Read-Only Mode
```typescript
// Codex: Set approval mode to suggest
// Pi:
pi.on("tool_call", async (event, ctx) => {
  const readOnlyTools = ["read", "list"];
  if (!readOnlyTools.includes(event.toolName)) {
    const ok = await ctx.ui.confirm("Read-Only Mode", `Allow ${event.toolName}?`);
    if (!ok) return { block: true, reason: "Read-only mode" };
  }
});
```

### Protected Files
```typescript
// Codex: Policy file with protected paths
// Pi:
pi.on("tool_call", async (event) => {
  const protectedFiles = [/\.env/, /credentials/, /secret/];
  const target = event.input.path || event.input.command || "";
  
  for (const pattern of protectedFiles) {
    if (pattern.test(target)) {
      return { block: true, reason: "Protected file" };
    }
  }
});
```

### Custom Notifications
```typescript
// Codex: Notification rules in config
// Pi:
pi.on("tool_execution_end", async (event, ctx) => {
  if (event.toolName === "write") {
    ctx.ui.notify(`File modified: ${event.args.path}`, "info");
  }
});
```
