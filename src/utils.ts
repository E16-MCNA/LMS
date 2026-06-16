/**
 * Escape user string contents to prevent CSS/XSS injections.
 */
export function escapeHTML(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Clean UUID/Unique identifier generator
 */
export function generateId(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024 * 1024;
export const MAX_UPLOAD_FILE_LABEL = "10 GB";
