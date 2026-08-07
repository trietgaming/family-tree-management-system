const BYTES = 5;

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES));

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * An opaque id for a person the user just created.
 *
 * Ids only have to be unique inside one document, so forty bits is already far
 * more than the situation needs; the collision check is what makes the length
 * a matter of tidiness rather than of correctness. Hex rather than base 36
 * because mapping bytes onto a 36-letter alphabet skews the distribution, and
 * an unbiased generator is less to explain than a biased one that happens not
 * to matter.
 */
export function newPersonId(taken: ReadonlySet<string>): string {
  let id = randomId();
  while (taken.has(id)) id = randomId();

  return id;
}
