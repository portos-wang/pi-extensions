# Common Conversion Patterns

This reference covers frequently encountered patterns when converting Claude Code or Codex extensions to pi.

## Table of Contents

- [File System Patterns](#file-system-patterns)
- [Git Integration](#git-integration)
- [State Management](#state-management)
- [Error Handling](#error-handling)
- [Logging and Debugging](#logging-and-debugging)

---

## File System Patterns

### Reading Multiple Config Files

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function multiConfigExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const configFiles = [".env", ".env.local", "config.json"];
    
    for (const file of configFiles) {
      const filePath = path.join(ctx.cwd, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        console.log(`Loaded ${file}: ${content.length} bytes`);
      }
    }
  });
}
```

### Watching for File Changes

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function fileWatcherExtension(pi: ExtensionAPI) {
  let watcher: fs.FSWatcher | null = null;

  pi.on("session_start", async (_event, ctx) => {
    const watchDir = path.join(ctx.cwd, ".my-extension");
    
    if (fs.existsSync(watchDir)) {
      watcher = fs.watch(watchDir, (eventType, filename) => {
        console.log(`File ${eventType}: ${filename}`);
      });
    }
  });

  pi.on("session_shutdown", async () => {
    watcher?.close();
  });
}
```

### Safe File Operations

```typescript
import * as fs from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as path from "node:path";

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function safeWriteFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, "utf-8");
}
```

---

## Git Integration

### Reading Git Status

```typescript
import { execSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function gitStatusExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const status = execSync("git status --porcelain", { 
        cwd: ctx.cwd,
        encoding: "utf-8",
      });
      const changedFiles = status.split("\n").filter(Boolean);
      console.log(`Git: ${changedFiles.length} changed files`);
    } catch {
      console.log("Not a git repository or git not available");
    }
  });
}
```

### Git Hooks Integration

```typescript
import { execSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

export default function gitHooksExtension(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    // Run pre-commit checks before file writes
    if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
      try {
        // Check if there's a pre-commit hook
        const hooksDir = require("node:fs").existsSync(
          require("node:path").join(ctx.cwd, ".git", "hooks")
        );
        
        if (hooksDir) {
          // Stage the file and run checks
          const filePath = event.input.path;
          execSync(`git add "${filePath}"`, { cwd: ctx.cwd });
          execSync("npm run lint -- --max-warnings 0", { 
            cwd: ctx.cwd,
            timeout: 30000,
          });
        }
      } catch (error) {
        return { 
          block: true, 
          reason: `Pre-commit check failed: ${(error as Error).message}` 
        };
      }
    }
  });
}
```

---

## State Management

### Persistent State Across Sessions

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface ExtensionState {
  lastRun: number;
  itemCount: number;
  items: string[];
}

const DEFAULT_STATE: ExtensionState = {
  lastRun: 0,
  itemCount: 0,
  items: [],
};

export default function statefulExtension(pi: ExtensionAPI) {
  let state: ExtensionState = { ...DEFAULT_STATE };
  let statePath: string = "";

  pi.on("session_start", async (_event, ctx) => {
    statePath = path.join(ctx.cwd, ".my-extension", "state.json");
    
    // Load state
    if (fs.existsSync(statePath)) {
      try {
        state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
      } catch {
        state = { ...DEFAULT_STATE };
      }
    }
  });

  pi.on("session_shutdown", async () => {
    // Save state
    if (statePath) {
      const dir = path.dirname(statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      state.lastRun = Date.now();
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    }
  });

  // Tool to interact with state
  pi.registerTool({
    name: "state_manager",
    label: "State Manager",
    description: "Manage extension state",
    parameters: {
      /* schema */
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Use and modify state
      state.itemCount++;
      return {
        content: [{ type: "text", text: `State updated. Items: ${state.itemCount}` }],
        details: state,
      };
    },
  });
}
```

### In-Memory Caching

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function cachingExtension(pi: ExtensionAPI) {
  const cache = new Map<string, { data: unknown; timestamp: number }>();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  function setCache(key: string, data: unknown): void {
    cache.set(key, { data, timestamp: Date.now() });
  }

  // Clear cache on session start
  pi.on("session_start", async () => {
    cache.clear();
  });
}
```

---

## Error Handling

### Graceful Error Recovery

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function errorRecoveryExtension(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    try {
      // Your logic here
    } catch (error) {
      // Log the error
      console.error(`Tool call error: ${error}`);
      
      // Notify user
      ctx.ui.notify(`Error: ${(error as Error).message}`, "error");
      
      // Optionally block the tool call
      return { 
        block: true, 
        reason: `Internal error: ${(error as Error).message}` 
      };
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.isError) {
      // Handle tool errors
      console.error(`Tool ${event.toolName} failed: ${event.content[0]?.text}`);
      
      // Optionally modify the error
      return {
        content: [{ 
          type: "text", 
          text: `Error occurred: ${event.content[0]?.text}\n\nPlease try again or contact support.` 
        }],
        isError: true,
      };
    }
  });
}
```

### Retry Logic

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

export default function retryExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "retry_tool",
    label: "Retry Tool",
    description: "Tool with automatic retry",
    parameters: {
      /* schema */
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const result = await withRetry(async () => {
        // Your API call or operation
        return "success";
      }, 3, 1000);
      
      return {
        content: [{ type: "text", text: result }],
        details: {},
      };
    },
  });
}
```

---

## Logging and Debugging

### Structured Logging

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export default function loggingExtension(pi: ExtensionAPI) {
  const logs: LogEntry[] = [];

  function log(level: LogEntry["level"], message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
    logs.push(entry);
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  pi.on("session_start", async () => {
    log("info", "Session started");
  });

  pi.on("tool_call", async (event) => {
    log("info", `Tool call: ${event.toolName}`, { input: event.input });
  });

  pi.on("tool_result", async (event) => {
    if (event.isError) {
      log("error", `Tool error: ${event.toolName}`, { error: event.content[0]?.text });
    }
  });

  // Command to dump logs
  pi.registerCommand("dump-logs", {
    description: "Dump extension logs",
    handler: async (args, ctx) => {
      const output = logs.map(l => 
        `[${l.timestamp}] ${l.level.toUpperCase()}: ${l.message}`
      ).join("\n");
      ctx.ui.notify(output, "info");
    },
  });
}
```

### Debug Mode

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function debugExtension(pi: ExtensionAPI) {
  let debugMode = false;

  pi.registerCommand("debug", {
    description: "Toggle debug mode",
    handler: async (args, ctx) => {
      debugMode = !debugMode;
      ctx.ui.notify(`Debug mode: ${debugMode ? "ON" : "OFF"}`, "info");
    },
  });

  pi.on("tool_call", async (event) => {
    if (debugMode) {
      console.log(`[DEBUG] Tool: ${event.toolName}`);
      console.log(`[DEBUG] Input:`, JSON.stringify(event.input, null, 2));
    }
  });

  pi.on("tool_result", async (event) => {
    if (debugMode) {
      console.log(`[DEBUG] Result: ${event.toolName}`);
      console.log(`[DEBUG] Output:`, JSON.stringify(event.content, null, 2));
    }
  });
}
```
