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

/**
 * What the document says, not what it means.
 *
 * These are records: flat, full of ids, and exactly as trustworthy as the text
 * they came from. `Person` and the rest of the domain are built from them by
 * the repository, and nothing past that boundary should be reading a record.
 */
export type PersonRecord = z.infer<typeof personSchema>;
export type FamilyDocument = z.infer<typeof familySchema>;

export type Gender = NonNullable<PersonRecord["gender"]>;
