import * as fs from 'fs';
import * as path from 'path';

export class GuardManager {
  private shimsDir: string;

  constructor(private commandsToShim: string[]) {
    this.shimsDir = path.resolve(process.cwd(), 'shims');
  }

  public async setup(): Promise<string> {
    if (!fs.existsSync(this.shimsDir)) {
      fs.mkdirSync(this.shimsDir, { recursive: true });
    }

    // Write the Node.js client script that the shims will execute
    const clientScriptPath = path.join(this.shimsDir, 'shim-client.js');
    fs.writeFileSync(clientScriptPath, this.getClientScriptContent());

    // Generate wrapper scripts for each intercepted command
    for (const cmd of this.commandsToShim) {
      this.generateShim(cmd, clientScriptPath);
    }

    return this.shimsDir;
  }

  public cleanup(): void {
    if (fs.existsSync(this.shimsDir)) {
      fs.rmSync(this.shimsDir, { recursive: true, force: true });
    }
  }

  private generateShim(cmd: string, clientScriptPath: string) {
    // Windows .cmd shim
    const cmdShimPath = path.join(this.shimsDir, `${cmd}.cmd`);
    const cmdContent = `@echo off\nnode "${clientScriptPath}" "${cmd}" %*\n`;
    fs.writeFileSync(cmdShimPath, cmdContent);

    // Bash shim
    const bashShimPath = path.join(this.shimsDir, cmd);
    const bashContent = `#!/bin/bash\nnode "${clientScriptPath}" "${cmd}" "$@"\n`;
    fs.writeFileSync(bashShimPath, bashContent, { mode: 0o755 });
  }

  private getClientScriptContent(): string {
    return `
const http = require('http');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const port = process.env.AGENT_GATE_IPC_PORT;
if (!port) {
  console.error("AGENT_GATE_IPC_PORT not set");
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);
const id = crypto.randomUUID();

const reqData = JSON.stringify({
  id,
  command,
  args: commandArgs,
  cwd: process.cwd()
});

const req = http.request({
  hostname: '127.0.0.1',
  port: port,
  path: '/intercept',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(reqData)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      if (response.decision === 'approve') {
        // Execute the actual command bypass our shims dir
        // We remove our shim dir from the path so it doesn't loop
        const newPath = (process.env.PATH || '').split(require('path').delimiter).filter(p => !p.includes('shims')).join(require('path').delimiter);
        
        const result = spawnSync(command, commandArgs, {
          stdio: 'inherit',
          env: { ...process.env, PATH: newPath },
          shell: process.platform === 'win32'
        });
        process.exit(result.status !== null ? result.status : 1);
      } else {
        console.error(\`\\n[Agent-Gate] Guardrail denied execution of: \${command}\`);
        process.exit(1);
      }
    } catch (e) {
      console.error("Error parsing IPC response:", e.message);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error("Agent-Gate IPC error:", e.message);
  // Fail open or fail closed? Fail closed is safer.
  process.exit(1);
});

req.write(reqData);
req.end();
`;
  }
}
