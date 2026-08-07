const KEY = "ftms.document";

/**
 * The document survives a reload, so a family typed in by hand is not lost to
 * a stray refresh.
 *
 * Every call is guarded: localStorage throws rather than returns when a
 * browser has storage switched off, and setItem throws again when the quota is
 * full. Neither is worth taking the page down for — the document is still on
 * screen, it just will not be there next time.
 */
export function loadDocument(fallback: string): string {
  try {
    return localStorage.getItem(KEY) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveDocument(text: string): void {
  try {
    localStorage.setItem(KEY, text);
  } catch {
    /* nothing to do about it, and nothing the reader needs to know */
  }
}
