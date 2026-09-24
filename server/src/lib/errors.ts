/** خطأ عمل متوقَّع يُعاد للمستخدم برسالته وحالته (409 افتراضياً) */
export class HttpError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 | 413 | 415 | 422 | 429 = 409,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** للتوافق مع الكود القديم */
export class HttpConflict extends HttpError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'HttpConflict';
  }
}

/** هل الخطأ انتهاك قيد UNIQUE في SQLite؟ */
export function isUniqueViolation(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /UNIQUE constraint failed/i.test(msg);
}
