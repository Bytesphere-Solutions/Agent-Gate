import { TelemetryDB } from '../../telemetry/db';
import { intro, outro, note } from '@clack/prompts';
import pc from 'picocolors';

export async function logsCommand() {
  intro(pc.bgMagenta(pc.white(' 📊 Agent-Gate: The Watchtower Dashboard ')));
  
  const db = new TelemetryDB();
  
  try {
    const costSummary = await db.getCostSummary();
    const interceptions = await db.getRecentInterceptions(15);
    
    note(
      pc.cyan(`Total Tokens: ${costSummary.total_tokens.toLocaleString()}`) + '\n' +
      pc.green(`Total API Cost: $${costSummary.total_cost.toFixed(5)}`),
      '💰 Usage Summary'
    );
    
    if (interceptions.length === 0) {
      console.log(pc.dim('No guardrail interceptions recorded yet.'));
    } else {
      console.log(pc.bold('🛡️ Recent Interceptions:'));
      console.log('----------------------------------------------------');
      
      for (const req of interceptions) {
        const time = new Date(req.timestamp).toLocaleString();
        const argsStr = JSON.parse(req.args).join(' ');
        
        let status = req.decision === 'approve' 
          ? pc.green('✔ APPROVED') 
          : pc.red('✖ DENIED');
          
        console.log(`[${pc.dim(time)}] ${status} - ${pc.yellow(req.command)} ${argsStr}`);
      }
      console.log('----------------------------------------------------\n');
    }
  } catch (e: any) {
    console.error(pc.red('Error reading telemetry data:'), e.message);
  } finally {
    db.close();
  }
  
  outro(pc.dim('Run `agent-gate run -- <agent-command>` to capture more telemetry.'));
}
