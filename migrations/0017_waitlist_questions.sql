ALTER TABLE public.waitlist_entries
  ADD COLUMN heard_from text,
  ADD COLUMN live_class_interest text,
  ADD COLUMN notify_new_coaches boolean NOT NULL DEFAULT false;
ALTER TABLE public.waitlist_entries
  ADD CONSTRAINT waitlist_heard_from_valid CHECK (heard_from IS NULL OR heard_from IN ('friend', 'facebook_group', 'instagram', 'google_search', 'coach', 'other')),
  ADD CONSTRAINT waitlist_live_class_interest_valid CHECK (live_class_interest IS NULL OR live_class_interest IN ('yes', 'maybe', 'no'));