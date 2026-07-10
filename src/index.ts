#!/usr/bin/env node

import { Command } from 'commander';
import { runCommand } from './cli/commands/run';
import { logsCommand } from './cli/commands/logs';

const program = new Command();

program
  .name('agent-gate')
  .description('A Firewall & Telemetry Proxy for Coding Agents')
  .version('1.0.0');

program
  .command('run')
  .description('Run an agent through the Agent-Gate guardrails')
  .allowUnknownOption()
  .action((_, command) => {
    // commander parsing for variadic unknown args after `--` can be tricky
    // so we manually parse process.argv
    const args = process.argv.slice(3);
    if (args[0] === '--') {
      args.shift();
    }
    runCommand(args).catch(err => {
      console.error(err);
      process.exit(1);
    });
  });

program
  .command('logs')
  .description('View telemetry and intercept logs')
  .action(() => {
    logsCommand().catch(err => {
      console.error(err);
      process.exit(1);
    });
  });

program.parse(process.argv);
