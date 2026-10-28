-- Support email delivery metadata only: no message body, email address, JWT or raw IP is stored.
CREATE TABLE IF NOT EXISTS contact_delivery_requests (
 request_id uuid PRIMARY KEY,requester_hash text NOT NULL CHECK(length(requester_hash)=64),
 payload_hash text NOT NULL CHECK(length(payload_hash)=64),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','failed','sent')),
 attempts integer NOT NULL DEFAULT 0,lease_until timestamptz NOT NULL DEFAULT now(),provider_id text,last_error text,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS contact_delivery_requester_time ON contact_delivery_requests(requester_hash,created_at);
ALTER TABLE contact_delivery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON contact_delivery_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON contact_delivery_requests TO service_role;
CREATE OR REPLACE FUNCTION claim_contact_delivery(p_request uuid,p_requester_hash text,p_payload_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r contact_delivery_requests%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('contact-delivery-limit'));
 SELECT * INTO r FROM contact_delivery_requests WHERE request_id=p_request FOR UPDATE;
 IF FOUND THEN
  IF r.payload_hash<>p_payload_hash THEN RAISE EXCEPTION 'Request changed. Start a new message.'; END IF;
  IF r.status='sent' THEN RETURN 'sent'; END IF;
  IF r.created_at<now()-interval '23 hours' THEN RAISE EXCEPTION 'Unconfirmed request needs support reconciliation; email directly'; END IF;
  IF r.lease_until>now() THEN RETURN 'processing'; END IF;
 END IF;
 IF (SELECT coalesce(sum(attempts),0) FROM contact_delivery_requests WHERE requester_hash=p_requester_hash AND created_at>now()-interval '1 hour')>=5
 OR (SELECT coalesce(sum(attempts),0) FROM contact_delivery_requests WHERE created_at>now()-interval '1 hour')>=100
 THEN RAISE EXCEPTION 'Contact message limit reached. Please try later or email directly.'; END IF;
 INSERT INTO contact_delivery_requests(request_id,requester_hash,payload_hash,attempts,lease_until)
 VALUES(p_request,p_requester_hash,p_payload_hash,1,now()+interval '2 minutes')
 ON CONFLICT(request_id) DO UPDATE SET attempts=contact_delivery_requests.attempts+1,lease_until=now()+interval '2 minutes',status='pending';
 RETURN 'claimed';
END $$;
REVOKE ALL ON FUNCTION claim_contact_delivery(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION claim_contact_delivery(uuid,text,text) TO service_role;
INSERT INTO launch_schema_versions(version) VALUES('0055_contact_delivery') ON CONFLICT DO NOTHING;
