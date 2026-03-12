// Export all shared utilities
export * from './correlation';
export * from './logger';

// Common utility functions
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  return fn().catch(async (error) => {
    if (maxRetries > 0) {
      await sleep(delay);
      return retry(fn, maxRetries - 1, delay * 2);
    }
    throw error;
  });
}

export function sanitizeError(error: any): { message: string; code?: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }
  
  if (typeof error === 'string') {
    return { message: error };
  }
  
  return { message: 'Unknown error occurred' };
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}