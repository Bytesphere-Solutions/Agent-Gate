import * as http from 'http';
import { EventEmitter } from 'events';

export interface InterceptRequest {
  id: string;
  command: string;
  args: string[];
  cwd: string;
}

export type InterceptDecision = 'approve' | 'deny';

export class IpcServer extends EventEmitter {
  private server: http.Server;
  private port: number = 0;
  private pendingRequests: Map<string, (decision: InterceptDecision) => void> = new Map();

  constructor() {
    super();
    this.server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/intercept') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const data: InterceptRequest = JSON.parse(body);
            // Register callback to resolve the HTTP request
            this.pendingRequests.set(data.id, (decision) => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ decision }));
            });
            // Emit event to the UI
            this.emit('intercept', data);
          } catch (e) {
            res.writeHead(400);
            res.end('Invalid JSON');
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  }

  public async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.on('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server.address();
        if (address && typeof address !== 'string') {
          this.port = address.port;
          resolve(this.port);
        } else {
          reject(new Error('Failed to get IPC port'));
        }
      });
    });
  }

  public stop(): void {
    this.server.close();
  }

  public resolveIntercept(id: string, decision: InterceptDecision) {
    const callback = this.pendingRequests.get(id);
    if (callback) {
      callback(decision);
      this.pendingRequests.delete(id);
    }
  }
}
