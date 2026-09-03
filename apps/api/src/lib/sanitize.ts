/**
 * Security Utility: Input Sanitization against XSS & Injection Attacks.
 */

const DANGEROUS_TAGS_REGEX = /<\/?(script|iframe|object|embed|style|meta|link|svg|math|form|input|button|textarea|base|applet)[\s\S]*?>/gi;
const DANGEROUS_PROTOCOLS_REGEX = /(javascript|vbscript|data):/gi;
const HTML_ENTITIES_REGEX = /[<>]/g;

const ENTITY_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;'
};

/**
 * Sanitizes user input string by stripping executable script tags,
 * dangerous protocols, and escaping HTML angle brackets.
 */
export function sanitizeString(value: string): string {
  if (!value || typeof value !== 'string') {
    return value;
  }

  // 1. Strip dangerous tags
  let cleaned = value.replace(DANGEROUS_TAGS_REGEX, '');

  // 2. Neutralize javascript: or data: pseudo-protocols
  cleaned = cleaned.replace(DANGEROUS_PROTOCOLS_REGEX, '$1_neutralized:');

  // 3. Escape remaining angle brackets to prevent raw HTML execution
  cleaned = cleaned.replace(HTML_ENTITIES_REGEX, (match) => ENTITY_MAP[match] || match);

  return cleaned.trim();
}

/**
 * Recursively sanitizes all string fields in an object or array.
 */
export function sanitizePayload<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') {
    if (typeof payload === 'string') {
      return sanitizeString(payload) as unknown as T;
    }
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
    result[key] = sanitizePayload(val);
  }

  return result as T;
}
