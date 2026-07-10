import { spawn } from 'child_process';
import * as path from 'path';
import { IpcServer, InterceptRequest, InterceptDecision } from '../../guard/ipc';
import { GuardManager } from '../../guard/manager';
import { ProxyServer } from '../../proxy/server';
import { TelemetryDB } from '../../telemetry/db';
import { intro, outro, confirm, note, isCancel } from '@clack/prompts';
import pc from 'picocolors';

export async function runCommand(agentCommand: string[]) {
  intro(pc.bgBlue(pc.white(' 🛡️ Agent-Gate: The Watchtower ')));

  if (agentCommand.length === 0) {
    console.error(pc.red('Error: No agent command provided. Example: agent-gate run -- claude-code'));
    process.exit(1);
  }

  // 1. Setup IPC Server
  const ipc = new IpcServer();
  const port = await ipc.start();
  note(`IPC Server running on port ${port}`, 'Guard System');

  // 2. Setup GuardManager (Interception Shims)
  const riskyCommands = ['rm', 'git', 'npm', 'curl', 'wget'];
  const guard = new GuardManager(riskyCommands);
  const shimsDir = await guard.setup();

  // 2.5 Setup API Proxy Server & Telemetry
  const db = new TelemetryDB();
  const proxy = new ProxyServer();
  const proxyPort = 8080; // Hardcoded for now, could be dynamic
  await proxy.start(proxyPort);
  note(`API Proxy listening on http://localhost:${proxyPort}`, 'Gate System');
  
  // Clean up on exit
  const cleanup = () => {
    guard.cleanup();
    ipc.stop();
    proxy.stop();
  };
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('exit', cleanup);

  // 3. Listen for interceptions and display TUI
  ipc.on('intercept', async (req: InterceptRequest) => {
    console.log('\n');
    note(
      pc.yellow(`Command: ${req.command} ${req.args.join(' ')}`) + '\n' +
      pc.dim(`Directory: ${req.cwd}`),
      pc.red('⚠️ Guardrail Triggered')
    );

    const result = await confirm({
      message: 'Do you want to allow this command to execute?',
      initialValue: false
    });

    if (isCancel(result)) {
      ipc.resolveIntercept(req.id, 'deny');
      db.logInterception(req.id, req.command, req.args, req.cwd, 'deny');
      outro(pc.red('Execution denied by user.'));
    } else {
      const decision: InterceptDecision = result ? 'approve' : 'deny';
      ipc.resolveIntercept(req.id, decision);
      db.logInterception(req.id, req.command, req.args, req.cwd, decision);
      
      if (decision === 'approve') {
        console.log(pc.green('✔ Execution approved.'));
      } else {
        console.log(pc.red('✖ Execution denied.'));
      }
    }
  });

  // 4. Execute the agent
  const [cmd, ...args] = agentCommand;
  const originalPath = process.env.PATH || '';
  const newPath = `${shimsDir}${path.delimiter}${originalPath}`;

  note(`Spawning agent: ${agentCommand.join(' ')}`, 'Agent Execution');

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: newPath,
      AGENT_GATE_IPC_PORT: port.toString(),
      OPENAI_BASE_URL: `http://localhost:${proxyPort}/v1`,
      OPENAI_API_BASE: `http://localhost:${proxyPort}/v1`
    },
    shell: process.platform === 'win32'
  });

  child.on('close', (code) => {
    outro(pc.green(`Agent execution finished with code ${code}`));
    process.exit(code || 0);
  });
}
