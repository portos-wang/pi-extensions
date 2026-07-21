# Claude Code to Pi Extension Mapping

## Quick Reference

| Claude Code Feature | Pi Equivalent | Pi API |
|---------------------|---------------|--------|
| `CLAUDE.md` / `CLAUDE.local.md` | System prompt injection | `before_agent_start` event |
| `.claude/rules/*.md` | System prompt injection | `before_agent_start` event |
| PreToolUse hooks | Tool call interception | `tool_call` event |
| PostToolUse hooks | Tool result modification | `tool_result` event |
| Custom slash commands | Custom commands | `pi.registerCommand()` |
| MCP server tools | Custom tools | `pi.registerTool()` |
| MCP server resources | Custom tools or providers | `pi.registerTool()` or `pi.registerProvider()` |
| Permission policies | Tool call blocking | `tool_call` event with `return { block: true }` |
| `.claude/commands/*.md` | Custom commands | `pi.registerCommand()` |
| Settings / configuration | Extension state | `pi.on("session_start")` + file I/O |

---

## Detailed Mapping

### 1. CLAUDE.md and CLAUDE.local.md

**Claude Code behavior:** These files are automatically loaded and injected into the system prompt. They provide project-level instructions and context.

**Pi equivalent:** Use `before_agent_start` to read and inject the content.

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function claudeMdExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const files = ["CLAUDE.md", "CLAUDE.local.md"];
    let additionalPrompt = "";

    for (const file of files) {
      const filePath = path.join(ctx.cwd, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        additionalPrompt += `\n\n## ${file}\n\n${content}`;
      }
    }

    if (additionalPrompt) {
      return { systemPrompt: event.systemPrompt + additionalPrompt };
    }
  });
}
```

### 2. .claude/rules/ Directory

**Claude Code behavior:** `.claude/rules/*.md` files are scanned and their content is injected into the system prompt. Files can have `paths` frontmatter to restrict when they apply.

**Pi equivalent:** Scan the directory and inject all rules. For conditional rules, check the current file context.

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function findMarkdownFiles(dir: string, basePath: string = ""): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(path.join(dir, entry.name), relativePath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(relativePath);
    }
  }
  return results;
}

export default function claudeRulesExtension(pi: ExtensionAPI) {
  let ruleFiles: string[] = [];
  let rulesDir: string = "";

  pi.on("session_start", async (_event, ctx) => {
    rulesDir = path.join(ctx.cwd, ".claude", "rules");
    ruleFiles = findMarkdownFiles(rulesDir);
  });

  pi.on("before_agent_start", async (event) => {
    if (ruleFiles.length === 0) return;

    const rulesList = ruleFiles.map((f) => `- .claude/rules/${f}`).join("\n");
    return {
      systemPrompt:
        event.systemPrompt +
        `\n\n## Project Rules\n\nAvailable rules:\n${rulesList}\n\nRead relevant rules with the read tool when working on related tasks.`,
    };
  });
}
```

### 3. PreToolUse Hooks

**Claude Code behavior:** Hooks that run before a tool executes. Can block the tool call or modify its input.

**Pi equivalent:** `tool_call` event. Return `{ block: true, reason?: string }` to block, or mutate `event.input` to modify.

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function preToolUseExtension(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    // Block dangerous bash commands
    if (isToolCallEventType("bash", event)) {
      const cmd = event.input.command;
      
      if (cmd.includes("rm -rf /")) {
        return { block: true, reason: "Cannot delete root filesystem" };
      }
      
      // Modify command (add safety prefix)
      event.input.command = `set -e\n${cmd}`;
    }

    // Restrict file writes
    if (isToolCallEventType("write", event)) {
      if (event.input.path.includes("node_modules/")) {
        return { block: true, reason: "Cannot write to node_modules" };
      }
    }
  });
}
```

### 4. PostToolUse Hooks

**Claude Code behavior:** Hooks that run after a tool executes. Can modify the result.

**Pi equivalent:** `tool_result` event. Return modified content/details.

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function postToolUseExtension(pi: ExtensionAPI) {
  pi.on("tool_result", async (event, ctx) => {
    // Add context to bash output
    if (event.toolName === "bash") {
      const originalText = event.content[0]?.text || "";
      return {
        content: [{ 
          type: "text", 
          text: `[bash output]\n${originalText}\n[end bash output]` 
        }],
      };
    }

    // Log file reads
    if (event.toolName === "read") {
      console.log(`File read: ${event.input.path}`);
    }
  });
}
```

### 5. Custom Slash Commands (.claude/commands/)

**Claude Code behavior:** Markdown files in `.claude/commands/` become `/command-name` slash commands. The file content is used as the prompt.

**Pi equivalent:** `pi.registerCommand()` with a handler.

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function commandsExtension(pi: ExtensionAPI) {
  const commandsDir = path.join(process.cwd(), ".claude", "commands");

  pi.on("session_start", async (_event, ctx) => {
    if (!fs.existsSync(commandsDir)) return;

    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith(".md"));
    
    for (const file of files) {
      const commandName = file.replace(".md", "");
      const commandPath = path.join(commandsDir, file);
      
      pi.registerCommand(commandName, {
        description: `Execute ${commandName} command`,
        handler: async (args, ctx) => {
          const template = fs.readFileSync(commandPath, "utf-8");
          // Process template with args
          const prompt = template.replace(/\$ARGUMENTS/g, args || "");
          ctx.ui.notify(`Running command: ${commandName}`, "info");
          // The prompt will be sent to the agent
          return { action: "continue", text: prompt };
        },
      });
    }
  });
}
```

### 6. MCP Server Integration

**Claude Code behavior:** MCP servers are configured in `.claude/mcp.json` and provide tools/resources that Claude can use.

**Pi equivalent:** Register equivalent tools with `pi.registerTool()`, or use `pi.registerProvider()` for model providers.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function mcpIntegrationExtension(pi: ExtensionAPI) {
  // Example: Convert an MCP tool to a pi tool
  pi.registerTool({
    name: "my_mcp_tool",
    label: "My MCP Tool",
    description: "Description of what this MCP tool does",
    parameters: Type.Object({
      input: Type.String({ description: "Tool input" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Call your MCP server here
      // const result = await callMCPServer(params.input);
      return {
        content: [{ type: "text", text: `Result from MCP: ${params.input}` }],
        details: { source: "mcp-server" },
      };
    },
  });
}
```

### 7. Permission Policies

**Claude Code behavior:** Policies that define which tools can be used, with what arguments, and under what conditions.

**Pi equivalent:** Use `tool_call` event with blocking logic. Can also use `before_agent_start` for allowlists.

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface Policy {
  tool: string;
  block?: RegExp[];
  requireConfirmation?: RegExp[];
}

const POLICIES: Policy[] = [
  {
    tool: "bash",
    block: [/rm\s+-rf\s+\/(?!tmp)/, /sudo\s+rm/],
    requireConfirmation: [/git\s+push/, /npm\s+publish/],
  },
  {
    tool: "write",
    block: [/\.env$/, /\.env\.local$/],
  },
];

export default function permissionPolicyExtension(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    const policy = POLICIES.find(p => p.tool === event.toolName);
    if (!policy) return;

    if (isToolCallEventType("bash", event)) {
      const cmd = event.input.command;

      // Check block patterns
      if (policy.block) {
        for (const pattern of policy.block) {
          if (pattern.test(cmd)) {
            return { block: true, reason: `Blocked by policy: ${pattern}` };
          }
        }
      }

      // Check confirmation patterns
      if (policy.requireConfirmation) {
        for (const pattern of policy.requireConfirmation) {
          if (pattern.test(cmd)) {
            const ok = await ctx.ui.confirm(
              "Confirm Action",
              `Allow command: ${cmd}?`
            );
            if (!ok) {
              return { block: true, reason: "User denied" };
            }
          }
        }
      }
    }
  });
}
```

---

## Behavioral Differences

### Event Model
- **Claude Code:** Discrete hooks (PreToolUse, PostToolUse, etc.) with specific names
- **Pi:** Unified event system with typed events (`tool_call`, `tool_result`, `before_agent_start`, etc.)

### Tool Type Safety
- **Claude Code:** Tools accessed via string names, input as generic objects
- **Pi:** `isToolCallEventType()` provides type-safe access to tool-specific input types

### Session Management
- **Claude Code:** Implicit session state
- **Pi:** Explicit session lifecycle events (`session_start`, `session_shutdown`) with `SessionManager` API

### User Interaction
- **Claude Code:** Limited to tool-based interaction
- **Pi:** Extensions can directly prompt users via `ctx.ui` (confirm, select, input, notify)

### Dynamic Registration
- **Claude Code:** Tools defined at startup
- **Pi:** Tools can be registered at runtime via `pi.registerTool()` in any event handler
