> **October 27 actual-schema finding: do not run the historical SQL example below.** The hosted export confirms its incorrectly correlated reply subquery and profile-RLS dependency. The [reconciled staging path](../launch/reconciliation/findings.md) alters the existing policy to the checked helper and removes the redundant new permissive policy. See [the founder handoff](../launch/FOUNDER_HANDOFF.md) for acceptance and verification boundaries. The old example is retained only as audit context.

# Trainer inquiries — security migration required

**Code is staged, not deployed.** UI: trainer profile `Message Trainer`, member account inbox, trainer studio Messages tab. Existing `messages` sender/recipient read policies remain unchanged. Do not use this feature before the additional insert RLS policy below is reviewed and applied in Supabase.

## Additive SQL for existing Supabase database (run in SQL Editor after checking table/roles)

```sql
-- Existing friend messaging policy stays as-is.
-- Allow member -> approved trainer initial contact, and trainer -> member replies
-- to an existing incoming conversation. Self-sending is forbidden.
CREATE POLICY "Trainer inquiries may be sent without friendship"
ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND recipient_id <> sender_id
  AND (
    (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = recipient_id AND p.role = 'trainer'
      )
      AND public.trainer_is_eligible(recipient_id, false)
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = sender_id AND p.role = 'trainer'
      )
      AND EXISTS (
        SELECT 1 FROM public.messages previous
        WHERE previous.sender_id = recipient_id
          AND previous.recipient_id = sender_id
      )
    )
  )
);
```

Important: Verify `trainer_is_eligible` function execute privileges and signature and its exact meaning on the hosted database; use of `profiles.role` in this draft assumes protected trainer role assignment. Test denied sends for arbitrary non-friends, spoofed senders, ineligible trainers, trainer-to-stranger, and allowed mutual trainer inquiry replies.

The app needs an independent anti-spam/throttling and block mechanism before broad public rollout. Reading conversation histories should remain restricted to sender and recipient by existing RLS. The inbox reuses the `messages` table; it does not provide admin chat access. Notifications, moderation, and unread states can be added later.
