const DOCUMENT = "ftms.document";
const PANEL = "ftms.panel-shown";

/**
 * What survives a reload: the document, so a family typed in by hand is not
 * lost to a stray refresh, and whether the JSON was left showing.
 *
 * Every call is guarded in one place: localStorage throws rather than returns
 * when a browser has storage switched off, and setItem throws again when the
 * quota is full. Neither is worth taking the page down for — the document is
 * still on screen, it just will not be there next time.
 */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* nothing to do about it, and nothing the reader needs to know */
  }
}

export function loadDocument(fallback: string): string {
  return read(DOCUMENT) ?? fallback;
}

export function saveDocument(text: string): void {
  write(DOCUMENT, text);
}

export function loadPanelShown(fallback: boolean): boolean {
  const stored = read(PANEL);

  return stored === null ? fallback : stored === "true";
}

export function savePanelShown(isShown: boolean): void {
  write(PANEL, String(isShown));
}
