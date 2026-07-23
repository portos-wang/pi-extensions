/**
 * ARS (Academic Research Skills) — Auto-routing extension for pi.
 *
 * Intercepts user input and automatically routes to the correct ARS skill
 * based on trigger keyword detection. No manual `/ars-*` commands needed.
 *
 * Detection: before_agent_start event → match keywords → inject routing
 * instruction into system prompt → agent loads the matched skill automatically.
 *
 * Also handles:
 * - SessionStart announce (loaded resources)
 * - PreToolUse write-scope guard (Bucket A agents)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);

const EXT_DIR = dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = resolve(EXT_DIR, "..");
const GUARD_SCRIPT = resolve(REPO_ROOT, "scripts", "ars_write_scope_guard.py");

// ── Skill routing table ──────────────────────────────────────────────────
// Each entry: { skill, mode, triggers, excludes }
// - skill: SKILL.md directory name
// - mode: specific mode to activate (null = let skill auto-detect)
// - triggers: keywords/phrases that activate this skill (case-insensitive)
// - excludes: phrases that PREVENT this skill from triggering (higher priority)

interface SkillRoute {
  skill: string;
  mode: string | null;
  triggers: RegExp;
  excludes: RegExp;
  description: string;
}

const ROUTES: SkillRoute[] = [
  // ── academic-pipeline ──────────────────────────────────────────────────
  {
    skill: "academic-pipeline",
    mode: null,
    triggers:
      /\b(academic[\s-]?pipeline|research[\s-]?to[\s-]?paper|full[\s-]?paper[\s-]?workflow|paper[\s-]?pipeline|end[\s-]?to[\s-]?end[\s-]?paper|complete[\s-]?paper[\s-]?workflow|연구부터\s*논문까지|논문\s*전체\s*워크플로)\b/i,
    excludes: /^$/,
    description: "Full academic pipeline (research → write → review → revise → finalize)",
  },

  // ── academic-paper-reviewer ────────────────────────────────────────────
  {
    skill: "academic-paper-reviewer",
    mode: null,
    triggers:
      /\b(review\s+(?:this\s+)?paper|peer[\s-]?review|manuscript[\s-]?review|referee[\s-]?report|review\s+my\s+paper|critique\s+(?:this\s+)?paper|simulate[\s-]?review|editorial[\s-]?review|calibrate[\s-]?reviewer|reviewer[\s-]?calibration|논문\s*심사|동료\s*심사|모의\s*심사|심사자|審查\s*論文|論文\s*審查|模擬\s*審查|同儕\s*審查|幫我\s*審)\b/i,
    excludes:
      /\b(revision|revise|rebuttal|response\s+letter|modify|修改|修訂| revision-coach)\b/i,
    description: "Multi-perspective paper review (5 reviewers)",
  },

  // ── deep-research ──────────────────────────────────────────────────────
  {
    skill: "deep-research",
    mode: "systematic-review",
    triggers:
      /\b(systematic[\s-]?review|meta[\s-]?analysis|PRISMA|evidence[\s-]?synthesis|後設分析|系統性\s*(回顧|文獻\s*回顧)|메타분석|체계적\s*문헌)\b/i,
    excludes: /^$/,
    description: "deep-research → systematic-review mode",
  },
  {
    skill: "deep-research",
    mode: "lit-review",
    triggers:
      /\b(lit[\s-]?review|literature[\s-]?review|文獻\s*(回顧|探討)|文獻\s*綜述|문헌\s*조사|문헌\s*고찰)\b/i,
    excludes:
      /\b(paper|write|draft|writing|写作|寫作|撰写|撰寫|drafting)\b/i,
    description: "deep-research → lit-review mode",
  },
  {
    skill: "deep-research",
    mode: "three-way-scan",
    triggers:
      /\b(three[\s-]?way[\s-]?scan|WHY\s*HOW\s*WHAT|3W|三段式\s*文獻\s*掃描|why\s+how\s+what\s+paper)\b/i,
    excludes: /^$/,
    description: "deep-research → three-way-scan mode",
  },
  {
    skill: "deep-research",
    mode: "fact-check",
    triggers:
      /\b(fact[\s-]?check|事實\s*查核|verif(?:y|ication)\s+claim|팩트체크|事实核查)\b/i,
    excludes: /^$/,
    description: "deep-research → fact-check mode",
  },
  {
    skill: "deep-research",
    mode: "socratic",
    triggers:
      /\b(guid(?:e|ed)\s+my\s+research|help\s+me\s+think\s+through|引导?\s*我的\s*研究|幫我\s*釐清|幫我\s*想想|我不確定\s*要\s*研究什麼|연구\s*방향|연구\s*주제|심층\s*연구|引导?\s*我的\s*研究|幫我\s*釐清\s*研究)\b/i,
    excludes: /^$/,
    description: "deep-research → socratic mode (guided research dialogue)",
  },
  {
    skill: "deep-research",
    mode: "full",
    triggers:
      /\b(deep[\s-]?research|研究|深度研究|research\s+(?:on|about|the|into)|fact[\s-]?check|事实查核|事實查核|팩트체크|심층\s*연구)\b/i,
    excludes:
      /\b(paper|write|draft|writing|review\s+my|写作|寫作|撰写|撰寫|drafting|-peer[\s-]?review|manuscript|peer[\s-]?review)\b/i,
    description: "deep-research → full mode",
  },

  // ── academic-paper ─────────────────────────────────────────────────────
  {
    skill: "academic-paper",
    mode: "plan",
    triggers:
      /\b(plan\s+my\s+paper|paper\s+plan|chapter[\s-]?by[\s-]?chapter|Socratic\s+plan|規劃\s*論文|論文\s*計畫|幫我\s*規劃|논문\s*계획|논문\s*계획을\s*도와줘)\b/i,
    excludes: /^$/,
    description: "academic-paper → plan mode (Socratic chapter planning)",
  },
  {
    skill: "academic-paper",
    mode: "outline",
    triggers:
      /\b(paper\s+outline|outline\s+(?:my\s+)?paper|detailed\s+outline|outline[\s-]?only|論文\s*大綱|大纲|大綱|논문\s*개요)\b/i,
    excludes: /\b(full|complete|entire|整篇| 전체)\b/i,
    description: "academic-paper → outline-only mode",
  },
  {
    skill: "academic-paper",
    mode: "revision-coach",
    triggers:
      /\b(revision[\s-]?coach|parse\s+reviewer\s+comments|revision[\s-]?roadmap|response\s+letter\s+skeleton| reviewer\s+comments|審查\s*意見|評估\s*回覆|심사\s*의견|심사\s*의견\s*반영|回答서\s*점검|幫我\s*修改|我收到\s*審查)\b/i,
    excludes: /\b(existing|draft|我的草稿|我的.*稿|已有.*稿)\b/i,
    description: "academic-paper → revision-coach mode",
  },
  {
    skill: "academic-paper",
    mode: "rebuttal-audit",
    triggers:
      /\b(rebuttal[\s-]?audit|QA\s+rebuttal|rebuttal\s+draft|response\s+draft\s+review|回覆\s*審查|答复.*审查|已有.*回覆.*審查|심사\s*답변)\b/i,
    excludes: /^$/,
    description: "academic-paper → rebuttal-audit mode (needs existing draft)",
  },
  {
    skill: "academic-paper",
    mode: "revision",
    triggers:
      /\b(revise\s+(?:my\s+)?paper|revision\s+(?:of\s+)?(?:my\s+)?paper|paper\s+revision|R&R|response[\s-]?to[\s-]?reviewers|修改\s*論文|修訂\s*論文|修订|논문\s*수정|심사\s*의견\s*반영)\b/i,
    excludes: /\b(coach|roadmap|skeleton|parse|僅|只|只是)\b/i,
    description: "academic-paper → revision mode (revised draft + R&R responses)",
  },
  {
    skill: "academic-paper",
    mode: "abstract",
    triggers:
      /\b(write\s+(?:an?\s+)?abstract|abstract[\s-]?only|bilingual\s+abstract|摘要|writing\s+abstract|寫摘要|초록\s*작성|中文\s*摘要)\b/i,
    excludes: /\b(full\s+paper|entire\s+paper|整篇|全文)\b/i,
    description: "academic-paper → abstract-only mode (bilingual abstract + keywords)",
  },
  {
    skill: "academic-paper",
    mode: "citation-check",
    triggers:
      /\b(citation[\s-]?check|check\s+(?:my\s+)?citations|check\s+citation|citation\s+error|reference\s+check|reference\s+error|引用\s*檢查|引用\s*格式| citation\s+format|인용\s*확인|인용\s*형식\s*검사)\b/i,
    excludes: /^$/,
    description: "academic-paper → citation-check mode",
  },
  {
    skill: "academic-paper",
    mode: "format-convert",
    triggers:
      /\b(format[\s-]?convert|convert(?:ing)?\s+(?:to\s+)?(?:LaTeX|DOCX|PDF|Markdown)|轉\s*(?:成|到|為)?\s*(?:LaTeX|DOCX|PDF|Markdown)|格式\s*轉換|latex\s+convert|轉換\s*格式|format\s+paper|LaTeX\s+變換|변환|서식\s*변환)\b/i,
    excludes: /^$/,
    description: "academic-paper → format-convert mode",
  },
  {
    skill: "academic-paper",
    mode: "disclosure",
    triggers:
      /\b(AI[\s-]?disclosure|disclosure\s+statement|AI\s+usage\s+statement|AI\s+使用\s+고지|AI\s*披露|AI\s*声明|AI\s*揭露)\b/i,
    excludes: /^$/,
    description: "academic-paper → disclosure mode (AI-usage statement)",
  },
  {
    skill: "academic-paper",
    mode: "lit-review",
    triggers:
      /\b(annotated\s+bibliography|literature\s+review\s+section|文獻\s*回顧\s*論文|文献综述.*论文)\b/i,
    excludes: /^$/,
    description: "academic-paper → lit-review mode (annotated bibliography in paper format)",
  },
  {
    skill: "academic-paper",
    mode: null,
    triggers:
      /\b(write\s+(?:a\s+)?(?:paper|article|manuscript)|academic\s+paper|paper\s+writing|寫\s*論文|學術\s*論文|引导?\s*我\s*寫?\s*論文|幫我\s*寫\s*論文|逐步\s*寫\s*論文|寫方法論|寫\s*討論|논문\s*작성|논문\s*초안|논문\s*작성|학술지\s*논문|학회\s*논문|논문\s*계속|逐步\s*到\s*논문)\b/i,
    excludes:
      /\b(review|peer[\s-]?review|critique|審查|심사|reviewer)\b/i,
    description: "academic-paper (auto-detect mode from user intent)",
  },
];

// ── Infrastructure-protected globs ───────────────────────────────────────

const INFRA_PROTECTED_GLOBS = [
  "extensions/*.ts",
  "scripts/ars_write_scope_guard.py",
  "scripts/ars_phase_scope_manifest.json",
  "scripts/check_v3_10_134_write_scope.py",
  "deep-research/agents/*.md",
  "academic-paper/agents/*.md",
  "academic-paper-reviewer/agents/*.md",
  "academic-pipeline/agents/*.md",
  "shared/agents/*.md",
  "agents/*.md",
];

const INSPECTED_TOOLS = new Set(["write", "edit", "bash"]);

// ── Helpers ──────────────────────────────────────────────────────────────

function extractFilePath(
  toolName: string,
  input: Record<string, unknown>,
): string | null {
  if (toolName === "bash") return null;
  return (input.path ?? input.file_path) as string | null;
}

function matchesInfraGlob(filePath: string): boolean {
  for (const glob of INFRA_PROTECTED_GLOBS) {
    if (glob.startsWith("**/")) {
      const suffix = glob.slice(3);
      if (filePath.endsWith(suffix) || filePath.includes("/" + suffix))
        return true;
    } else if (glob.includes("*.")) {
      const parts = glob.split("/");
      const filePart = parts[parts.length - 1];
      const dirPart = parts.slice(0, -1).join("/");
      const ext = filePart.replace("*", "");
      if (filePath.startsWith(dirPart + "/") && filePath.endsWith(ext))
        return true;
    } else {
      if (filePath === glob) return true;
    }
  }
  return false;
}

