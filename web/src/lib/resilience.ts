import { AppError } from "@/lib/errors";

export async function retryTransient<T>(
  operation: () => Promise<T>,
  options: { retries: number; jitterMs?: () => number },
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      const retryable = error instanceof AppError && error.retryable;
      if (!retryable || attempt >= options.retries) throw error;
      attempt += 1;
      const delay = Math.max(0, options.jitterMs?.() ?? Math.random() * 100);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}

export interface CircuitBreaker {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}

export function createCircuitBreaker(options: {
  failureThreshold: number;
  cooldownMs: number;
  now?: () => number;
}): CircuitBreaker {
  let failures = 0;
  let openedAt: number | null = null;
  const now = options.now ?? Date.now;
  return {
    async execute<T>(operation: () => Promise<T>): Promise<T> {
      const timestamp = now();
      if (openedAt !== null && timestamp - openedAt < options.cooldownMs) {
        throw new AppError({
          code: "CIRCUIT_OPEN",
          message: "外部服务暂时不可用，请稍后重试",
          status: 503,
          retryable: true,
        });
      }
      try {
        const result = await operation();
        failures = 0;
        openedAt = null;
        return result;
      } catch (error) {
        if (error instanceof AppError && !error.retryable) throw error;
        failures += 1;
        if (failures >= options.failureThreshold) openedAt = timestamp;
        throw error;
      }
    },
  };
}
