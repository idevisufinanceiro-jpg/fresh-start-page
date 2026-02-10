// Small helper to safely work with DATE columns stored as "YYYY-MM-DD".
// JS Date("YYYY-MM-DD") is parsed as UTC and can shift a day in negative timezones.

export function parseDateOnly(value: string): Date {
  const parts = value.split("-").map((p) => Number(p));
  const [year, month, day] = parts;

  if (!year || !month || !day) return new Date(value);

  // Local timezone midnight (no UTC shifting)
  return new Date(year, month - 1, day);
}
