/**
 * Whether a request says its body is bigger than a route will ever take
 * (security audit, 8 November 2026). Routes that read a form read all of it into
 * memory first, so the size the browser announces is checked before that; a
 * body that does not announce one is still capped by the server's proxy (50 MB).
 */
export function bodyTooBig(request: Pick<Request, 'headers'>, max: number): boolean {
  const n = Number(request.headers?.get('content-length') ?? '')
  return Number.isFinite(n) && n > max
}

/** A form's own overhead on top of its files: field names, boundaries, the text fields. */
export const FORM_SLACK = 2 * 1024 * 1024
