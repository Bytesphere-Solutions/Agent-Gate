import express from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { estimateTokens, estimateCost } from './tokens';
import pc from 'picocolors';

export class ProxyServer {
  private app = express();
  private server: any;
  public totalTokens: number = 0;
  public totalCost: number = 0;

  constructor() {
    this.app.use(express.json({ limit: '10mb' }));

    // Proxy configuration for OpenAI-like endpoints
    this.app.use('/v1', createProxyMiddleware({
      target: 'https://api.openai.com',
      changeOrigin: true,
      on: {
        proxyReq: fixRequestBody,
        proxyRes: (proxyRes, req, res) => {
          let body = '';
          proxyRes.on('data', chunk => {
            body += chunk;
          });
          
          proxyRes.on('end', () => {
            try {
              // Try to parse token usage from the provider's response if it supports it
              const responseData = JSON.parse(body);
              let inputTokens = 0;
              let outputTokens = 0;
              let model = 'gpt-4o';

              if (responseData.usage) {
                inputTokens = responseData.usage.prompt_tokens || 0;
                outputTokens = responseData.usage.completion_tokens || 0;
                model = responseData.model || model;
              } else if ((req as any).body && (req as any).body.messages) {
                // Fallback to estimation if usage isn't provided
                const promptText = (req as any).body.messages.map((m: any) => m.content).join(' ');
                inputTokens = estimateTokens(promptText);
                
                if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
                  outputTokens = estimateTokens(responseData.choices[0].message.content || '');
                }
                model = (req as any).body.model || model;
              }

              const reqCost = estimateCost(inputTokens, outputTokens, model);
              this.totalTokens += (inputTokens + outputTokens);
              this.totalCost += reqCost;

              console.log(
                pc.dim('[Proxy]') + ' ' +
                pc.cyan(`Tokens: ${inputTokens + outputTokens}`) + ' | ' +
                pc.green(`Cost: $${reqCost.toFixed(5)}`)
              );
            } catch (e) {
              // Ignore JSON parse errors for non-JSON responses or streaming
            }
          });
        }
      }
    }));
  }

  public async start(port: number = 8080): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        resolve();
      });
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
    }
  }
}
