import { z } from "zod";

const personId = z.string().trim().min(1, "An id cannot be empty");

export const personSchema = z.object({
  id: personId,
  name: z.string().trim().min(1, "A person needs a name"),
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
