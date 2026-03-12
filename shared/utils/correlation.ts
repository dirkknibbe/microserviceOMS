import { v4 as uuidv4 } from 'uuid';

// Correlation ID utilities for distributed tracing
export class CorrelationIdGenerator {
  static generate(): string {
    return uuidv4();
  }

  static isValid(correlationId: string): boolean {
    return typeof correlationId === 'string' && correlationId.length > 0;
  }
}

// Context storage for correlation ID in Node.js services
export class CorrelationContext {
  private static context = new Map<string, string>();

  static set(correlationId: string): void {
    // In a real implementation, you'd use AsyncLocalStorage
    // This is a simplified version for demonstration
    this.context.set('current', correlationId);
  }

  static get(): string | undefined {
    return this.context.get('current');
  }

  static getOrGenerate(): string {
    const existing = this.get();
    if (existing) {
      return existing;
    }
    const newId = CorrelationIdGenerator.generate();
    this.set(newId);
    return newId;
  }

  static clear(): void {
    this.context.delete('current');
  }
}