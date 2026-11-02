import { isCurrentVerified, type CredentialRecord } from "./cpr";
const protectedTitles: [RegExp, RegExp][] = [
  [/physical therapist|physiotherapist/i, /physical therap|physiotherap/i],
  [/medical doctor|physician/i, /medical licen|physician/i],
  [/registered dietitian/i, /registered dietitian/i],
  [/licensed clinical/i, /clinical licen|clinical psych/i],
];
/** Mirrors new SQL write guards, also suppressing unreviewed historical public copy without rewriting it. */
export function mayPublishFitnessCopy(
  copy: string,
  trainerId: string,
  credentials: readonly CredentialRecord[],
) {
  if (
    /(^|[^a-z])(I|we) (diagnose|treat|cure)\s|(^|[^a-z])(this|workout|program|exercise|course) (diagnoses|treats|cures)\s/i.test(
      copy,
    )
  )
    return false;
  const claims = copy.replace(
    /(not (a |an )?|(consult|ask|contact|see|speak with|talk to) (your |a |an )?)(physical therapist|physiotherapist|medical doctor|physician|registered dietitian|licensed clinical)/gi,
    "",
  );
  return protectedTitles.every(
    ([title, evidence]) =>
      !title.test(claims) ||
      credentials.some(
        (c) =>
          isCurrentVerified(c) &&
          c.verified_by !== trainerId &&
          !!c.document_path &&
          evidence.test(c.name),
      ),
  );
}
