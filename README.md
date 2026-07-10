# 🛡️ Agent-Gate

> **A Firewall & Telemetry Proxy for Coding Agents**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)

**Agent-Gate** is a lightweight, local proxy and CLI that sits between autonomous AI coding agents (like Claude Code, Cursor, Codex, OpenDevin, and Continue) and your system. It acts as an interactive guardrail, intercepting terminal executions, file changes, and outbound network requests to keep your machine safe.

Developers and enterprises are terrified of AI agents running a rogue `rm -rf`, leaking API keys, or fetching malicious dependencies. Agent-Gate solves this by enforcing **human-in-the-loop approvals** for sensitive operations and tracking exactly what the agent is doing.

---

## Key Features

- **Interactive Guardrails**: A beautiful Terminal UI (TUI) that asks for your explicit approval when an agent attempts a sensitive command (e.g., `git push`, `npm install`, `rm`).
- **Agent Telemetry**: Logs exactly what the agent did in a clean, readable Markdown format and local SQLite database for later auditing.
- **Cost & Token Tracker**: Intercepts API requests to track exactly how many tokens the local or API-based agent is burning per task, giving you a real-time view of your costs.
- **Universal Compatibility**: Works with any agent that uses standard system commands and HTTP APIs.
- **Zero-Config Setup**: Easy to install and run locally via `npm`.

## Architecture

Agent-Gate operates using three main components:

1. **The Gate (Network Proxy)**: Intercepts LLM API requests to track tokens, estimate costs, and log the agent's prompts/responses.
2. **The Guard (Command Interceptor)**: A smart `PATH` shim system that wraps common risky commands. When an agent attempts a command, the shim sends an IPC message to the Agent-Gate process and pauses execution.
3. **The Watchtower (Interactive TUI)**: The developer interface where you approve, deny, or modify command executions in real-time.

## 📁 File Structure

```text
agent-gate/
├── bin/
│   └── agent-gate.js         # CLI entry point
├── shims/                    # Shim scripts for command interception (generated dynamically)
├── src/
│   ├── cli/                  # Command Line Interface & TUI
│   ├── proxy/                # HTTP/HTTPS Proxy for API interception
│   ├── guard/                # Command interception & IPC communication
│   ├── telemetry/            # Logging, SQLite DB, token tracking
│   ├── config/               # Configuration management (rule sets)
│   └── index.ts              # Core application logic
├── docs/                     # Detailed documentation
└── tests/                    # Unit and integration tests
```

## Getting Started

### Installation

*Agent-Gate is now available on the global NPM registry! You can install it globally via npm:*

```bash
npm install -g @parajulisandip0000/agent-gate
```

### Usage

To start Agent-Gate and run an agent through it, simply prefix the agent's command with `agent-gate`:

```bash
agent-gate run -- claude-code
```

This will:
1. Start the Agent-Gate TUI and telemetry engine.
2. Inject the command shims into the agent's environment.
3. Proxy API requests to track token usage.

#### Manual Configuration

If your agent runs as a daemon or background service, you can start the gate manually:

```bash
agent-gate start
```

Then configure your agent to use the Agent-Gate proxy (default: `http://localhost:8080`) and ensure the shim directory is in its `PATH`.

## Configuration

Agent-Gate is highly configurable. You can define rules for which commands require approval, which are auto-approved, and which are strictly denied.

Create an `agent-gate.config.json` in your project root or `~/.agent-gate/`:

```json
{
  "guardrails": {
    "requireApproval": ["git push", "npm install", "rm", "curl"],
    "autoApprove": ["git status", "ls", "cat"],
    "deny": ["rm -rf /"]
  },
  "proxy": {
    "port": 8080,
    "trackTokens": true
  }
}
```

## Contributing

We welcome contributions! Whether it's adding support for new agents, improving the TUI, or refining the token tracking algorithms, your help is appreciated.

Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
