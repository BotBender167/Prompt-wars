/**
 * Campus constants for the currently seeded institution.
 *
 * The institution name was previously repeated inline in three route handlers
 * and the department list verbatim in two pages. Both live here now.
 *
 * Neither belongs in source long-term: `institutions` is already a table, and
 * departments should become one keyed by institution_id. Until a second
 * institution exists, a single constant is the honest representation.
 */
export const INSTITUTION_NAME = "Thapar Institute of Engineering and Technology";

export const DEPARTMENTS = [
  "Chemical Engineering",
  "Civil Engineering",
  "Computer Science & Engineering",
  "Department of Biotechnology",
  "Electrical & Instrumentation Engineering",
  "Electronics & Communication Engineering",
  "Mechanical Engineering",
  "Basic & Engineering Sciences (Dera Bassi Campus)",
  "Department of Chemistry & Biochemistry",
  "Department of Energy and Environment",
  "Department of Mathematics",
  "Department of Physics & Materials Science",
  "L. M. Thapar School of Management",
  "School of Humanities & Social Sciences",
  "Thapar School of Liberal Arts & Sciences (TSLAS)",
];
