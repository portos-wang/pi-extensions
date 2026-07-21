/**
 * Pi Custom Tool Skeleton
 * 
 * A template for converting MCP servers or custom tools from Claude Code/Codex
 * to pi's registerTool() API.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ============================================================================
// Option 1: Simple Tool (synchronous or async)
// ============================================================================

export function registerSimpleTool(pi: ExtensionAPI) {
  pi.registerTool({
    // Tool identity
    name: "my_simple_tool",
    label: "My Simple Tool",
    description: "A clear description of what this tool does. Be specific about when to use it.",
    
    // Optional: One-line snippet shown in tool list
    promptSnippet: "Brief description for the available tools list",
    
    // Optional: Guidelines for when to use this tool
    promptGuidelines: [
      "Use my_simple_tool when the user asks to...",
      "Do not use my_simple_tool for...",
    ],
    
    // Schema for tool parameters (uses typebox)
    parameters: Type.Object({
      input: Type.String({ description: "The main input" }),
      options: Type.Optional(Type.Object({
        verbose: Type.Boolean({ description: "Enable verbose output" }),
        format: Type.Optional(Type.Union([
          Type.Literal("text"),
          Type.Literal("json"),
        ], { description: "Output format" })),
      })),
    }),
    
    // Execute handler
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // params is typed based on the schema above
      const { input, options } = params;
      
      // Long-running operations: report progress
      await onUpdate({ message: "Processing..." });
      
      // Do work...
      const result = `Processed: ${input}`;
      
      return {
        content: [{ type: "text", text: result }],
        details: { 
          input,
          format: options?.format || "text",
        },
      };
    },
  });
}

// ============================================================================
// Option 2: Tool with External API Call
// ============================================================================

export function registerApiTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "api_tool",
    label: "API Tool",
    description: "Call an external API",
    parameters: Type.Object({
      endpoint: Type.String({ description: "API endpoint" }),
      method: Type.Optional(Type.Union([
        Type.Literal("GET"),
        Type.Literal("POST"),
      ], { description: "HTTP method" })),
      body: Type.Optional(Type.String({ description: "Request body (JSON string)" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const method = params.method || "GET";
      
      // Use ctx.signal for abort-aware fetch
      const response = await fetch(params.endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: params.body,
        signal: ctx.signal,
      });
      
      if (!response.ok) {
        return {
          content: [{ type: "text", text: `API Error: ${response.status} ${response.statusText}` }],
          isError: true,
        };
      }
      
      const data = await response.text();
      return {
        content: [{ type: "text", text: data }],
        details: { status: response.status },
      };
    },
  });
}

// ============================================================================
// Option 3: Tool with Progress Updates
// ============================================================================

export function registerProgressTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "progress_tool",
    label: "Progress Tool",
    description: "A tool that shows progress updates",
    parameters: Type.Object({
      items: Type.Array(Type.String(), { description: "List of items to process" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const results: string[] = [];
      
      for (let i = 0; i < params.items.length; i++) {
        // Check if operation was cancelled
        if (signal?.aborted) {
          return {
            content: [{ type: "text", text: "Operation cancelled" }],
            isError: true,
          };
        }
        
        // Report progress
        await onUpdate({
          message: `Processing item ${i + 1}/${params.items.length}: ${params.items[i]}`,
        });
        
        // Process item...
        results.push(`Processed: ${params.items[i]}`);
      }
      
      return {
        content: [{ type: "text", text: results.join("\n") }],
        details: { processed: results.length },
      };
    },
  });
}

// ============================================================================
// Option 4: Tool with User Interaction
// ============================================================================

export function registerInteractiveTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "interactive_tool",
    label: "Interactive Tool",
    description: "A tool that can prompt the user for input",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("confirm"),
        Type.Literal("select"),
        Type.Literal("input"),
      ], { description: "Type of user interaction" }),
      message: Type.String({ description: "Message to show the user" }),
      options: Type.Optional(Type.Array(Type.String(), { description: "Options for select action" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      switch (params.action) {
        case "confirm": {
          const ok = await ctx.ui.confirm("Confirmation", params.message);
          return {
            content: [{ type: "text", text: ok ? "Confirmed" : "Denied" }],
            details: { confirmed: ok },
          };
        }
        
        case "select": {
          const choice = await ctx.ui.select("Select Option", params.options || []);
          return {
            content: [{ type: "text", text: choice || "No selection" }],
            details: { selected: choice },
          };
        }
        
        case "input": {
          const input = await ctx.ui.input("Input", params.message);
          return {
            content: [{ type: "text", text: input || "No input" }],
            details: { input },
          };
        }
      }
    },
  });
}

// ============================================================================
// Main Extension Entry Point
// ============================================================================

export default function toolsExtension(pi: ExtensionAPI) {
  // Register all tools
  registerSimpleTool(pi);
  registerApiTool(pi);
  registerProgressTool(pi);
  registerInteractiveTool(pi);
}
