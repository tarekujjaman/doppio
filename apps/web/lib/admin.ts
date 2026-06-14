// Admin accounts get unlimited usage and access to /admin. Configurable via
// ADMIN_EMAILS (comma-separated); defaults to the project owner.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "riad.celloscope@gmail.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
}
