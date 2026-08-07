import { familySchema, type Family } from "./schema";
import { findProblems, problem, type Problem } from "./validate";

export type ParseResult =
  | { ok: true; family: Family }
  | { ok: false; problems: Problem[] };

/**
 * Three failures in a row, reported through one shape: text that is not JSON,
 * JSON that is not a family, and a family that does not hold together.
 */
export function parseFamily(text: string): ParseResult {
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch (cause) {
    return {
      ok: false,
      problems: [problem([], cause instanceof Error ? cause.message : "Could not read the JSON")],
    };
  }

  const result = familySchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      problems: result.error.issues.map((issue) => problem(issue.path, issue.message)),
    };
  }

  const problems = findProblems(result.data);

  return problems.length === 0 ? { ok: true, family: result.data } : { ok: false, problems };
}
