/** Shared trainer credential rules. Server must enforce eligibility independently. */
export type CredentialRecord = {
  id?: string;
  name: string;
  status: string;
  expires?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  issuing_organization?: string | null;
  credential_id?: string | null;
  document_path?: string | null;
};
export const isCpr = (name: string) =>
  /\b(CPR|cardiopulmonary resuscitation)\b/i.test(name);
export const isAed = (name: string) =>
  /\b(AED|automated external defibrillator)\b/i.test(name);
export const validCredentialDate = (value?: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
export const isExpired = (expires?: string | null) =>
  Boolean(
    expires &&
    /^\d{4}-\d{2}-\d{2}$/.test(expires) &&
    expires < new Date().toISOString().slice(0, 10),
  );
export const isExpiringSoon = (expires?: string | null) => {
  if (!expires || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return false;
  const days =
    (Date.parse(expires + "T00:00:00Z") -
      Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) /
    86400000;
  return days >= 0 && days <= 30;
};
export const isCurrentVerified = (c: CredentialRecord) =>
  c.status === "verified" &&
  Boolean(c.verified_at && c.verified_by) &&
  validCredentialDate(c.expires) &&
  !isExpired(c.expires);
/** Current CPR AND AED proof is required. One combined certificate or two verified credentials qualify. */
export const hasVerifiedCpr = (records: CredentialRecord[]) => {
  const valid = records.filter(isCurrentVerified);
  return valid.some((c) => isCpr(c.name)) && valid.some((c) => isAed(c.name));
};
export const credentialLabel = (c: CredentialRecord) =>
  isExpired(c.expires)
    ? "Expired"
    : c.status === "verified" && isExpiringSoon(c.expires)
      ? "Expiring soon"
      : c.status === "verified" && !isCurrentVerified(c)
        ? "Verification incomplete"
        : c.status === "verified"
          ? "Verified"
          : c.status === "pending"
            ? "Pending review"
            : c.status === "rejected"
              ? "Rejected"
              : c.status;
