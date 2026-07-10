# 🏗️ Agent-Gate Architecture

Agent-Gate is designed to provide maximum security with minimal friction when working with autonomous AI agents. The architecture is split into three core pillars: **The Gate**, **The Guard**, and **The Watchtower**.

## 1. The Gate (Network Proxy)
Agents like Claude Code and AutoGPT constantly make API calls to OpenAI or Anthropic. Agent-Gate intercepts these calls to track how many tokens the agent is consuming in real-time.

**How it works:**
- It spawns a local Express HTTP server (e.g., `http://localhost:8080/v1`).
- The agent is instructed to use this URL as its `OPENAI_BASE_URL`.
- The proxy intercepts the request body, estimates the tokens using `tiktoken`, logs the cost, and forwards the request to the real `https://api.openai.com`.
- When the response streams back, it also calculates the completion tokens.

## 2. The Guard (Command Interceptor)
The Guard is responsible for stopping dangerous commands (like `rm`, `git push`, or `npm install`) before they execute on your machine.

**How it works:**
- Agent-Gate creates a temporary `shims/` directory.
- For every risky command, it generates an executable shim (e.g., `rm.cmd` on Windows, or an `rm` bash script on Unix).
- It injects this `shims/` directory at the *very front* of the agent's `PATH` environment variable.
- When the agent attempts to run `rm -rf /`, the system executes our shim instead.
- The shim immediately sends a JSON payload to the local Agent-Gate IPC (Inter-Process Communication) server, pausing execution until the user responds.

## 3. The Watchtower (TUI & Telemetry)
The Watchtower is the user interface and the logging engine.

**How it works:**
- Built with `@clack/prompts`, it provides a beautiful, interactive terminal UI.
- It displays the exact command the agent is trying to run and asks the user for approval.
- If approved, the IPC server replies to the shim, which then bypasses itself and executes the native system command.
- If denied, the shim exits with an error code, effectively stopping the agent in its tracks.
- *(Upcoming Phase 4)* All executions and API payloads are logged into a local SQLite database for historical auditing.
