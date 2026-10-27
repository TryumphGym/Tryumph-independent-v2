-- Optional follow-up READ ONLY inspection. The original report includes public
-- trigger functions, but does not include bindings on auth.users/event triggers.
BEGIN READ ONLY;
SELECT 'auth_user_trigger' AS section,t.tgname AS object_name,
 jsonb_build_object('enabled',t.tgenabled,'definition',pg_catalog.pg_get_triggerdef(t.oid,true),
 'function',p.oid::regprocedure::text,'function_definition',pg_catalog.pg_get_functiondef(p.oid)) AS details
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid=to_regclass('auth.users') AND NOT t.tgisinternal
UNION ALL
SELECT 'event_trigger',e.evtname,jsonb_build_object('event',e.evtevent,'enabled',e.evtenabled,
 'tags',e.evttags,'function',p.oid::regprocedure::text,'function_definition',pg_catalog.pg_get_functiondef(p.oid))
FROM pg_catalog.pg_event_trigger e JOIN pg_catalog.pg_proc p ON p.oid=e.evtfoid
UNION ALL
SELECT 'publication',p.pubname,jsonb_build_object('all_tables',p.puballtables,'insert',p.pubinsert,'update',p.pubupdate,'delete',p.pubdelete)
FROM pg_catalog.pg_publication p
ORDER BY section,object_name;
COMMIT;
-- No application routines are executed. Review definitions for hardcoded secrets
-- before sharing, as with the original export. Do not change platform triggers.
