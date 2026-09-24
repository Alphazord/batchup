function formatLog(level: string, message: string, data?: Record<string, unknown>): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  });
}

export function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(formatLog("info", message, data));
}

export function logWarn(message: string, data?: Record<string, unknown>) {
  console.warn(formatLog("warn", message, data));
}

export function logError(message: string, error?: unknown, data?: Record<string, unknown>) {
  const errorData: Record<string, unknown> = { ...data };
  if (error instanceof Error) {
    errorData.error = error.message;
    if (error.cause instanceof Error) {
      errorData.cause = error.cause.message;
    }
  } else if (error) {
    errorData.error = String(error);
  }
  console.error(formatLog("error", message, errorData));
}
