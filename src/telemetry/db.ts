import sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export class TelemetryDB {
  private db: sqlite3.Database;

  constructor() {
    const dbPath = path.resolve(process.cwd(), 'agent-gate.sqlite');
    this.db = new sqlite3.Database(dbPath);
    this.init();
  }

  private init() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS interceptions (
          id TEXT PRIMARY KEY,
          command TEXT NOT NULL,
          args TEXT NOT NULL,
          cwd TEXT NOT NULL,
          decision TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS api_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model TEXT NOT NULL,
          input_tokens INTEGER NOT NULL,
          output_tokens INTEGER NOT NULL,
          cost REAL NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });
  }

  public logInterception(id: string, command: string, args: string[], cwd: string, decision: string) {
    const stmt = this.db.prepare(
      'INSERT INTO interceptions (id, command, args, cwd, decision) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, command, JSON.stringify(args), cwd, decision);
    stmt.finalize();
  }

  public logApiCall(model: string, inputTokens: number, outputTokens: number, cost: number) {
    const stmt = this.db.prepare(
      'INSERT INTO api_calls (model, input_tokens, output_tokens, cost) VALUES (?, ?, ?, ?)'
    );
    stmt.run(model, inputTokens, outputTokens, cost);
    stmt.finalize();
  }

  public getRecentInterceptions(limit: number = 10): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM interceptions ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  public getCostSummary(): Promise<{ total_cost: number, total_tokens: number }> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT SUM(cost) as total_cost, SUM(input_tokens + output_tokens) as total_tokens FROM api_calls',
        (err, row: any) => {
          if (err) reject(err);
          else resolve({ total_cost: row.total_cost || 0, total_tokens: row.total_tokens || 0 });
        }
      );
    });
  }

  public close() {
    this.db.close();
  }
}
