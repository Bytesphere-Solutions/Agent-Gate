import { get_encoding } from 'tiktoken';

// Simple token counter that works well enough for general models (e.g. gpt-4, claude-3)
// In a full production system, we'd pick the exact encoding based on the requested model.
export function estimateTokens(text: string): number {
  try {
    const enc = get_encoding("cl100k_base");
    const tokens = enc.encode(text);
    const count = tokens.length;
    enc.free();
    return count;
  } catch (err) {
    console.error("Token estimation error", err);
    return 0;
  }
}

export function estimateCost(promptTokens: number, completionTokens: number, model: string = 'gpt-4o'): number {
  // Mock pricing per 1M tokens (in USD)
  const pricing: Record<string, { input: number, output: number }> = {
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  };

  const rates = pricing[model] || pricing['gpt-4o']; // Default fallback
  const inputCost = (promptTokens / 1_000_000) * rates.input;
  const outputCost = (completionTokens / 1_000_000) * rates.output;
  
  return inputCost + outputCost;
}
