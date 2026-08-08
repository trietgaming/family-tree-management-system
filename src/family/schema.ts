import { z } from "zod";

const personId = z.string().trim().min(1, "An id cannot be empty");

export const NEEDS_NAME = "A person needs a name";

/**
 * Refused rather than trimmed. `.trim()` rewrites what it is given, and a name
 * being typed into the form comes back through here on its way to the box — so
 * trimming it would eat the space between two words as it was pressed.
 */
const personName = z.string().refine((name) => name.trim() !== "", NEEDS_NAME);

export const personSchema = z.object({
  id: personId,
  name: personName,
  gender: z.enum(["male", "female", "other"]).optional(),
  birthYear: z.number().int().min(1).max(9999).optional(),
  fatherId: personId.nullable().optional(),
  motherId: personId.nullable().optional(),
  spouseIds: z.array(personId).optional(),
  /**
   * Redundant with the parents, and accepted only because the brief names the
   * field. Parents win; a contradiction is reported rather than resolved.
   */
  siblingIds: z.array(personId).optional(),
});

export const familySchema = z.object({
  people: z.array(personSchema).min(1, "A family needs at least one person"),
});

export type Person = z.infer<typeof personSchema>;
export type Family = z.infer<typeof familySchema>;
