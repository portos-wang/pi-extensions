/**
 * Pi Extension Skeleton
 * 
 * A starting template for converting Claude Code or Codex extensions to pi.
 * Replace this comment block with a description of what your extension does.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function myExtension(pi: ExtensionAPI) {
  // ============================================================================
  // State (optional)
  // ============================================================================
  // Store any state that needs to persist across events
  let config: Record<string, unknown> = {};

  // ============================================================================
  // Session Lifecycle
  // ============================================================================

  // Called when a session starts (startup, new, resume, fork, reload)
  pi.on("session_start", async (_event, ctx) => {
    // Load configuration, initialize state, scan directories, etc.
    const configPath = path.join(ctx.cwd, ".my-extension.json");
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  });

  // Called when a session ends (quit, reload, new, resume, fork)
  pi.on("session_shutdown", async (_event, ctx) => {
    // Clean up resources, save state, etc.
  });

  // ============================================================================
  // System Prompt Modification
  // ============================================================================

  // Modify the system prompt before each agent run
  // (Replaces CLAUDE.md / AGENTS.md injection)
  pi.on("before_agent_start", async (event, ctx) => {
    // Add your custom instructions
    return {
      systemPrompt: event.systemPrompt + "\n\n## Custom Instructions\n\n...",
    };
  });

  // ============================================================================
  // Tool Interception
  // ============================================================================

  // Intercept tool calls before execution
  // (Replaces PreToolUse hooks)
  pi.on("tool_call", async (event, ctx) => {
    // Example: Block dangerous commands
    // if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
    //   return { block: true, reason: "Blocked by policy" };
    // }

    // Example: Modify tool input
    // if (event.toolName === "bash") {
    //   event.input.command = `source ~/.profile\n${event.input.command}`;
    // }
  });

  // Modify tool results after execution
  // (Replaces PostToolUse hooks)
  pi.on("tool_result", async (event, ctx) => {
    // Example: Add context to results
    // if (event.toolName === "bash") {
    //   return {
    //     content: [{ type: "text", text: `[output]\n${event.content[0]?.text}\n[/output]` }],
    //   };
    // }
  });

  // ============================================================================
  // Custom Tools (optional)
  // ============================================================================

  // Register tools that the LLM can call
  // import { Type } from "typebox";
  // pi.registerTool({
  //   name: "my_tool",
  //   label: "My Tool",
  //   description: "What this tool does",
  //   parameters: Type.Object({
  //     input: Type.String({ description: "Tool input" }),
  //   }),
  //   async execute(toolCallId, params, signal, onUpdate, ctx) {
  //     return {
  //       content: [{ type: "text", text: `Result: ${params.input}` }],
  //       details: {},
  //     };
  //   },
  // });

  // ============================================================================
  // Custom Commands (optional)
  // ============================================================================

  // Register slash commands
  // pi.registerCommand("my-command", {
  //   description: "What this command does",
  //   handler: async (args, ctx) => {
  //     ctx.ui.notify(`Running with: ${args}`, "info");
  //   },
  // });
}