async function runWriteScopeGuard(
  toolName: string,
  input: Record<string, unknown>,
  cwd: string,
): Promise<{ allow: boolean; reason?: string }> {
  if (!existsSync(GUARD_SCRIPT)) return { allow: true };

  const payload = { tool_name: toolName, tool_input: input, cwd };

  try {
    const python = process.platform === "win32" ? "python" : "python3";
    const { stdout } = await execFileAsync(python, [GUARD_SCRIPT], {
      input: JSON.stringify(payload),
      cwd: REPO_ROOT,
      timeout: 5000,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    });

    const output = JSON.parse(stdout.trim());
    const hookOutput = output?.hookSpecificOutput;
    if (!hookOutput) return { allow: true };
    if (hookOutput.permissionDecision === "deny") {
      return {
        allow: false,
        reason: hookOutput.reason ?? "Write blocked by ARS write-scope guard",
      };
    }
    return { allow: true };
  } catch {
    return { allow: true }; // graceful degradation
  }
}

// ── Skill auto-detection ─────────────────────────────────────────────────

interface DetectedSkill {
  skill: string;
  mode: string | null;
  description: string;
}

/**
 * Detect which ARS skill matches the user's input text.
 * Returns the best match or null if no skill triggers.
 *
 * Detection order matters: more specific routes (e.g. systematic-review)
 * are checked before general ones (e.g. deep-research full).
 */
