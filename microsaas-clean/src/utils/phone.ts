// src/utils/phone.ts
// Small helper to normalize phone strings.
// Keeps only digits and ensures it starts with "+".
// Examples:
//   "+55 (31) 97444-073" -> "+553197444073"
//   "(31) 97444-073"     -> "+553197444073" (assumes Brazil if no country code)

export function normalizePhone(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;

  // Remove any non-digit character.
  const digits = raw.replace(/\D/g, "");

  if (!digits) return undefined;

  // If already has country code 55, keep. Otherwise prepend 55 (Brazil default).
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;

  return `+${withCountry}`;
}
