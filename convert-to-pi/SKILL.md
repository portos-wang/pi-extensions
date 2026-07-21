---
name: convert-to-pi
description: Convert Claude Code and OpenAI Codex extensions, plugins, hooks, and custom configurations into pi extensions. Use this skill when the user wants to port, migrate, or rewrite any Claude Code feature (CLAUDE.md rules, pre/post tool hooks, custom slash commands, MCP servers, permission policies) or Codex feature (AGENTS.md, custom instructions, tool overrides, policy files) into pi's extension system. Also triggers when converting `.claude/` directory structures, `codex/` configs, or any agent-harness-specific plugin format to pi extensions.
---

# Convert to Pi

A skill for converting Claude Code and OpenAI Codex extensions, plugins, hooks, and configurations into pi extensions.

## Workflow

### Step 1: Identify the Source

Determine what the user wants to convert:

**Claude Code sources:**
- `CLAUDE.md` / `CLAUDE.local.md` files (project rules, custom instructions)
- `.claude/rules/*.md` files (granular rule files)
- Pre/post tool hooks (PreToolUse, PostToolUse, etc.)
- Custom slash commands (`.claude/commands/*.md`)
- MCP server configurations (`.claude/mcp.json`)
- Permission policies and allowed/disallowed tool patterns

**Codex sources:**
- `AGENTS.md` files (project context and instructions)
- Custom instructions / system prompts
- Tool overrides or policy files
- Any custom configurations in `.codex/` or similar directories

Ask the user to provide the source files or directory path. If they mention a feature conceptually (e.g., "I have a hook that blocks rm -rf"), ask for the actual code or describe the behavior.

### Step 2: Analyze the Source

Read the source files and identify the patterns being used. Map each pattern to its pi equivalent using the reference documents:

- For Claude Code features → read [references/claude-code-mapping.md](references/claude-code-mapping.md)
- For Codex features → read [references/codex-mapping.md](references/codex-mapping.md)

### Step 3: Generate the Pi Extension

Create the extension following pi's extension API patterns. Use the templates as starting points:

- Basic extension skeleton → [templates/extension-skeleton.ts](templates/extension-skeleton.ts)
- Custom tool registration → [templates/tool-skeleton.ts](templates/tool-skeleton.ts)

**Key pi extension patterns:**

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function myExtension(pi: ExtensionAPI) {
  // Subscribe to lifecycle events
  pi.on("session_start", async (_event, ctx) => { /* ... */ });
  
  // Intercept tool calls (replaces PreToolUse/PostToolUse)
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      return { block: true, reason: "Blocked by policy" };
    }
  });
  
  // Modify system prompt (replaces CLAUDE.md / AGENTS.md injection)
  pi.on("before_agent_start", async (event) => {
    return { systemPrompt: event.systemPrompt + "\n\nExtra rules..." };
  });
  
  // Register custom tools
  pi.registerTool({
    name: "my_tool",
    label: "My Tool",
    description: "What it does",
    parameters: Type.Object({ /* ... */ }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return { content: [{ type: "text", text: "result" }], details: {} };
    },
  });
  
  // Register slash commands
  pi.registerCommand("my-cmd", {
    description: "What it does",
    handler: async (args, ctx) => { /* ... */ },
  });
}
```

### Step 4: Write to Target Directory

Place the converted extension in the appropriate location:

- **Global (all projects):** `~/.pi/agent/extensions/`
- **Project-local:** `.pi/extensions/`
- **As a distributable package:** Use `pi install` structure with `package.json`

If converting multiple related features, organize them into a single extension with subdirectories.

### Step 5: Verify and Document

1. Test the extension: `pi -e ./path/to/extension.ts`
2. Verify all features from the source are covered
3. Document any behavioral differences between the original and the pi version
4. Note any pi-specific enhancements that could improve the original behavior

## Common Conversion Patterns

### CLAUDE.md Rules → before_agent_start

CLAUDE.md content is injected into the system prompt. In pi, use `before_agent_start`:

```typescript
pi.on("before_agent_start", async (event) => {
  const rules = fs.readFileSync("CLAUDE.md", "utf-8");
  return { systemPrompt: event.systemPrompt + "\n\n" + rules };
});
```

### PreToolUse Hooks → tool_call Event

Claude Code's PreToolUse hooks can block or modify tool calls. In pi, use `tool_call`:

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (isToolCallEventType("bash", event)) {
    // Modify command
    event.input.command = `source ~/.profile\n${event.input.command}`;
    
    // Or block it
    if (event.input.command.includes("dangerous")) {
      return { block: true, reason: "Blocked" };
    }
  }
});
```

### PostToolUse Hooks → tool_result Event

Claude Code's PostToolUse hooks can inspect or modify results. In pi, use `tool_result`:

```typescript
pi.on("tool_result", async (event, ctx) => {
  if (event.toolName === "bash") {
    // Modify result
    return { content: [{ type: "text", text: "Modified: " + event.content[0].text }] };
  }
});
```

### Custom Slash Commands → registerCommand

Claude Code's `.claude/commands/*.md` become pi commands:

```typescript
pi.registerCommand("my-cmd", {
  description: "What this command does",
  handler: async (args, ctx) => {
    // args is the text after the command
    ctx.ui.notify(`Running with: ${args}`, "info");
  },
});
```

### MCP Servers → registerTool or registerProvider

MCP servers expose tools. In pi, register equivalent tools:

```typescript
pi.registerTool({
  name: "mcp_tool_name",
  label: "MCP Tool",
  description: "What the MCP tool does",
  parameters: Type.Object({ /* schema from MCP */ }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Call your MCP server here
    const result = await callMCPServer(params);
    return { content: [{ type: "text", text: result }], details: {} };
  },
});
```

### Permission Policies → tool_call with block

Claude Code's permission system can be replicated with tool_call blocking:

```typescript
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\/(?!tmp)/,  // Block rm -rf on non-tmp directories
  /sudo\s+rm/,              // Block sudo rm
];

pi.on("tool_call", async (event) => {
  if (isToolCallEventType("bash", event)) {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(event.input.command)) {
        return { block: true, reason: `Blocked by policy: ${pattern}` };
      }
    }
  }
});
```

## Behavioral Differences to Note

When converting, document these differences:

1. **Event model:** Claude Code uses hooks with specific names; pi uses a unified event system
2. **Tool types:** Pi's `isToolCallEventType()` provides type-safe tool input access
3. **Session persistence:** Pi has built-in session management; you may need to adapt stateful logic
4. **UI interaction:** Pi extensions can prompt users via `ctx.ui` (confirm, select, input)
5. **Dynamic tools:** Pi supports registering tools at runtime, not just at load time

## Output Format

When the conversion is complete, present:

1. The generated extension file(s)
2. A brief summary of what was converted
3. Any behavioral differences or notes
4. Instructions for testing: `pi -e ./converted-extension.ts`