function detectSkill(text: string): DetectedSkill | null {
  // Skip detection for short inputs, commands, or code
  if (text.length < 5) return null;
  if (text.startsWith("/")) return null; // explicit command
  if (text.startsWith("[direct-mode]")) return null; // escape hatch

  for (const route of ROUTES) {
    if (route.triggers.test(text) && !route.excludes.test(text)) {
      return {
        skill: route.skill,
        mode: route.mode,
        description: route.description,
      };
    }
  }
  return null;
}

// ── Extension ────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── SessionStart announce ────────────────────────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify(
      [
        "ARS (academic-research-skills) loaded — auto-routing active.",
        "",
        "Just describe what you need in natural language:",
        '  • "Research the impact of AI on education" → deep-research',
        '  • "Write a paper on declining birth rates" → academic-paper',
        '  • "Review this paper" → academic-paper-reviewer',
        '  • "Guide my research" → deep-research (socratic)',
        '  • "Parse reviewer comments" → academic-paper (revision-coach)',
        "",
        "Or use explicit commands: /ars-full, /ars-plan, /skill:academic-paper, etc.",
        "Prefix with [direct-mode] to bypass auto-routing.",
      ].join("\n"),
      "info",
    );
  });

  // ── Auto-routing via before_agent_start ──────────────────────────────
  // Detects skill from user input and injects routing instruction into
  // the system prompt. The agent then loads the matched skill automatically.
  pi.on("before_agent_start", async (event, ctx) => {
    const prompt = event.prompt;
    if (!prompt) return;

    const detected = detectSkill(prompt);
    if (!detected) return;

    // Build a concise routing instruction for the system prompt.
    // This tells the agent WHICH skill to load and HOW to use it,
    // without bloating the context with full skill content.
    const modeLine = detected.mode
      ? `Use **${detected.mode}** mode.`
      : "Auto-detect the best mode from the user's intent.";

    const routingInstruction = [
      "",
      "## ARS Auto-Routing",
      `The user's request matches the **${detected.skill}** skill. ${modeLine}`,
      `Load the skill by reading: skills/${detected.skill}/SKILL.md`,
      `Then follow the skill's instructions for the detected mode.`,
      "Do NOT ask the user which skill to use — the match is automatic.",
      "",
    ].join("\n");

    return {
      systemPrompt: event.systemPrompt + routingInstruction,
    };
  });

  // ── PreToolUse write-scope guard ─────────────────────────────────────
  pi.on("tool_call", async (event, ctx) => {
    const toolName = event.toolName.toLowerCase();
    if (!INSPECTED_TOOLS.has(toolName)) return;

    const filePath = extractFilePath(toolName, event.input);

    if (filePath && matchesInfraGlob(filePath)) {
      return {
        block: true,
        reason: `Write to infrastructure-protected path blocked: ${filePath}`,
      };
    }

    const result = await runWriteScopeGuard(toolName, event.input, ctx.cwd);
    if (!result.allow) {
      return {
        block: true,
        reason: result.reason ?? "Blocked by ARS write-scope guard",
      };
    }
  });
}
