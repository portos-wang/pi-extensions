# PI Extensions

A collection of extensions, skills, and tools converted from **Claude Code** and **OpenAI Codex** to work with [pi](https://github.com/earendil-works/pi-coding-agent), the open-source coding agent harness.

## Purpose

This repository serves as a centralized hub for porting plugins, extensions, hooks, and configurations from Claude Code and Codex ecosystems into pi's extension system. It enables users to leverage existing Claude Code and Codex community tools within pi's unified extension architecture.

## Repository Structure

```
pi-extensions/
├── academic-research-skills-pi-extension/  # Converted academic research pipeline
├── convert-to-pi/                          # Skill for converting CC/Codex → pi
└── README.md
```

---

## Components

### 1. Academic Research Skills (PI Extension)

**Source:** [Imbad0202/academic-research-skills](https://github.com/Imbad0202/academic-research-skills)
**Version:** 3.18.0
**License:** CC-BY-NC-4.0

A production-grade academic research pipeline for pi, originally developed for Claude Code. This extension provides a comprehensive suite of skills covering the full academic workflow from research to publication.

#### Features

- **4 Core Skills** with 27 operational modes and a 39-agent ensemble
- **Deep Research** — 13-agent research team with Socratic guided mode, PRISMA systematic review, and cross-model verification
- **Academic Paper** — 12-agent paper writing with Style Calibration, Writing Quality Check, LaTeX hardening, and anti-leakage protocol
- **Academic Paper Reviewer** — 7-agent multi-perspective peer review with 0–100 quality rubrics
- **Academic Pipeline** — 10-stage pipeline orchestrator with adaptive checkpoints and claim verification

#### Installation

```bash
# From this repository
git clone https://github.com/portos-wang/pi-extensions.git
cd pi-extensions
pi install ./academic-research-skills-pi-extension

# Or install globally for all projects
pi install -g ./academic-research-skills-pi-extension

# Or manually copy to ~/.pi/agent/extensions/
cp -r academic-research-skills-pi-extension ~/.pi/agent/extensions/
```

#### Available Commands

| Command | Description |
|---------|-------------|
| `/ars-plan` | Socratic dialogue for paper structure planning |
| `/ars-lit-review` | Literature review with systematic search |
| `/ars-abstract` | Abstract generation and refinement |
| `/ars-full` | Full paper draft generation |
| `/ars-reviewer` | Multi-perspective peer review |
| `/ars-revision` | Revision coaching and improvement |
| `/ars-citation-check` | Citation verification and formatting |
| `/ars-format-convert` | Convert between citation styles (APA, MLA, Chicago, etc.) |

#### Directory Structure

```
academic-research-skills-pi-extension/
├── extensions/          # PI extension entry points
├── skills/              # Core skill definitions
│   ├── academic-paper/
│   ├── academic-paper-reviewer/
│   ├── academic-pipeline/
│   └── deep-research/
├── prompts/             # Slash command prompts
├── hooks/               # Pre/post tool hooks
├── scripts/             # Utility scripts
├── shared/              # Shared schemas and protocols
└── package.json         # PI package manifest
```

---

### 2. Convert to Pi (Skill)

A pi skill designed to automate the conversion of Claude Code and OpenAI Codex extensions, plugins, hooks, and configurations into pi extensions.

#### Purpose

When you have existing Claude Code or Codex plugins that you want to use with pi, this skill guides you through the conversion process, mapping platform-specific patterns to their pi equivalents.

#### Supported Source Formats

**Claude Code:**
- `CLAUDE.md` / `CLAUDE.local.md` files (project rules, custom instructions)
- `.claude/rules/*.md` files (granular rule files)
- Pre/post tool hooks (PreToolUse, PostToolUse, etc.)
- Custom slash commands (`.claude/commands/*.md`)
- MCP server configurations (`.claude/mcp.json`)
- Permission policies and allowed/disallowed tool patterns

**Codex:**
- `AGENTS.md` files (project context and instructions)
- Custom instructions / system prompts
- Tool overrides or policy files
- Any custom configurations in `.codex/` or similar directories

#### Usage

```bash
# Invoke the skill
pi skill convert-to-pi

# Or describe what you want to convert
# "Convert my CLAUDE.md rules to a pi extension"
# "Port my PreToolUse hooks to pi"
```

#### Conversion Mappings

| Source (Claude Code / Codex) | Target (PI) |
|------------------------------|-------------|
| `CLAUDE.md` / `AGENTS.md` | `before_agent_start` event |
| PreToolUse hooks | `tool_call` event |
| PostToolUse hooks | `tool_result` event |
| Custom slash commands | `registerCommand()` |
| MCP servers | `registerTool()` / `registerProvider()` |
| Permission policies | `tool_call` with `block: true` |

#### Directory Structure

```
convert-to-pi/
├── SKILL.md                   # Skill definition and workflow
├── references/
│   ├── claude-code-mapping.md # CC → PI mapping reference
│   ├── codex-mapping.md       # Codex → PI mapping reference
│   └── common-patterns.md     # Shared conversion patterns
└── templates/
    ├── extension-skeleton.ts  # Basic extension template
    └── tool-skeleton.ts       # Custom tool template
```

---

## Quick Start

### Prerequisites

- [pi](https://github.com/earendil-works/pi-coding-agent) (latest version)
- Node.js 18+ (for extension development)

### Installation

```bash
# Clone the repository
git clone https://github.com/portos-wang/pi-extensions.git
cd pi-extensions

# Install the academic research skills extension
pi install ./academic-research-skills-pi-extension

# Or install from a specific project directory
pi install /path/to/pi-extensions/academic-research-skills-pi-extension
```

### Verify Installation

```bash
# Start pi and test a command
pi

# In pi, run:
/ars-plan
```

---

## Contributing

Contributions are welcome! This repository accepts:

1. **Converted extensions** from Claude Code or Codex
2. **New conversion mappings** for the `convert-to-pi` skill
3. **Bug fixes** and improvements to existing extensions
4. **Documentation** updates

### Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-extension`)
3. Commit your changes (`git commit -m 'Add my extension'`)
4. Push to the branch (`git push origin feature/my-extension`)
5. Open a Pull Request

---

## License

This repository contains components with different licenses:

- **academic-research-skills-pi-extension:** [CC-BY-NC-4.0](https://creativecommons.org/licenses/by-nc/4.0/)
- **convert-to-pi:** MIT
- **Other contributions:** MIT unless otherwise specified

---

## Acknowledgments

- [Imbad0202](https://github.com/Imbad0202) for the original academic-research-skills project
- [earendil-works](https://github.com/earendil-works) for the pi coding agent harness
- The Claude Code and Codex communities for inspiring these tools

---

## Links

- [PI Documentation](https://github.com/earendil-works/pi-coding-agent)
- [Original Academic Research Skills](https://github.com/Imbad0202/academic-research-skills)
- [Issues & Support](https://github.com/portos-wang/pi-extensions/issues)
