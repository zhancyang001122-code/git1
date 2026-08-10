export interface PublicError {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
}

interface AppErrorOptions {
  code: string;
  message: string;
  status?: number;
  retryable?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor({
    code,
    message,
    status = 500,
    retryable = false,
    cause,
  }: AppErrorOptions) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.cause = cause;
  }
}

export function toPublicError(
  error: unknown,
  requestId = crypto.randomUUID(),
): PublicError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      requestId,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "服务暂时不可用，请稍后重试",
    retryable: false,
    requestId,
  };
}
