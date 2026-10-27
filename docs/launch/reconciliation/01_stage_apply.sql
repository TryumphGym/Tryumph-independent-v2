-- GENERATED: node scripts/build-reconciled-staging.ts
-- STAGING ONLY: an independent clone of the inspected 978-row hosted schema.
-- Do not run upgrade.sql/completion.sql in addition to this file.
-- Review findings.md and pass 00_readonly_preflight.sql first. Stop app/cron workers
-- in staging. No production SQL, deployment, DNS, payment or merge is authorized.
-- Source export SHA256: ff398e74cff50c1315a3200a4b27e1a7ab0af13089feecabe434a61e1f7638f3
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL search_path=public,extensions;
DO $already$ BEGIN
 IF to_regclass('public.launch_schema_versions') IS NOT NULL THEN
  RAISE EXCEPTION 'Schema has advanced since the inspected snapshot. Reinspect; do not replay or select a bundle using history alone.';
 END IF;
END $already$;
-- Validate all inspected application tables, columns, constraints, indexes,
-- policies, triggers, routine definitions and grants before making any changes.
DO $snapshot$ DECLARE changed text; BEGIN
 WITH inspected AS (-- READ ONLY: one SELECT; no DDL/DML, application-function calls, or business rows.
-- Run in Supabase SQL Editor as the project owner. Export ALL result rows as JSON/CSV.
-- Function/default definitions can contain hardcoded credentials: redact any before sharing.
-- History reads use built-in query_to_xml ONLY for explicitly allowlisted local registries
-- and metadata columns. SQL statements, logs, tokens and account/message/payment rows are excluded.
WITH
expected(name) AS (
 SELECT pg_catalog.unnest(ARRAY[
 'profiles','user_roles','messages','friendships','friend_requests','certifications','credential_reviews',
 'trainer_videos','video_uploads','live_sessions','live_room_access','live_checkout_intents',
 'trainer_earnings','trainer_accounts','trainer_busy','trainer_store_items','trainer_programs','trainer_program_workouts',
 'posts','post_comments','post_likes','trybe_memberships','checkout_payment_state',
 'wallet_token_lots','wallet_token_units','wallet_redemptions','refund_jobs','payment_disputes',
 'private_session_access','private_booking_holds','private_payment_methods','private_booking_payments',
 'private_balance_operations','private_reschedule_requests','private_room_shutdown_jobs',
 'live_recordings','recording_start_locks','room_shutdown_jobs','water_break_campaigns',
 'water_break_impressions','water_break_events','ad_settlement_events','content_reports',
 'audience_announcements','trainer_credential_requirements','account_restrictions','moderation_actions',
 'moderation_appeals','message_controls','notification_preferences','account_notifications',
 'account_activity_days','contact_delivery_requests','legacy_friendship_grants','launch_schema_versions',
 'push_reminders','push_subscriptions','cron_tokens','waitlist_entries','reviews','meal_plans','menu_shares','youth_consents'
 ]::text[])
),
relations AS (
 SELECT c.*, n.nspname AS schema_name
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','v','m','f') AND (
  n.nspname='public' OR (n.nspname='storage' AND c.relname IN ('objects','buckets'))
  OR (n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
      AND c.relname ~* '(migration|schema_version)'))
),
registry_specs(schema_name,table_name) AS (
 VALUES ('supabase_migrations','schema_migrations'),('drizzle','__drizzle_migrations'),
 ('public','__drizzle_migrations'),('public','schema_migrations'),
 ('public','_prisma_migrations'),('public','launch_schema_versions')
),
registries AS (
 SELECT s.*,r.oid,r.relkind,
  (NOT r.relrowsecurity OR (SELECT rolsuper OR rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user)
   OR (NOT r.relforcerowsecurity AND pg_catalog.pg_has_role(r.relowner,'USAGE'))) AS bypasses_rls,
  (SELECT pg_catalog.string_agg(pg_catalog.format('%I',a.attname),', ' ORDER BY a.attnum)
   FROM pg_catalog.pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped
   AND a.attname IN ('version','name','id','hash','checksum','created_at','applied_at',
                    'migration_name','started_at','finished_at')) AS projection,
  (SELECT pg_catalog.format('%I DESC NULLS LAST',a.attname)
   FROM pg_catalog.pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped
   AND a.attname IN ('version','id','created_at','applied_at','finished_at','started_at','migration_name','name')
   ORDER BY pg_catalog.array_position(ARRAY['version','id','created_at','applied_at','finished_at','started_at','migration_name','name']::text[],a.attname::text)
   LIMIT 1) AS sort_order
 FROM registry_specs s LEFT JOIN relations r ON r.schema_name=s.schema_name AND r.relname=s.table_name
),
routines AS (
 SELECT p.*,n.nspname AS schema_name
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind IN ('f','p','w') AND (n.nspname='public'
  OR p.oid IN (SELECT t.tgfoid FROM pg_catalog.pg_trigger t JOIN relations r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal)
  OR p.oid IN (SELECT d.refobjid FROM pg_catalog.pg_depend d
     JOIN pg_catalog.pg_policy pol ON d.classid='pg_catalog.pg_policy'::regclass AND pol.oid=d.objid
     JOIN relations r ON r.oid=pol.polrelid WHERE d.refclassid='pg_catalog.pg_proc'::regclass))
),
report(section,object_name,details) AS (
 SELECT '00_context','database',pg_catalog.jsonb_build_object(
  'captured_at',pg_catalog.statement_timestamp(),'database',pg_catalog.current_database(),
  'current_role',current_user,'session_role',session_user,'postgres_version',pg_catalog.current_setting('server_version'),
  'timezone',pg_catalog.current_setting('TimeZone'),'search_path',pg_catalog.current_setting('search_path'),'row_security',pg_catalog.current_setting('row_security'),
  'scope','Metadata, allowlisted migration records and bucket settings only. No baseline selected.')
 UNION ALL
 SELECT '01_expected_relation','public.'||e.name,pg_catalog.jsonb_build_object('present',r.oid IS NOT NULL,'kind',r.relkind)
 FROM expected e LEFT JOIN relations r ON r.schema_name='public' AND r.relname=e.name
 UNION ALL
 SELECT '02_relation',pg_catalog.format('%I.%I',r.schema_name,r.relname),pg_catalog.jsonb_build_object(
  'kind',r.relkind,'owner',pg_catalog.pg_get_userbyid(r.relowner),'rls_enabled',r.relrowsecurity,
  'rls_forced',r.relforcerowsecurity,'replica_identity',r.relreplident,
  'partition_key',CASE WHEN r.relkind='p' THEN pg_catalog.pg_get_partkeydef(r.oid) END,
  'view_definition',CASE WHEN r.relkind IN ('v','m') THEN pg_catalog.pg_get_viewdef(r.oid,true) END,
  'relation_options',r.reloptions,
  'parents',(SELECT pg_catalog.jsonb_agg(i.inhparent::regclass::text ORDER BY i.inhseqno) FROM pg_catalog.pg_inherits i WHERE i.inhrelid=r.oid),
  'grants',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(x.grantee) END,
    'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantee,x.privilege_type)
    FROM pg_catalog.aclexplode(coalesce(r.relacl,pg_catalog.acldefault('r',r.relowner))) x))
 FROM relations r
 UNION ALL
 SELECT '03_column',pg_catalog.format('%I.%I.%I',r.schema_name,r.relname,a.attname),pg_catalog.jsonb_build_object(
  'position',a.attnum,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
  'default_or_generated_expression',pg_catalog.pg_get_expr(ad.adbin,ad.adrelid),
  'identity',a.attidentity,'generated',a.attgenerated,
  'collation',CASE WHEN a.attcollation<>0 THEN a.attcollation::regcollation::text END,
  'explicit_column_acl',a.attacl)
 FROM relations r JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid=r.oid AND ad.adnum=a.attnum
 UNION ALL
 SELECT '04_constraint',pg_catalog.format('%I.%I.%I',r.schema_name,r.relname,c.conname),pg_catalog.jsonb_build_object(
  'kind',c.contype,'definition',pg_catalog.pg_get_constraintdef(c.oid,true),'validated',c.convalidated,
  'deferrable',c.condeferrable,'initially_deferred',c.condeferred,
  'referenced_relation',CASE WHEN c.confrelid<>0 THEN c.confrelid::regclass::text END)
 FROM pg_catalog.pg_constraint c JOIN relations r ON r.oid=c.conrelid
 UNION ALL
 SELECT '05_index',pg_catalog.format('%I.%I',r.schema_name,ic.relname),pg_catalog.jsonb_build_object(
  'table',pg_catalog.format('%I.%I',r.schema_name,r.relname),'definition',pg_catalog.pg_get_indexdef(i.indexrelid),
  'unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready)
 FROM pg_catalog.pg_index i JOIN relations r ON r.oid=i.indrelid JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid
 UNION ALL
 SELECT '06_policy',pg_catalog.format('%I.%I.%I',r.schema_name,r.relname,p.polname),pg_catalog.jsonb_build_object(
  'permissive',p.polpermissive,'command',p.polcmd,
  'roles',(SELECT pg_catalog.jsonb_agg(CASE WHEN role_id=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(role_id) END ORDER BY role_id) FROM pg_catalog.unnest(p.polroles) role_id),
  'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),'with_check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))
 FROM pg_catalog.pg_policy p JOIN relations r ON r.oid=p.polrelid
 UNION ALL
 SELECT '07_trigger',pg_catalog.format('%I.%I.%I',r.schema_name,r.relname,t.tgname),pg_catalog.jsonb_build_object(
  'enabled',t.tgenabled,'definition',pg_catalog.pg_get_triggerdef(t.oid,true),
  'function',t.tgfoid::regprocedure::text,'constraint_trigger',t.tgconstraint<>0,
  'deferrable',t.tgdeferrable,'initially_deferred',t.tginitdeferred)
 FROM pg_catalog.pg_trigger t JOIN relations r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL
 SELECT '08_routine',pg_catalog.format('%I.%I(%s)',p.schema_name,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid)),pg_catalog.jsonb_build_object(
  'kind',p.prokind,'owner',pg_catalog.pg_get_userbyid(p.proowner),'arguments',pg_catalog.pg_get_function_arguments(p.oid),
  'result',pg_catalog.pg_get_function_result(p.oid),'language',l.lanname,
  'security_definer',p.prosecdef,'configuration',p.proconfig,'volatility',p.provolatile,
  'strict',p.proisstrict,'definition',pg_catalog.pg_get_functiondef(p.oid),
  'grants',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(x.grantee) END,
    'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantee,x.privilege_type)
    FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x))
 FROM routines p JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 UNION ALL
 SELECT '09_schema',n.nspname,pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(n.nspowner),'acl',n.nspacl)
 FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','storage','supabase_migrations','drizzle')
 UNION ALL
 SELECT '10_default_privileges',coalesce(n.nspname,'ALL_SCHEMAS')||':'||pg_catalog.pg_get_userbyid(d.defaclrole)||':'||d.defaclobjtype::text,
 pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(d.defaclrole),'object_kind',d.defaclobjtype,'acl',d.defaclacl)
 FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclnamespace=0 OR n.nspname IN ('public','storage')
 UNION ALL
 SELECT '11_custom_type',pg_catalog.format('%I.%I',n.nspname,t.typname),pg_catalog.jsonb_build_object(
  'kind',t.typtype,'base_type',CASE WHEN t.typtype='d' THEN pg_catalog.format_type(t.typbasetype,t.typtypmod) END,
  'not_null',t.typnotnull,'default',t.typdefault,
  'enum_labels',(SELECT pg_catalog.jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_catalog.pg_enum e WHERE e.enumtypid=t.oid),
  'domain_constraints',(SELECT pg_catalog.jsonb_agg(pg_catalog.pg_get_constraintdef(c.oid,true)) FROM pg_catalog.pg_constraint c WHERE c.contypid=t.oid))
 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype IN ('e','d')
 UNION ALL
 SELECT '12_extension',e.extname,pg_catalog.jsonb_build_object('version',e.extversion,'schema',n.nspname)
 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
 UNION ALL
 SELECT '13_realtime',p.pubname||':'||p.schemaname||'.'||p.tablename,pg_catalog.to_jsonb(p)
 FROM pg_catalog.pg_publication_tables p JOIN relations r ON r.schema_name=p.schemaname AND r.relname=p.tablename
 UNION ALL
 SELECT '14_migration_history',pg_catalog.format('%I.%I',r.schema_name,r.table_name),pg_catalog.jsonb_build_object(
  'present',r.oid IS NOT NULL,'kind',r.relkind,'selected_columns',r.projection,'limit',2000,
  'status',CASE WHEN r.oid IS NULL THEN 'absent; manual SQL may still have been applied'
   WHEN r.relkind NOT IN ('r','p') THEN 'not a local table; no rows read'
   WHEN NOT pg_catalog.has_table_privilege(r.oid,'SELECT') THEN 'not readable by current role'
   WHEN NOT r.bypasses_rls THEN 'RLS would apply; history rows skipped to avoid executing policy functions'
   WHEN r.projection IS NULL THEN 'no allowlisted metadata columns; inspect column inventory'
   ELSE 'read metadata only; if 2000 entries are returned, obtain remaining history before deciding' END,
  'records_xml',CASE WHEN r.oid IS NOT NULL AND r.relkind IN ('r','p') AND r.projection IS NOT NULL
     AND r.bypasses_rls AND pg_catalog.has_table_privilege(r.oid,'SELECT') THEN pg_catalog.query_to_xml(
       pg_catalog.format('SELECT %s FROM %I.%I%s LIMIT 2000',r.projection,r.schema_name,r.table_name,
        CASE WHEN r.sort_order IS NULL THEN '' ELSE ' ORDER BY '||r.sort_order END),true,false,'')::text END)
 FROM registries r
 UNION ALL
 SELECT '15_bucket_configuration','storage.buckets',pg_catalog.jsonb_build_object(
  'present',b.oid IS NOT NULL,'status',CASE WHEN b.oid IS NULL THEN 'absent'
   WHEN b.projection IS NULL THEN 'no known bucket setting columns'
   WHEN NOT pg_catalog.has_table_privilege(b.oid,'SELECT') THEN 'not readable by current role'
   WHEN NOT b.bypasses_rls THEN 'RLS would apply; settings rows skipped'
   ELSE 'metadata only; maximum 1000 buckets' END,
  'settings_xml',CASE WHEN b.oid IS NOT NULL AND b.projection IS NOT NULL AND b.bypasses_rls
    AND pg_catalog.has_table_privilege(b.oid,'SELECT') THEN pg_catalog.query_to_xml(
     pg_catalog.format('SELECT %s FROM storage.buckets LIMIT 1000',b.projection),true,false,'')::text END)
 FROM (SELECT r.oid,
  (NOT r.relrowsecurity OR (SELECT rolsuper OR rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user)
    OR (NOT r.relforcerowsecurity AND pg_catalog.pg_has_role(r.relowner,'USAGE'))) AS bypasses_rls,
  (SELECT pg_catalog.string_agg(pg_catalog.format('%I',a.attname),', ' ORDER BY a.attnum) FROM pg_catalog.pg_attribute a
   WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped
   AND a.attname IN ('id','name','public','file_size_limit','allowed_mime_types')) AS projection
  FROM (VALUES(1)) seed(x) LEFT JOIN relations r ON r.schema_name='storage' AND r.relname='buckets' AND r.relkind IN ('r','p')) b
 UNION ALL
 SELECT '16_role',r.rolname,pg_catalog.jsonb_build_object('superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,
  'inherits',r.rolinherit,'can_login',r.rolcanlogin)
 FROM pg_catalog.pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role',current_user,session_user)
  OR r.oid IN (SELECT relowner FROM relations UNION SELECT proowner FROM routines)
 UNION ALL
 SELECT '17_role_membership',pg_catalog.pg_get_userbyid(m.member)||' -> '||pg_catalog.pg_get_userbyid(m.roleid),pg_catalog.jsonb_build_object('admin_option',m.admin_option)
 FROM pg_catalog.pg_auth_members m WHERE pg_catalog.pg_get_userbyid(m.member) IN ('anon','authenticated','service_role',current_user,session_user)
  OR pg_catalog.pg_get_userbyid(m.roleid) IN ('anon','authenticated','service_role',current_user,session_user)

)
SELECT section,object_name,details FROM report
UNION ALL
SELECT '99_report_complete','summary',pg_catalog.jsonb_build_object(
 'report_rows',pg_catalog.count(*)+1,'sections',pg_catalog.jsonb_agg(DISTINCT section ORDER BY section),
 'baseline_selected',false)
FROM report
ORDER BY section,object_name), actual AS (
 SELECT section,object_name,md5((CASE WHEN section='08_routine' THEN jsonb_set(details,'{definition}',to_jsonb(replace(details->>'definition',E'\r\n',E'\n'))) ELSE details END)::text) AS hash
 FROM inspected WHERE section IN ('02_relation','03_column','04_constraint','05_index','06_policy','07_trigger','08_routine')
 AND (object_name LIKE 'public.%' OR (section='06_policy' AND object_name LIKE 'storage.objects.%'))
 AND NOT (section='04_constraint' AND details->>'kind'='n')
 ), expected(section,object_name,hash) AS (VALUES
 ('02_relation','public.ad_settlement_events','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.certifications','1f75010ae1c9a55824159b2792d55bbd'),
 ('02_relation','public.checkout_payment_state','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.comments','a112afea8444a136796981bc0c031609'),
 ('02_relation','public.credential_reviews','dc5edaab991f266c22b7568b4f0e352d'),
 ('02_relation','public.cron_tokens','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.friend_requests','42eebc37a4d3c571d80dff3c6ca2bcf2'),
 ('02_relation','public.friendships','5d149e08c0cc5879dda8c8d651406a87'),
 ('02_relation','public.live_checkout_intents','9c93b334bcf76ec9c59043f1a3098680'),
 ('02_relation','public.live_recordings','9ac43aa533d69be2a1b52c47e7a8ea93'),
 ('02_relation','public.live_room_access','9ac43aa533d69be2a1b52c47e7a8ea93'),
 ('02_relation','public.live_sessions','3848cf20499b98c18019caf2c0b2233d'),
 ('02_relation','public.meal_plans','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.menu_shares','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.messages','1f75010ae1c9a55824159b2792d55bbd'),
 ('02_relation','public.payment_disputes','9c93b334bcf76ec9c59043f1a3098680'),
 ('02_relation','public.post_comments','42a3c9099f6d30ea7e50ecd86b786ab8'),
 ('02_relation','public.post_likes','42a3c9099f6d30ea7e50ecd86b786ab8'),
 ('02_relation','public.posts','f0d227e3b4d96aa73515157e7dac5802'),
 ('02_relation','public.private_booking_holds','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.private_session_access','9ac43aa533d69be2a1b52c47e7a8ea93'),
 ('02_relation','public.profiles','4f257d34e3175920f6eb92598ac2cd6e'),
 ('02_relation','public.push_reminders','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.push_subscriptions','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.recording_start_locks','9c93b334bcf76ec9c59043f1a3098680'),
 ('02_relation','public.refund_jobs','9c93b334bcf76ec9c59043f1a3098680'),
 ('02_relation','public.reviews','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.room_shutdown_jobs','9c93b334bcf76ec9c59043f1a3098680'),
 ('02_relation','public.trainer_accounts','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.trainer_busy','1cd9d6fb6491a97aaa78706d3e66a8d7'),
 ('02_relation','public.trainer_earnings','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.trainer_program_workouts','36ef6e6ec204a2d88be9bd53cfd6620d'),
 ('02_relation','public.trainer_programs','36ef6e6ec204a2d88be9bd53cfd6620d'),
 ('02_relation','public.trainer_store_items','36ef6e6ec204a2d88be9bd53cfd6620d'),
 ('02_relation','public.trainer_videos','48c38d38c3e091d71b1b63b2f661fce2'),
 ('02_relation','public.trybe_memberships','42a3c9099f6d30ea7e50ecd86b786ab8'),
 ('02_relation','public.trybes','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.user_roles','9ac43aa533d69be2a1b52c47e7a8ea93'),
 ('02_relation','public.video_uploads','9c93b334bcf76ec9c59043f1a3098680'),
 ('02_relation','public.waitlist_entries','ec8a4e83e8558a193111ff0b9391542f'),
 ('02_relation','public.wallet_redemptions','dc5edaab991f266c22b7568b4f0e352d'),
 ('02_relation','public.wallet_token_lots','9ac43aa533d69be2a1b52c47e7a8ea93'),
 ('02_relation','public.wallet_token_units','21567ef8c72df9183985acc40d87752f'),
 ('02_relation','public.water_break_campaigns','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.water_break_events','9c93b334bcf76ec9c59043f1a3098680'),
 ('02_relation','public.water_break_impressions','f89f5607c97ab9347a0ff4bef0b620de'),
 ('02_relation','public.youth_consents','f89f5607c97ab9347a0ff4bef0b620de'),
 ('03_column','public.ad_settlement_events.break_second','1a4f6dcd5f1d24f83bc7038f70157239'),
 ('03_column','public.ad_settlement_events.created_at','4af97d74670c3075feac55b855c83330'),
 ('03_column','public.ad_settlement_events.fee_cents','b966c1688c66795977120c9b80c3a2a5'),
 ('03_column','public.ad_settlement_events.gross_cents','289b3461cca708df84e2fa8a1efaaf09'),
 ('03_column','public.ad_settlement_events.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.ad_settlement_events.network','9c506447412248af191b3b69be9bdee7'),
 ('03_column','public.ad_settlement_events.network_event_id','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.ad_settlement_events.trainer_id','e00ec69299b0fe765343be6520f2cdd0'),
 ('03_column','public.ad_settlement_events.video_id','08365342b63a8c3bba522a348975e5ec'),
 ('03_column','public.certifications.created_at','4af97d74670c3075feac55b855c83330'),
 ('03_column','public.certifications.credential_id','9997c29aba983ffdfa0283c75d08e936'),
 ('03_column','public.certifications.document_path','acde7cc525c27fefb555325497d8f55f'),
 ('03_column','public.certifications.expires','fb459c63753400645b719272b83d0089'),
 ('03_column','public.certifications.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.certifications.issuing_organization','3e0f9b4c5be91f8d1c93ac5cad690098'),
 ('03_column','public.certifications.name','50c1d9435ae690c1d56ca9635ae62dfb'),
 ('03_column','public.certifications.note','e46a92dc6ed510fc3e4d92b0672488e7'),
 ('03_column','public.certifications.status','ad1102137f82e71784f59e8186d0ebfb'),
 ('03_column','public.certifications.trainer_name','f519a15e05cc1327a69ba8945fa08498'),
 ('03_column','public.certifications.user_id','4100edd5b60db8032284f8230dd8a8dc'),
 ('03_column','public.certifications.verified_at','e9be4c983c1d602d9900f3c8b6ee83a8'),
 ('03_column','public.certifications.verified_by','1ea111cbe168a9af3ddd83119604ff4b'),
 ('03_column','public.checkout_payment_state.checkout_id','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.checkout_payment_state.created_at','eb815df7831c03ccec925a82d8499fa7'),
 ('03_column','public.checkout_payment_state.fee_cents','2142f751e7c16dc3b5e85d6d0764a0cd'),
 ('03_column','public.checkout_payment_state.gross_cents','e1cffe3ab824ade5e308127459c41a7e'),
 ('03_column','public.checkout_payment_state.kind','9c506447412248af191b3b69be9bdee7'),
 ('03_column','public.checkout_payment_state.quantity','b64f00d136e8774355c3c28b39a34940'),
 ('03_column','public.checkout_payment_state.refunded_cents','73d2bc57c728cc7120d29899d1e5910c'),
 ('03_column','public.checkout_payment_state.user_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.comments.author_id','e9a08f367f2e85d25fb0f917e03123a5'),
 ('03_column','public.comments.created_at','b30535d1c98a7a8067fa35714218f20b'),
 ('03_column','public.comments.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.comments.post_id','4100edd5b60db8032284f8230dd8a8dc'),
 ('03_column','public.comments.text','50d53389143ba6546fd05c2da63f59f5'),
 ('03_column','public.credential_reviews.created_at','3bbc46a3949644892b2fe648694ea67c'),
 ('03_column','public.credential_reviews.credential_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.credential_reviews.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.credential_reviews.note','8222832586eb2b94b531e75478b21b4c'),
 ('03_column','public.credential_reviews.reviewer_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.credential_reviews.status','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.cron_tokens.name','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.cron_tokens.token','ed471dc89d517539c29f758763f9a594'),
 ('03_column','public.friend_requests.created_at','b30535d1c98a7a8067fa35714218f20b'),
 ('03_column','public.friend_requests.recipient_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.friend_requests.recipient_name','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.friend_requests.requester_id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.friend_requests.requester_name','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.friendships.created_at','b30535d1c98a7a8067fa35714218f20b'),
 ('03_column','public.friendships.friend_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.friendships.friend_name','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.friendships.partner','c02cf18a30f6bf8546c6dac2d320e866'),
 ('03_column','public.friendships.user_id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.live_checkout_intents.expires_at','58a1ce0db7d63bed6b786f2ad6463a69'),
 ('03_column','public.live_checkout_intents.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.live_checkout_intents.session_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.live_checkout_intents.user_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.live_recordings.bunny_guid','2236f42e7326f7dd8472c48825de6457'),
 ('03_column','public.live_recordings.created_at','b30535d1c98a7a8067fa35714218f20b'),
 ('03_column','public.live_recordings.egress_id','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.live_recordings.import_lease_until','d60ac2e8689c06b35e5e71e1de7bb9cf'),
 ('03_column','public.live_recordings.import_status','581c4caa0682261d4233f2fd08eec742'),
 ('03_column','public.live_recordings.object_key','a311385d7d7fe75a82fa45a3e0b362f1'),
 ('03_column','public.live_recordings.session_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.live_recordings.status','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.live_recordings.trainer_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.live_recordings.trainer_video_id','9b2e82ab8e9b012e4ef5c9891a327cb2'),
 ('03_column','public.live_recordings.updated_at','3bbc46a3949644892b2fe648694ea67c'),
 ('03_column','public.live_room_access.created_at','3bbc46a3949644892b2fe648694ea67c'),
 ('03_column','public.live_room_access.first_joined_at','0c2351017f889975100f3c0d104c3b85'),
 ('03_column','public.live_room_access.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.live_room_access.session_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.live_room_access.status','4ed460a5a9e8a60cdbed1fd2e42a141b'),
 ('03_column','public.live_room_access.stripe_checkout_session_id','6ee3c68f6e0b9dcf63706653755c94c6'),
 ('03_column','public.live_room_access.user_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.live_room_access.wallet_lot_id','a311385d7d7fe75a82fa45a3e0b362f1'),
 ('03_column','public.live_room_access.wallet_redemption_id','9b2e82ab8e9b012e4ef5c9891a327cb2'),
 ('03_column','public.live_sessions.category','9320faa398e3730c28548b986326b6e6'),
 ('03_column','public.live_sessions.created_at','b33b19550d626de954333892374a2a46'),
 ('03_column','public.live_sessions.description','4bfe30b5456b1b8e31622970445b5b2a'),
 ('03_column','public.live_sessions.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.live_sessions.level','fcff95085addc4585b29962f16c36007'),
 ('03_column','public.live_sessions.minutes','c04ebecc25b2ae9b3515860498927e15'),
 ('03_column','public.live_sessions.price_cents','1778a0af5d52ff1158710895f8e983c6'),
 ('03_column','public.live_sessions.recording_enabled','a8db49808dfb900ef819bedc25c57c29'),
 ('03_column','public.live_sessions.starts_at','fdfda58ccc7a73589c96dbee4bb9ee03'),
 ('03_column','public.live_sessions.status','bd95f71794a5ce8e2d190d6badea49b6'),
 ('03_column','public.live_sessions.title','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.live_sessions.trainer_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.live_sessions.trainer_name','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.meal_plans.approved_at','3abae1001767b5e67d27c7acf8cddc20'),
 ('03_column','public.meal_plans.approved_by','6ee3c68f6e0b9dcf63706653755c94c6'),
 ('03_column','public.meal_plans.plan','033c4595d1077965aadeb46a7f58f1d0'),
 ('03_column','public.meal_plans.target','cf5e2ff0a410272a3ebd0c101b3a0d91'),
 ('03_column','public.meal_plans.updated_at','3bbc46a3949644892b2fe648694ea67c'),
 ('03_column','public.meal_plans.user_id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.menu_shares.client_id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.menu_shares.client_name','d8ba67992f1982ea1c868d68453e7257'),
 ('03_column','public.menu_shares.created_at','b30535d1c98a7a8067fa35714218f20b'),
 ('03_column','public.menu_shares.nutritionist_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.menu_shares.nutritionist_name','043d23567071800cacee3d4fbcbb5786'),
 ('03_column','public.messages.created_at','3bbc46a3949644892b2fe648694ea67c'),
 ('03_column','public.messages.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.messages.recipient_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.messages.sender_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.messages.sender_name','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.messages.text','d597a6163809a8a958ad986e2781dd9e'),
 ('03_column','public.payment_disputes.checkout_id','9c506447412248af191b3b69be9bdee7'),
 ('03_column','public.payment_disputes.created_at','91321c04d5971637a88ca62a5419b566'),
 ('03_column','public.payment_disputes.id','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.payment_disputes.reconciled','019e9ad2f10b1b81a82ccd371fbfa741'),
 ('03_column','public.payment_disputes.status','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.payment_disputes.wallet_remaining','894d446217b8820d39d9f73e5a87dd16'),
 ('03_column','public.payment_disputes.wallet_revoked','c990e3600e87acc4f6be0d725b429de2'),
 ('03_column','public.post_comments.author_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.post_comments.author_name','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.post_comments.created_at','3bbc46a3949644892b2fe648694ea67c'),
 ('03_column','public.post_comments.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.post_comments.post_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.post_comments.text','d597a6163809a8a958ad986e2781dd9e'),
 ('03_column','public.post_likes.post_id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.post_likes.user_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.posts.author_id','df76a7b0c240694b82f2a933c963ac36'),
 ('03_column','public.posts.author_name','e1d48b2fb84db80f5dec0536c13dd76e'),
 ('03_column','public.posts.created_at','91321c04d5971637a88ca62a5419b566'),
 ('03_column','public.posts.id','66b5de24641da96f0c6382060fdaf2fd'),
 ('03_column','public.posts.is_hidden','6bbd491dd73fe27fb60820b9502082e1'),
 ('03_column','public.posts.is_pinned','99bea946c7ad982c92ede220b0461037'),
 ('03_column','public.posts.kind','083bea492f620ca9ca3fa777d5b2de50'),
 ('03_column','public.posts.text','5a8ab9243406ed6509d1a6a3f57a86c5'),
 ('03_column','public.posts.trybe','50c1d9435ae690c1d56ca9635ae62dfb'),
 ('03_column','public.posts.visibility','cc69390b01bcaa8f9129b40a1656fe78'),
 ('03_column','public.private_booking_holds."time"','d597a6163809a8a958ad986e2781dd9e'),
 ('03_column','public.private_booking_holds.day','e306374755763b7cf9df75e52b10a748'),
 ('03_column','public.private_booking_holds.expires_at','df18604a6ac23d18b450d348b2752ac2'),
 ('03_column','public.private_booking_holds.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.private_booking_holds.member_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.private_booking_holds.trainer_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.private_session_access."time"','d597a6163809a8a958ad986e2781dd9e'),
 ('03_column','public.private_session_access.checkout_id','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.private_session_access.created_at','eb815df7831c03ccec925a82d8499fa7'),
 ('03_column','public.private_session_access.day','e306374755763b7cf9df75e52b10a748'),
 ('03_column','public.private_session_access.member_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.private_session_access.starts_at','211fd5a82a4277cd0f9146787ad648b3'),
 ('03_column','public.private_session_access.status','fcbb3fb2527fb4b5519f87f14f41d91c'),
 ('03_column','public.private_session_access.trainer_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.profiles.active_days','9d0016713e717c4e5f658016deb0d06d'),
 ('03_column','public.profiles.avatar_url','0bf6380399897dd6ad6d650840b6a893'),
 ('03_column','public.profiles.bookings','17f24756ff5e0a6e74141cb813ab84be'),
 ('03_column','public.profiles.created_at','aaf1c3e5712ff1d13690226d7c3308b6'),
 ('03_column','public.profiles.dr_gap','c99d955e620cac9e38d1db28fdc6ba95'),
 ('03_column','public.profiles.extra','a15068b0be338102ee0b0a40bda3897a'),
 ('03_column','public.profiles.goal','a311385d7d7fe75a82fa45a3e0b362f1'),
 ('03_column','public.profiles.height','84fcf7e5c5eba9fc01a881fd358083e8'),
 ('03_column','public.profiles.history','9e6174450e7c9942f01098d2c6b2088f'),
 ('03_column','public.profiles.id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.profiles.joined','b3d817308c3d70e5364f1cb8041ef620'),
 ('03_column','public.profiles.ledger','f99edae1f962124aa89a787e4a007e21'),
 ('03_column','public.profiles.level','2236f42e7326f7dd8472c48825de6457'),
 ('03_column','public.profiles.name','e705d3c38e33965c59dc4b26f3b85742'),
 ('03_column','public.profiles.partners','1b3a42f6f6634407d3c874678484e6e4'),
 ('03_column','public.profiles.postpartum','99bea946c7ad982c92ede220b0461037'),
 ('03_column','public.profiles.prefs','67ca7538ce531d75179a2fd3b1aee79e'),
 ('03_column','public.profiles.reservations','873a1a4a24e03a4d3414d150c2ce5264'),
 ('03_column','public.profiles.role','e7bc6c3c86cfab3b8e2a15ac5a2a6e93'),
 ('03_column','public.profiles.scheduled','9ca3345d3d59ec206c3275306d6f5f1e'),
 ('03_column','public.profiles.tokens','8a22267910dbc3706fb72bbd3593ad39'),
 ('03_column','public.profiles.updated_at','c6094e5d43493fecdf3f6254feee1a69'),
 ('03_column','public.profiles.watch_later','f03f5d6bca3220d8ce6de74a2c78d9d9'),
 ('03_column','public.profiles.weeks_postpartum','a6062b88c445731e4c192586352e0868'),
 ('03_column','public.profiles.weigh_ins','bf694661befcedaeee3235ad387cc470'),
 ('03_column','public.profiles.weight','26e062326bf6ebc0c4c253790fcbb8e2'),
 ('03_column','public.push_reminders.body','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.push_reminders.fire_at','750ab5759e888495f7d57d7d0fa5336f'),
 ('03_column','public.push_reminders.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.push_reminders.live_id','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.push_reminders.sent','019e9ad2f10b1b81a82ccd371fbfa741'),
 ('03_column','public.push_reminders.user_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.push_subscriptions.auth','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.push_subscriptions.created_at','b30535d1c98a7a8067fa35714218f20b'),
 ('03_column','public.push_subscriptions.endpoint','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.push_subscriptions.p256dh','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.push_subscriptions.user_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.recording_start_locks.reserved_at','28e0b14dc0acda1918aaffeaac2882de'),
 ('03_column','public.recording_start_locks.session_id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.refund_jobs.checkout_id','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.refund_jobs.completed_at','38137736569cff065d390476a95afd26'),
 ('03_column','public.refund_jobs.provider_id','7cd602a9f6c9607f39c62aca665cd4d9'),
 ('03_column','public.refund_jobs.reason','9c506447412248af191b3b69be9bdee7'),
 ('03_column','public.refund_jobs.requested_at','ae53a45bd8f4ef79fa35d79f05003a01'),
 ('03_column','public.refund_jobs.target_cents','3db3f5ad659422ada2f8e507d38642de'),
 ('03_column','public.reviews.author_id','0e9f0924be520cf7e269c1378b1b4d5a'),
 ('03_column','public.reviews.author_name','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.reviews.created_at','eb815df7831c03ccec925a82d8499fa7'),
 ('03_column','public.reviews.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.reviews.reply','a311385d7d7fe75a82fa45a3e0b362f1'),
 ('03_column','public.reviews.stars','651c42fa85c2385f87b3e114a7b75665'),
 ('03_column','public.reviews.text','d597a6163809a8a958ad986e2781dd9e'),
 ('03_column','public.reviews.trainer_id','9c506447412248af191b3b69be9bdee7'),
 ('03_column','public.room_shutdown_jobs.completed_at','63eefdf8a0df80ece37e44fd3fa6e06b'),
 ('03_column','public.room_shutdown_jobs.session_id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.trainer_accounts.created_at','b30535d1c98a7a8067fa35714218f20b'),
 ('03_column','public.trainer_accounts.payouts_enabled','c02cf18a30f6bf8546c6dac2d320e866'),
 ('03_column','public.trainer_accounts.slug','6698eef5e07efc05f6f1a06f8b4edcd7'),
 ('03_column','public.trainer_accounts.stripe_account_id','b48ef7411e6a52609fd77ce0cec54733'),
 ('03_column','public.trainer_accounts.user_id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.trainer_busy."time"','6bea7e45fdaa03d15c9a66e5beef0429'),
 ('03_column','public.trainer_busy.created_at','b30535d1c98a7a8067fa35714218f20b'),
 ('03_column','public.trainer_busy.day','7a36346d6f81c903ec31afd88063ca97'),
 ('03_column','public.trainer_busy.source','703ef22c39c3e209da812224e949f5cb'),
 ('03_column','public.trainer_busy.trainer_id','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.trainer_earnings.adjustment_for','176c38af346ffba71b2b41059af6cec8'),
 ('03_column','public.trainer_earnings.created_at','2130ff8ee26dfc2c8a5cf2fa03cfb02f'),
 ('03_column','public.trainer_earnings.fee_cents','1a4f6dcd5f1d24f83bc7038f70157239'),
 ('03_column','public.trainer_earnings.gross_cents','2142f751e7c16dc3b5e85d6d0764a0cd'),
 ('03_column','public.trainer_earnings.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.trainer_earnings.net_cents','289b3461cca708df84e2fa8a1efaaf09'),
 ('03_column','public.trainer_earnings.operation_amount','df9c5eee298b946a0e180983f2c8b7b6'),
 ('03_column','public.trainer_earnings.operation_key','05bd067b370f0fdb63e974a230837e86'),
 ('03_column','public.trainer_earnings.operation_kind','882857b8c7aeb23c8c3a6a875b283f11'),
 ('03_column','public.trainer_earnings.operation_lease_until','261550f342e36e2788043290fc74a699'),
 ('03_column','public.trainer_earnings.operation_target','6bd7b65ef35fbb86af2a26c85da3c7a5'),
 ('03_column','public.trainer_earnings.payout_cents','d6fc9440e34b3f300eb0072371fee5c8'),
 ('03_column','public.trainer_earnings.ref','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.trainer_earnings.reversal_target_cents','718cf4cf2da85b03ae53031b1dd07cc0'),
 ('03_column','public.trainer_earnings.share_pct','b966c1688c66795977120c9b80c3a2a5'),
 ('03_column','public.trainer_earnings.source','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.trainer_earnings.status','581c4caa0682261d4233f2fd08eec742'),
 ('03_column','public.trainer_earnings.trainer_slug','9c506447412248af191b3b69be9bdee7'),
 ('03_column','public.trainer_earnings.transfer_id','c99d955e620cac9e38d1db28fdc6ba95'),
 ('03_column','public.trainer_earnings.transfer_reversed_cents','a44957bcb96fab7c02dd6947623ed07b'),
 ('03_column','public.trainer_earnings.withheld_cents','7e912d756cf5a1304257b8ea6f6b1d4d'),
 ('03_column','public.trainer_program_workouts."position"','7747e163174843dd7a5bc5cc967b8453'),
 ('03_column','public.trainer_program_workouts.program_id','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.trainer_program_workouts.video_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.trainer_programs.created_at','3bbc46a3949644892b2fe648694ea67c'),
 ('03_column','public.trainer_programs.description','e339739f9ad13434a32c47a55e90af8b'),
 ('03_column','public.trainer_programs.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.trainer_programs.published','2bf7a4f1d4eae2e055d3682c16a9d5e5'),
 ('03_column','public.trainer_programs.title','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.trainer_programs.trainer_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.trainer_store_items.created_at','b33b19550d626de954333892374a2a46'),
 ('03_column','public.trainer_store_items.description','e339739f9ad13434a32c47a55e90af8b'),
 ('03_column','public.trainer_store_items.external_url','fcbb3fb2527fb4b5519f87f14f41d91c'),
 ('03_column','public.trainer_store_items.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.trainer_store_items.image_url','81a32260b7feb3a5038fda86e78cac15'),
 ('03_column','public.trainer_store_items.item_type','cf3ed25cfb2793c72b06c0026f1d34dd'),
 ('03_column','public.trainer_store_items.price_cents','1b36cb2840455339d3ff64f6eb12ac99'),
 ('03_column','public.trainer_store_items.published','bed65b5872f3cdba33972caa150f407e'),
 ('03_column','public.trainer_store_items.title','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.trainer_store_items.trainer_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.trainer_videos.break_seconds','6138a1ea19e0004523b9b4b8fb8bce89'),
 ('03_column','public.trainer_videos.breaks','0db8e7ba3286ab05e059b6accf2c91bf'),
 ('03_column','public.trainer_videos.category','e339739f9ad13434a32c47a55e90af8b'),
 ('03_column','public.trainer_videos.created_at','91321c04d5971637a88ca62a5419b566'),
 ('03_column','public.trainer_videos.description','1ea09344e38f4e38ecdcc9c1a2d44b22'),
 ('03_column','public.trainer_videos.equipment','f7e92cc9a1ad16f943a6dd43184ff2a1'),
 ('03_column','public.trainer_videos.goals','4dc56723911fb13dadab0feb3adaa74c'),
 ('03_column','public.trainer_videos.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.trainer_videos.level','8222832586eb2b94b531e75478b21b4c'),
 ('03_column','public.trainer_videos.minutes','4c45ba59a769c75914631c443b1382c3'),
 ('03_column','public.trainer_videos.optional_equipment','8e1b0f0b2c39d3401c03f6962e207155'),
 ('03_column','public.trainer_videos.path','c34b3142a92a6abae90c13f89fc9977b'),
 ('03_column','public.trainer_videos.playlist','3cb334a618f2bbf3467c1d51dcc92753'),
 ('03_column','public.trainer_videos.pregnancy_safe','450b5907230293d21cbb00298cf71d7b'),
 ('03_column','public.trainer_videos.required_equipment','d6154f089a117ea05741c3b6ed6e9c28'),
 ('03_column','public.trainer_videos.review_note','d2f73d62eb23a889f9bcf6217d0b2427'),
 ('03_column','public.trainer_videos.review_status','c37b09d01331718addc5a57f25f6ec91'),
 ('03_column','public.trainer_videos.reviewed_at','98c7cc099bb5983b519c9d36d466c8d3'),
 ('03_column','public.trainer_videos.reviewed_by','42a5165175a79ccefe6a7cd4518c2fcc'),
 ('03_column','public.trainer_videos.spotify_url','e6b8be98dd559f5dd1ad22636e3606b7'),
 ('03_column','public.trainer_videos.title','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.trainer_videos.user_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.trybe_memberships.joined_at','ae53a45bd8f4ef79fa35d79f05003a01'),
 ('03_column','public.trybe_memberships.trybe_id','6196d667a8082c6e77cc8ea1aa3ced13'),
 ('03_column','public.trybe_memberships.user_id','4100edd5b60db8032284f8230dd8a8dc'),
 ('03_column','public.trybes.created_at','916edbd5580f4c6ce3aa1bc217409e43'),
 ('03_column','public.trybes.id','62fe046f18dd4ef696156a9ecc12ba6f'),
 ('03_column','public.trybes.kind','ba3c6ac3676a6dfb99d18fcf86aca320'),
 ('03_column','public.trybes.name','c171f0210a093a8c344f5ac440ae083b'),
 ('03_column','public.trybes.owner_id','aab778420f23b75e81f72ee3e27fd7f1'),
 ('03_column','public.user_roles.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.user_roles.role','210cd6f49599e6701244e74c64e24297'),
 ('03_column','public.user_roles.user_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.video_uploads.created_at','d8511ad51d26923c6cbc52b2e5023e3a'),
 ('03_column','public.video_uploads.guid','d661e8552c8520dc658101e5ea7d2c58'),
 ('03_column','public.video_uploads.library_id','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.video_uploads.user_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.waitlist_entries.created_at','d8511ad51d26923c6cbc52b2e5023e3a'),
 ('03_column','public.waitlist_entries.email','9c506447412248af191b3b69be9bdee7'),
 ('03_column','public.waitlist_entries.heard_from','7cd602a9f6c9607f39c62aca665cd4d9'),
 ('03_column','public.waitlist_entries.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.waitlist_entries.live_class_interest','81a32260b7feb3a5038fda86e78cac15'),
 ('03_column','public.waitlist_entries.notify_new_coaches','c7ae060912593c9875b1f3f9afe0c6cf'),
 ('03_column','public.waitlist_entries.role','26ad8cf2276f79ae7a361ea400bf56c3'),
 ('03_column','public.wallet_redemptions.cancelled','019e9ad2f10b1b81a82ccd371fbfa741'),
 ('03_column','public.wallet_redemptions.created_at','91321c04d5971637a88ca62a5419b566'),
 ('03_column','public.wallet_redemptions.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.wallet_redemptions.lot_id','9c506447412248af191b3b69be9bdee7'),
 ('03_column','public.wallet_redemptions.session_id','e00ec69299b0fe765343be6520f2cdd0'),
 ('03_column','public.wallet_redemptions.unit_index','7747e163174843dd7a5bc5cc967b8453'),
 ('03_column','public.wallet_redemptions.user_id','08365342b63a8c3bba522a348975e5ec'),
 ('03_column','public.wallet_token_lots.created_at','91321c04d5971637a88ca62a5419b566'),
 ('03_column','public.wallet_token_lots.fee_cents','1a4f6dcd5f1d24f83bc7038f70157239'),
 ('03_column','public.wallet_token_lots.frozen','6bbd491dd73fe27fb60820b9502082e1'),
 ('03_column','public.wallet_token_lots.gross_cents','2142f751e7c16dc3b5e85d6d0764a0cd'),
 ('03_column','public.wallet_token_lots.id','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.wallet_token_lots.purchased','7747e163174843dd7a5bc5cc967b8453'),
 ('03_column','public.wallet_token_lots.remaining','e1cffe3ab824ade5e308127459c41a7e'),
 ('03_column','public.wallet_token_lots.revoked','4c45ba59a769c75914631c443b1382c3'),
 ('03_column','public.wallet_token_lots.user_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.wallet_token_units.lot_id','e829a14a55c54f6cb8b7840ce6164434'),
 ('03_column','public.wallet_token_units.redemption_id','95cd46ad0fd5c766b8e4f7bcb5506ab5'),
 ('03_column','public.wallet_token_units.state','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.wallet_token_units.unit_index','d75935fabdc8061866ce23660763d591'),
 ('03_column','public.water_break_campaigns.active','2bf7a4f1d4eae2e055d3682c16a9d5e5'),
 ('03_column','public.water_break_campaigns.created_at','eb815df7831c03ccec925a82d8499fa7'),
 ('03_column','public.water_break_campaigns.creative_type','3ab43826eb3a4a61238c6d95cce419bd'),
 ('03_column','public.water_break_campaigns.creative_url','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.water_break_campaigns.destination_url','e316be174d8b570836a10991a2539dfc'),
 ('03_column','public.water_break_campaigns.end_at','306d284541a3dab54605e01a1d0f529b'),
 ('03_column','public.water_break_campaigns.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.water_break_campaigns.start_at','347c8844f8985345842e8293600654f3'),
 ('03_column','public.water_break_campaigns.title','9c506447412248af191b3b69be9bdee7'),
 ('03_column','public.water_break_events.break_second','2142f751e7c16dc3b5e85d6d0764a0cd'),
 ('03_column','public.water_break_events.campaign_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.water_break_events.created_at','91321c04d5971637a88ca62a5419b566'),
 ('03_column','public.water_break_events.event_type','c34b3142a92a6abae90c13f89fc9977b'),
 ('03_column','public.water_break_events.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.water_break_events.video_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.water_break_events.viewer_id','95cd46ad0fd5c766b8e4f7bcb5506ab5'),
 ('03_column','public.water_break_impressions.break_second','2142f751e7c16dc3b5e85d6d0764a0cd'),
 ('03_column','public.water_break_impressions.campaign_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('03_column','public.water_break_impressions.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.water_break_impressions.impression_day','352bc05986ea6914bfb801f28eacd700'),
 ('03_column','public.water_break_impressions.playback_id','08365342b63a8c3bba522a348975e5ec'),
 ('03_column','public.water_break_impressions.recorded_at','3bbc46a3949644892b2fe648694ea67c'),
 ('03_column','public.water_break_impressions.video_id','8fc8d84bf15f1a5ab58dcf013da25ad0'),
 ('03_column','public.water_break_impressions.viewer_id','fa7bd471b722ad7d2bdb188bb2070607'),
 ('03_column','public.youth_consents.contributor_age','e1cffe3ab824ade5e308127459c41a7e'),
 ('03_column','public.youth_consents.contributor_name','1e43e31796228ee37c59ff1e06f011e4'),
 ('03_column','public.youth_consents.created_at','b33b19550d626de954333892374a2a46'),
 ('03_column','public.youth_consents.guardian_email','c34b3142a92a6abae90c13f89fc9977b'),
 ('03_column','public.youth_consents.guardian_name','d597a6163809a8a958ad986e2781dd9e'),
 ('03_column','public.youth_consents.guardian_signature','fcbb3fb2527fb4b5519f87f14f41d91c'),
 ('03_column','public.youth_consents.id','5a119508c19a594c1ba9fe9af04ec442'),
 ('03_column','public.youth_consents.release_agreed','69f16d8ffd8ff813cda1e587bcee87da'),
 ('03_column','public.youth_consents.status','dd987680cf8c77499b13ef18489c05aa'),
 ('03_column','public.youth_consents.user_id','1a233495e6e2a72db402ebec6b2bd635'),
 ('04_constraint','public.ad_settlement_events.ad_settlement_events_break_second_check','8d71ab5372d956b561b4d5013c81dc6c'),
 ('04_constraint','public.ad_settlement_events.ad_settlement_events_check','968b0b039749fcb90f63a74a6d418c27'),
 ('04_constraint','public.ad_settlement_events.ad_settlement_events_gross_cents_check','bae2c259d0f6b3a7224abbd01aa2ba85'),
 ('04_constraint','public.ad_settlement_events.ad_settlement_events_network_network_event_id_key','699fc37d0af71c81788791d4899ec8f0'),
 ('04_constraint','public.ad_settlement_events.ad_settlement_events_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.ad_settlement_events.ad_settlement_events_trainer_id_fkey','116a7f423f2f3e0b187fab9ded8ef978'),
 ('04_constraint','public.certifications.certifications_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.certifications.certifications_status_check','39211d7afbe6a945f1358094e319eff9'),
 ('04_constraint','public.certifications.certifications_user_id_fkey','6eac073e0a11c149e9450e2acbd9294b'),
 ('04_constraint','public.certifications.certifications_verified_by_fkey','1e65c0fe64c04b41bc6fa9c4ae4b3e42'),
 ('04_constraint','public.checkout_payment_state.checkout_payment_state_fee_cents_check','bf5a4523ac1d11431449e9cf77017c65'),
 ('04_constraint','public.checkout_payment_state.checkout_payment_state_gross_cents_check','bae2c259d0f6b3a7224abbd01aa2ba85'),
 ('04_constraint','public.checkout_payment_state.checkout_payment_state_kind_check','fc1d87a921812f530f321f7cae439b94'),
 ('04_constraint','public.checkout_payment_state.checkout_payment_state_pkey','168779ae1299a634b14561ce72400510'),
 ('04_constraint','public.checkout_payment_state.checkout_payment_state_refunded_cents_check','56deaa242eb768ef3c0a7b233363edee'),
 ('04_constraint','public.checkout_payment_state.checkout_payment_state_user_id_fkey','6a06652f9b029d331133e8a9382cfb73'),
 ('04_constraint','public.comments.comments_author_id_fkey','d33dd3d39f8ccc76cb1503dba8686030'),
 ('04_constraint','public.comments.comments_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.comments.comments_post_id_fkey','d90db5202a273a9a78c3bcb0d2165241'),
 ('04_constraint','public.comments.comments_text_check','29452a5a44d88689b5adeeac766e1634'),
 ('04_constraint','public.credential_reviews.credential_reviews_credential_id_fkey','47afb5461f41740fe472ec3ac74d78ee'),
 ('04_constraint','public.credential_reviews.credential_reviews_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.cron_tokens.cron_tokens_pkey','6cd4f97656de693e02721d0b6029575a'),
 ('04_constraint','public.friend_requests.friend_requests_pkey','9160de5b22f31de3e159b1dd157e3462'),
 ('04_constraint','public.friend_requests.friend_requests_recipient_id_fkey','10eb74c152d44db88b36bd0487348b8a'),
 ('04_constraint','public.friend_requests.friend_requests_requester_id_fkey','2198bf3a1d164b0b6a578ed1b3634aed'),
 ('04_constraint','public.friend_requests.no_self_friend_request','830d685601f190e4954fd71e111e6084'),
 ('04_constraint','public.friendships.friendships_check','7ec76ce2ace0610eb49424247345b397'),
 ('04_constraint','public.friendships.friendships_pkey','e67a5d09bca6db383c64b1ffe5669f00'),
 ('04_constraint','public.live_checkout_intents.live_checkout_intents_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.live_checkout_intents.live_checkout_intents_session_id_fkey','ac65892e40e4c8cdf379f13163f32877'),
 ('04_constraint','public.live_checkout_intents.live_checkout_intents_user_id_fkey','6a06652f9b029d331133e8a9382cfb73'),
 ('04_constraint','public.live_checkout_intents.live_checkout_intents_user_id_session_id_key','c2502b230013862df2099e1610caba08'),
 ('04_constraint','public.live_recordings.live_recordings_import_status_check','bdc7903bb5feba914291d0d20395e03a'),
 ('04_constraint','public.live_recordings.live_recordings_pkey','a00d95197b2c90ead5d17326856e0c05'),
 ('04_constraint','public.live_recordings.live_recordings_session_id_fkey','a9e7bfc9c1594c7fce6203d65ed6b645'),
 ('04_constraint','public.live_recordings.live_recordings_status_check','ecb4e76b9212880f7575f5a029358ca9'),
 ('04_constraint','public.live_recordings.live_recordings_trainer_id_fkey','116a7f423f2f3e0b187fab9ded8ef978'),
 ('04_constraint','public.live_recordings.live_recordings_trainer_video_id_fkey','809f689513215ddd27e22bc2ba82a97c'),
 ('04_constraint','public.live_room_access.live_room_access_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.live_room_access.live_room_access_session_id_fkey','a9e7bfc9c1594c7fce6203d65ed6b645'),
 ('04_constraint','public.live_room_access.live_room_access_session_id_user_id_key','5a67ff00c231f058536e7b47e988b31f'),
 ('04_constraint','public.live_room_access.live_room_access_status_check','03d1c49569af98f500c5482c56a2b1f6'),
 ('04_constraint','public.live_room_access.live_room_access_user_id_fkey','6eac073e0a11c149e9450e2acbd9294b'),
 ('04_constraint','public.live_room_access.live_room_access_wallet_lot_id_fkey','971477f46eb0c898445f22c64becf4ef'),
 ('04_constraint','public.live_room_access.live_room_access_wallet_redemption_id_fkey','17c229bbd39849931accb10a49d4cccf'),
 ('04_constraint','public.live_sessions.live_sessions_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.live_sessions.live_sessions_price_cents_check','14171af77a44bf4663823f53175429f6'),
 ('04_constraint','public.live_sessions.live_sessions_status_check','9050b0849f88ae7f32c2b197ded7e400'),
 ('04_constraint','public.meal_plans.meal_plans_pkey','6387f0cfd53ce6396ec641ae28af6eb3'),
 ('04_constraint','public.menu_shares.menu_shares_pkey','59294f80132d9688382cfc401589038a'),
 ('04_constraint','public.messages.messages_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.messages.messages_text_check','6e8df19a03e194ebaa72f5c5a3d53d36'),
 ('04_constraint','public.payment_disputes.payment_disputes_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.payment_disputes.payment_disputes_status_check','6cfee5a7563e6bfc8e9e4153542e248c'),
 ('04_constraint','public.post_comments.post_comments_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.post_comments.post_comments_post_id_fkey','d90db5202a273a9a78c3bcb0d2165241'),
 ('04_constraint','public.post_comments.post_comments_text_check','61b5e2e9ca342f3641690cfba442ed0b'),
 ('04_constraint','public.post_likes.post_likes_pkey','cafb52231770985e427b85e50929e81b'),
 ('04_constraint','public.post_likes.post_likes_post_id_fkey','d90db5202a273a9a78c3bcb0d2165241'),
 ('04_constraint','public.posts.posts_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.posts.posts_text_check','6e8df19a03e194ebaa72f5c5a3d53d36'),
 ('04_constraint','public.posts.posts_visibility_check','aba940ffe478d536bf03695dd66da35b'),
 ('04_constraint','public.private_booking_holds.private_booking_holds_member_id_fkey','1d9c9f846611dece657412e4a84d740f'),
 ('04_constraint','public.private_booking_holds.private_booking_holds_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.private_booking_holds.private_booking_holds_time_check','68288f04a35b9244e95e0be50718b807'),
 ('04_constraint','public.private_booking_holds.private_booking_holds_trainer_id_fkey','116a7f423f2f3e0b187fab9ded8ef978'),
 ('04_constraint','public.private_session_access.private_session_access_member_id_fkey','1d9c9f846611dece657412e4a84d740f'),
 ('04_constraint','public.private_session_access.private_session_access_pkey','168779ae1299a634b14561ce72400510'),
 ('04_constraint','public.private_session_access.private_session_access_status_check','fca9e6d9969b147fae2949bfb8251726'),
 ('04_constraint','public.private_session_access.private_session_access_trainer_id_fkey','116a7f423f2f3e0b187fab9ded8ef978'),
 ('04_constraint','public.profiles.profiles_id_fkey','885905ae6efed13fa1369b5192c79367'),
 ('04_constraint','public.profiles.profiles_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.profiles.profiles_role_check','74976e08447f4d72adbee3c7aa9989a5'),
 ('04_constraint','public.push_reminders.push_reminders_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.push_reminders.push_reminders_user_id_live_id_fire_at_key','792af7f045d6f277f9dca040250ab6df'),
 ('04_constraint','public.push_subscriptions.push_subscriptions_pkey','551dcaf75acf3aeba691543f2407cf0c'),
 ('04_constraint','public.recording_start_locks.recording_start_locks_pkey','f980c81aeac50d91bd9371c10439ca15'),
 ('04_constraint','public.recording_start_locks.recording_start_locks_session_id_fkey','ac65892e40e4c8cdf379f13163f32877'),
 ('04_constraint','public.refund_jobs.refund_jobs_pkey','168779ae1299a634b14561ce72400510'),
 ('04_constraint','public.reviews.reviews_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.reviews.reviews_stars_check','bc713a660fb3dd525a46825420236fef'),
 ('04_constraint','public.reviews.reviews_text_check','6e8df19a03e194ebaa72f5c5a3d53d36'),
 ('04_constraint','public.room_shutdown_jobs.room_shutdown_jobs_pkey','f980c81aeac50d91bd9371c10439ca15'),
 ('04_constraint','public.room_shutdown_jobs.room_shutdown_jobs_session_id_fkey','ac65892e40e4c8cdf379f13163f32877'),
 ('04_constraint','public.trainer_accounts.trainer_accounts_pkey','6387f0cfd53ce6396ec641ae28af6eb3'),
 ('04_constraint','public.trainer_accounts.trainer_accounts_slug_key','b238966c12579a61aab1fd1d08dade6b'),
 ('04_constraint','public.trainer_busy.trainer_busy_pkey','87253d348c74227ba14445fb8913f9da'),
 ('04_constraint','public.trainer_earnings.earnings_reversal_bounds','c82c5f0e89ebe7654f5a24225d75855c'),
 ('04_constraint','public.trainer_earnings.trainer_earnings_adjustment_for_fkey','08c1d67b4a5317dda42a9948331f2a21'),
 ('04_constraint','public.trainer_earnings.trainer_earnings_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.trainer_earnings.trainer_earnings_ref_key','3333483ea1ff1c2d1e8e0449177e2e0f'),
 ('04_constraint','public.trainer_earnings.trainer_earnings_source_check','556ba9aa8e3f3c19d651f468d8bdc2a1'),
 ('04_constraint','public.trainer_earnings.trainer_earnings_status_check','5d0058d57668837c5aa721df977aab0e'),
 ('04_constraint','public.trainer_program_workouts.trainer_program_workouts_pkey','521066010f0d79be6e150b44b314d95c'),
 ('04_constraint','public.trainer_program_workouts.trainer_program_workouts_position_check','945c9e333b0dc259798cb07abcb3f905'),
 ('04_constraint','public.trainer_program_workouts.trainer_program_workouts_program_id_fkey','cd9c85c13a3e10f1765a52b063500ad3'),
 ('04_constraint','public.trainer_program_workouts.trainer_program_workouts_program_id_position_key','a6098ac340a6963513412fc8c1f5f031'),
 ('04_constraint','public.trainer_program_workouts.trainer_program_workouts_video_id_fkey','b8432ce7e8510ef9d7f8991808a3ce46'),
 ('04_constraint','public.trainer_programs.trainer_programs_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.trainer_programs.trainer_programs_title_check','5258b99e56a5c5aaf4bea398fc6ec6c1'),
 ('04_constraint','public.trainer_programs.trainer_programs_trainer_id_fkey','705b7a75173a83761e20d8a45b036ea8'),
 ('04_constraint','public.trainer_store_items.trainer_store_items_external_url_check','7b789011519881788efe0dda1de5da98'),
 ('04_constraint','public.trainer_store_items.trainer_store_items_item_type_check','68972891cb48b23f7920945d3de398bc'),
 ('04_constraint','public.trainer_store_items.trainer_store_items_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.trainer_store_items.trainer_store_items_price_cents_check','a5e08ea054d87a8845fd2bf3fd645437'),
 ('04_constraint','public.trainer_store_items.trainer_store_items_title_check','5258b99e56a5c5aaf4bea398fc6ec6c1'),
 ('04_constraint','public.trainer_store_items.trainer_store_items_trainer_id_fkey','705b7a75173a83761e20d8a45b036ea8'),
 ('04_constraint','public.trainer_videos.trainer_videos_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.trainer_videos.trainer_videos_review_status_check','c449ccab23dc13ca290a3d7e116ce127'),
 ('04_constraint','public.trainer_videos.trainer_videos_user_id_fkey','6eac073e0a11c149e9450e2acbd9294b'),
 ('04_constraint','public.trybe_memberships.trybe_memberships_pkey','a9a5c7b4175659686847f166a54ad11a'),
 ('04_constraint','public.trybe_memberships.trybe_memberships_trybe_id_check','1e4649f812aa481e5acf6e2071054f37'),
 ('04_constraint','public.trybe_memberships.trybe_memberships_user_id_fkey','6eac073e0a11c149e9450e2acbd9294b'),
 ('04_constraint','public.trybes.trybes_id_check','4efcc994d85ae04975501f77915953f0'),
 ('04_constraint','public.trybes.trybes_kind_check','2edad269f46155c31e30b47cb15f7ea7'),
 ('04_constraint','public.trybes.trybes_name_check','0973a109e312bb90111240285021fa14'),
 ('04_constraint','public.trybes.trybes_one_per_owner','38d51164f44de65cc4170550244073cd'),
 ('04_constraint','public.trybes.trybes_owner_id_fkey','092665c59cee3a4a1b3ecae1d95d005e'),
 ('04_constraint','public.trybes.trybes_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.user_roles.user_roles_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.user_roles.user_roles_user_id_fkey','6eac073e0a11c149e9450e2acbd9294b'),
 ('04_constraint','public.user_roles.user_roles_user_id_role_key','20c900bc7384938b112a3fdd698c0a9e'),
 ('04_constraint','public.video_uploads.video_uploads_pkey','1471b444fc00e5b7335a82353efc13f0'),
 ('04_constraint','public.video_uploads.video_uploads_user_id_fkey','6a06652f9b029d331133e8a9382cfb73'),
 ('04_constraint','public.waitlist_entries.waitlist_entries_email_key','c6a004f044fa2f8c3548b26d49b18f22'),
 ('04_constraint','public.waitlist_entries.waitlist_entries_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.waitlist_entries.waitlist_entries_role_check','ca632485000df3702eba7040342989dc'),
 ('04_constraint','public.waitlist_entries.waitlist_heard_from_valid','8cb9020cdf444e01795e4eee0d6d9803'),
 ('04_constraint','public.waitlist_entries.waitlist_live_class_interest_valid','bd6c013d7099c61597a0dc79f43062df'),
 ('04_constraint','public.wallet_redemptions.wallet_redemptions_lot_id_fkey','3e9d73090e7dcde54b5205b8c38c9807'),
 ('04_constraint','public.wallet_redemptions.wallet_redemptions_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.wallet_redemptions.wallet_redemptions_session_id_fkey','ac65892e40e4c8cdf379f13163f32877'),
 ('04_constraint','public.wallet_redemptions.wallet_redemptions_user_id_fkey','6a06652f9b029d331133e8a9382cfb73'),
 ('04_constraint','public.wallet_token_lots.wallet_token_lots_check','9b7d59d8b793bfcdb0c7d30e002c02d4'),
 ('04_constraint','public.wallet_token_lots.wallet_token_lots_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.wallet_token_lots.wallet_token_lots_purchased_check','fbf39249910316cad906ae53638ae087'),
 ('04_constraint','public.wallet_token_lots.wallet_token_lots_remaining_check','02b4d09684f034e228141d9a8d02d6fc'),
 ('04_constraint','public.wallet_token_lots.wallet_token_lots_user_id_fkey','6a06652f9b029d331133e8a9382cfb73'),
 ('04_constraint','public.wallet_token_units.wallet_token_units_lot_id_fkey','3e9d73090e7dcde54b5205b8c38c9807'),
 ('04_constraint','public.wallet_token_units.wallet_token_units_pkey','cdda851bb26d643db341d557e991e88d'),
 ('04_constraint','public.wallet_token_units.wallet_token_units_redemption_id_fkey','9a5709dcdda903950411af62983385ba'),
 ('04_constraint','public.wallet_token_units.wallet_token_units_state_check','c3191e12624256fbf9e0e52c0ea05af3'),
 ('04_constraint','public.water_break_campaigns.water_break_campaigns_creative_type_check','4b07ff6d1a83df443870b2fa3fc58a23'),
 ('04_constraint','public.water_break_campaigns.water_break_campaigns_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.water_break_events.water_break_events_break_second_check','7bafa72c138327b26cc826035100a0df'),
 ('04_constraint','public.water_break_events.water_break_events_campaign_id_fkey','275b6f687129886cd3b23bf4738e07a2'),
 ('04_constraint','public.water_break_events.water_break_events_event_type_check','3a1e7acec5f16e1539e289001afaa8cd'),
 ('04_constraint','public.water_break_events.water_break_events_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.water_break_events.water_break_events_video_id_fkey','516ceb3ae61cfe33a6ec47499f33f3bf'),
 ('04_constraint','public.water_break_events.water_break_events_viewer_id_fkey','a4412c914384b602112bd2d5ea321401'),
 ('04_constraint','public.water_break_impressions.water_break_impressions_break_second_check','8d71ab5372d956b561b4d5013c81dc6c'),
 ('04_constraint','public.water_break_impressions.water_break_impressions_campaign_id_fkey','275b6f687129886cd3b23bf4738e07a2'),
 ('04_constraint','public.water_break_impressions.water_break_impressions_campaign_id_video_id_playback_id_br_key','19ded7fa22941178a9ac6288698388f4'),
 ('04_constraint','public.water_break_impressions.water_break_impressions_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.water_break_impressions.water_break_impressions_video_id_fkey','516ceb3ae61cfe33a6ec47499f33f3bf'),
 ('04_constraint','public.water_break_impressions.water_break_impressions_viewer_id_fkey','a4412c914384b602112bd2d5ea321401'),
 ('04_constraint','public.youth_consents.youth_consents_pkey','573374a4fc47a0d74cd7fb4119165a43'),
 ('04_constraint','public.youth_consents.youth_consents_user_id_key','ad60e11ef917e977254e6abf1296dbaa'),
 ('05_index','public.ad_settlement_events_network_network_event_id_key','0cdb1e37f83aa5a952a3eec3f585c27d'),
 ('05_index','public.ad_settlement_events_pkey','e15950644f86d66ce6490b4392fd0bd1'),
 ('05_index','public.certifications_pkey','56c0dd27d7f17b0e271da136279aae69'),
 ('05_index','public.certifications_status_idx','2802b26f52269c08f78391e2f7d45a48'),
 ('05_index','public.certifications_user_id_idx','cfa9e5dd74fce277c64e98edf47a1590'),
 ('05_index','public.checkout_payment_state_pkey','01b7b31b4150d4901a6083da9a1ed53b'),
 ('05_index','public.comments_pkey','3f43d8781ada64158c16cfc3b830693c'),
 ('05_index','public.comments_post_id_idx','81bb270e4016ccd91fa25f66b7bcd17f'),
 ('05_index','public.credential_reviews_pkey','937c0362949a4ef073751f8983113775'),
 ('05_index','public.cron_tokens_pkey','335f72563432144f5a918383c6bbe15d'),
 ('05_index','public.friend_requests_pkey','316005cb62a918aeafd602e520bfb61c'),
 ('05_index','public.friendships_pkey','fc0d0963e4b4b243c775da58611d596b'),
 ('05_index','public.live_checkout_intents_pkey','f77404aa76a77b68b0f1a0a3cc47d2d9'),
 ('05_index','public.live_checkout_intents_user_id_session_id_key','e23ca9f119a382774a145a741181982c'),
 ('05_index','public.live_recordings_pkey','21c8b01d1f918de78506304599808e58'),
 ('05_index','public.live_recordings_session_idx','c26f1923d452b8ae1efea84851818de4'),
 ('05_index','public.live_recordings_trainer_idx','7975a6be1e423ee1614418a067c029c4'),
 ('05_index','public.live_room_access_checkout_unique','0b3cd245fc98f139957a26f7dbe7d4ed'),
 ('05_index','public.live_room_access_pkey','bfb95f8e60264ad80a0b122c38bd91fb'),
 ('05_index','public.live_room_access_session_id_user_id_key','957de153ba4ac858e726a066bd397d79'),
 ('05_index','public.live_sessions_pkey','07958514b25e495eef1a23d0cc6641ee'),
 ('05_index','public.meal_plans_pkey','58dd10329a906be94226ecb8ff62072e'),
 ('05_index','public.measured_break_per_day','6e4545a309a4c8ee0030bb9acaf5cd93'),
 ('05_index','public.menu_shares_pkey','1d7344c506c19ca4df54e142c89fa5d8'),
 ('05_index','public.messages_pkey','6b53efd50cc8ff468ff814f37374cc72'),
 ('05_index','public.payment_disputes_pkey','0c6402ca19554167f36f46b95125ddd9'),
 ('05_index','public.post_comments_pkey','3742e6d6df860727d41bd403102d3120'),
 ('05_index','public.post_likes_pkey','eb542c1d633545973b1076765eeaa272'),
 ('05_index','public.posts_pkey','3c3b4fdd419d742894dd28153bfd8314'),
 ('05_index','public.posts_trybe_created_idx','b43772c4ac11ae3a2f7d176206194992'),
 ('05_index','public.private_active_slot','25041956f77afcad22e55f07654b825f'),
 ('05_index','public.private_booking_hold_slot','8eb83b2c437425f92dce551b9e20a791'),
 ('05_index','public.private_booking_holds_pkey','41eca6256bbf4e47495bc329bbb1d813'),
 ('05_index','public.private_session_access_pkey','d8072f03f737d63ce9e09ff67f5f577e'),
 ('05_index','public.profiles_pkey','5dc98f273d31b723c4af70f492f95186'),
 ('05_index','public.push_reminders_due','5c7734d43e3d46db98592f41fed7b384'),
 ('05_index','public.push_reminders_pkey','12b2ee2b90c68efac65da47f5bb5ab36'),
 ('05_index','public.push_reminders_user_id_live_id_fire_at_key','a53c9318254d2f5a4307f82ff8f2a68e'),
 ('05_index','public.push_subscriptions_pkey','15bd4c00c6cf8d1250383f851397c027'),
 ('05_index','public.recording_start_locks_pkey','28ae1f2c32b2e8f1acfc50d1ef632996'),
 ('05_index','public.refund_jobs_pkey','fcd14944b7cb7483cc022c0360c387f0'),
 ('05_index','public.reviews_pkey','2fb327fc0888e7e9c467b5bf6efed666'),
 ('05_index','public.room_shutdown_jobs_pkey','3e2f6000660b3d36d8b74f95d270e931'),
 ('05_index','public.trainer_accounts_pkey','debc626963c7b3172ac92fb2519ca118'),
 ('05_index','public.trainer_accounts_slug_key','7ad756f0e80586ed9baa5f19fd797c9f'),
 ('05_index','public.trainer_busy_day_idx','333c998aaec8932b9120059f1c9ea4dd'),
 ('05_index','public.trainer_busy_pkey','cc7f053fd948f3f2e72cd4d0054a5e4b'),
 ('05_index','public.trainer_earnings_pkey','edabc34ed42ee786d7c0b80f05590816'),
 ('05_index','public.trainer_earnings_ref_key','08dd1d8eb1fdf52cd3331ca305383b6d'),
 ('05_index','public.trainer_program_workouts_pkey','193011e75d962d93528570c7924b636d'),
 ('05_index','public.trainer_program_workouts_program_id_position_key','5f6fb14afdeb7cff2288d9b58e21fcc9'),
 ('05_index','public.trainer_programs_pkey','af3d6aec71d13d57d08b8c964ff1edad'),
 ('05_index','public.trainer_store_items_owner_idx','12d21ede36e52fd45d760da11e4b18ff'),
 ('05_index','public.trainer_store_items_pkey','b236d4b39a94f229a235c5de4b2838d9'),
 ('05_index','public.trainer_videos_pkey','f000b7a3f49056c6515f4ab261dea855'),
 ('05_index','public.trybe_memberships_pkey','d4234fb9a6d0ef5ac87135e5b38e1bd2'),
 ('05_index','public.trybe_memberships_user_id_idx','a44a0b1e31680246b5d9a47677ab8926'),
 ('05_index','public.trybes_one_per_owner','5a42dfebe6fa3748c2b1aa1e0b6ef654'),
 ('05_index','public.trybes_pkey','9236a7bd0709dee5c1ebedaa12386ac6'),
 ('05_index','public.user_roles_pkey','5af3d6c21e4423aa7ce0fc1e5faa22bc'),
 ('05_index','public.user_roles_user_id_role_key','e75c1b66d85c266dacf923fc96a59eab'),
 ('05_index','public.video_uploads_pkey','a6009bb9a753bebc437569e4576f803a'),
 ('05_index','public.waitlist_entries_email_key','605b02828e4176e7767ae2ecabbc0c02'),
 ('05_index','public.waitlist_entries_pkey','208122d4bf2096cff55cb36211ff9a19'),
 ('05_index','public.wallet_redemptions_pkey','83ca9a276678a3effca55084d31c7535'),
 ('05_index','public.wallet_token_lots_pkey','8dda743e007be7104ff9b6c44ccb98d9'),
 ('05_index','public.wallet_token_units_pkey','d652a49c3dc8c6d1df302fbcf37a74b6'),
 ('05_index','public.water_break_campaigns_pkey','56f01189f871d1622a57169e1b855e2c'),
 ('05_index','public.water_break_events_pkey','6ecef8ff2e1440d890af0a3269946eaf'),
 ('05_index','public.water_break_impressions_campaign_id_video_id_playback_id_br_key','b1e3280621c8ceb9f71481651a30ee6f'),
 ('05_index','public.water_break_impressions_pkey','4b3e5b776c822a465fd9b32dcb80322f'),
 ('05_index','public.youth_consents_pkey','1fcdc8029c5e89deb10a6467e6cbec97'),
 ('05_index','public.youth_consents_user_id_key','021679fbf8a90fc5a9c80f30814fe715'),
 ('06_policy','public.certifications."admin update"','46368158041a9f5747d7274b921226a5'),
 ('06_policy','public.certifications."own insert pending"','8d78801fb348d7fc568187ad0aed17b7'),
 ('06_policy','public.certifications."own or admin read"','f6f156dc8c87c6d26e6b21ddb9ebba17'),
 ('06_policy','public.certifications.credential_delete_guard','d8375a5bed43d129a2d0385390adf2f4'),
 ('06_policy','public.certifications.credential_read_guard','da97f2a48d4a19692c59ccb83566ca9b'),
 ('06_policy','public.certifications.credential_review_guard','cc59d5543b3cb6a7a8ffd75542a4adc6'),
 ('06_policy','public.comments."Members can delete their own comments"','e867ddc6ca0b0e0060fbe4c616773b48'),
 ('06_policy','public.comments."Members can edit their own comments"','98cbc813fa3ec3a2b9a79a9767ffe2fc'),
 ('06_policy','public.comments."Trybe leaders can moderate comments"','83ba1c18bee9dff0bdf8be8c9c6d7b77'),
 ('06_policy','public.comments."Trybe members can read comments"','447c141929d4f9229d5ac93552630cbb'),
 ('06_policy','public.comments."Trybe members can write comments"','df650d5cc96810d173b29b99cf35749c'),
 ('06_policy','public.credential_reviews.credential_review_read','8d4d3d4e0bb16aa1e8f944bf7c4a82ad'),
 ('06_policy','public.friend_requests."Decline or cancel friend requests"','9b69bc5751d6c56185ec4ba899ce3bf2'),
 ('06_policy','public.friend_requests."Read own friend requests"','ac6d229eb00b7cb2679d9681ac609509'),
 ('06_policy','public.friend_requests."Send friend requests"','09f30a05ad28fe56369719c53a9dd7cc'),
 ('06_policy','public.friendships."Users can add own friendships"','10afc6807111cee7c8c2b2f22fe56792'),
 ('06_policy','public.friendships."Users can update own friendships"','29483ae6a324e5091310a73348b597a6'),
 ('06_policy','public.friendships."Users can view own friendships"','c49b2bd3afb8207d1d0aba1578366053'),
 ('06_policy','public.live_recordings."trainer can read own recording metadata"','aa6ab908afc96cc3e223625c6d416360'),
 ('06_policy','public.live_recordings.recording_admin_read','8e84577c06ea568d1f61009b1cf000c0'),
 ('06_policy','public.live_room_access."Members can see own room access"','c49b2bd3afb8207d1d0aba1578366053'),
 ('06_policy','public.live_room_access.class_host_registrations','b441478c59bc45a8a761084b8886c9cb'),
 ('06_policy','public.live_sessions.eligible_live_public','4f8894f76bd26dc71f62ee4b9fac3b13'),
 ('06_policy','public.live_sessions.trainer_live_insert_owned','a527de2000740c0b9fe0f008a93542fb'),
 ('06_policy','public.live_sessions.trainer_live_update_owned','379fcde90ae447a7c2b630d8043cf8ad'),
 ('06_policy','public.messages."Accepted friends can message"','d7b871e93983a336d3f410ff3d77a8fb'),
 ('06_policy','public.messages."Message participants can read"','a67757812d7dd7ca6c84add387f32b5a'),
 ('06_policy','public.messages."Trainer inquiries may be sent without friendship"','a56adf2a0d09cd4c09d0a20209a233bc'),
 ('06_policy','public.post_comments.comments_member_insert','2133698cca56fba9cfcac1615e25e877'),
 ('06_policy','public.post_comments.comments_member_read','62b305a34ea85a69f8fd06121c29d111'),
 ('06_policy','public.post_comments.comments_owner_delete','c6808202a02cbbc077c7cedb0720655c'),
 ('06_policy','public.post_likes.likes_member_insert','0cf9e013d8eae2a6c81665034d49fe6d'),
 ('06_policy','public.post_likes.likes_member_read','a96704c794e6eac4c4611ccdf7fbb767'),
 ('06_policy','public.post_likes.likes_owner_delete','105ba614252ab603cc9f3c5b3ceaaa6e'),
 ('06_policy','public.posts."Public official announcements"','c1eb4a68b44cf791fe5c9e2cf15ae356'),
 ('06_policy','public.posts.posts_author_insert','f2e2dad3cf5ef2c4de6a9edaa96b519b'),
 ('06_policy','public.posts.posts_leader_visibility','36ad86ec8786bfb8e65af06a9a57006f'),
 ('06_policy','public.posts.posts_owner_delete','c6808202a02cbbc077c7cedb0720655c'),
 ('06_policy','public.posts.posts_visible','3d72bed28ec234ce6a4bac4ce50b35ac'),
 ('06_policy','public.private_session_access.private_session_participant_read','f6129f6c6fc0549605273c024d8673a7'),
 ('06_policy','public.profiles.profile_read_guard','efb61cca7e074c7ed5a4565f23484979'),
 ('06_policy','public.profiles.profiles_insert_own','f3a6a7d76601779cbea3bfd62bd35bab'),
 ('06_policy','public.profiles.profiles_select_own','1eddfbeb99f1794939b76a3bd1f76ac6'),
 ('06_policy','public.profiles.profiles_update_own','a3e19cd7e3500a5f556665779acb1990'),
 ('06_policy','public.trainer_busy.busy_authenticated_read','88e17ae3934c41bb82de231c252f6276'),
 ('06_policy','public.trainer_busy.busy_owner_delete','17eac8fbb2e473ea8a3738f64bda1603'),
 ('06_policy','public.trainer_busy.busy_owner_insert','bb433738de7bc1bd8e9d725f7fdf3a9e'),
 ('06_policy','public.trainer_busy.busy_owner_update','c336fc76c946c08b86b4163dea82b7b0'),
 ('06_policy','public.trainer_program_workouts."program workouts delete"','7ed14177705c38946d741b3ccf6724c1'),
 ('06_policy','public.trainer_program_workouts."program workouts read"','aca3586c8ef22cca36cc78b37bf5b0dc'),
 ('06_policy','public.trainer_program_workouts.program_workouts_owner_insert','2b54ae183df88dbda42cc0baeea0084b'),
 ('06_policy','public.trainer_program_workouts.program_workouts_owner_update','7a3229c974d2f78a15ec35dd50284efc'),
 ('06_policy','public.trainer_programs."programs owner delete"','e8a959c015f87e0ceeaeb8869f9b9abc'),
 ('06_policy','public.trainer_programs."programs owner insert"','3029090877e5eae0d08bbcc24867e5c4'),
 ('06_policy','public.trainer_programs."programs owner read"','aa6ab908afc96cc3e223625c6d416360'),
 ('06_policy','public.trainer_programs."programs owner update"','379fcde90ae447a7c2b630d8043cf8ad'),
 ('06_policy','public.trainer_programs."programs public"','d27d3b52d9edb5894039394929a22635'),
 ('06_policy','public.trainer_store_items."store owner delete"','e8a959c015f87e0ceeaeb8869f9b9abc'),
 ('06_policy','public.trainer_store_items."store owner insert"','3029090877e5eae0d08bbcc24867e5c4'),
 ('06_policy','public.trainer_store_items."store owner read"','aa6ab908afc96cc3e223625c6d416360'),
 ('06_policy','public.trainer_store_items."store owner update"','379fcde90ae447a7c2b630d8043cf8ad'),
 ('06_policy','public.trainer_store_items."store public published"','d27d3b52d9edb5894039394929a22635'),
 ('06_policy','public.trainer_videos."admins read all videos"','8e84577c06ea568d1f61009b1cf000c0'),
 ('06_policy','public.trainer_videos."own delete"','105ba614252ab603cc9f3c5b3ceaaa6e'),
 ('06_policy','public.trainer_videos."own insert"','a8e637d1b36537245224d95080241c08'),
 ('06_policy','public.trainer_videos."public read approved videos"','a1dd97df9e361522607b930f9af0c5d1'),
 ('06_policy','public.trainer_videos."trainers read own videos"','1e068adc6cc3e64c8fccc44ba07c5196'),
 ('06_policy','public.trainer_videos.video_read_guard','116078f0ce911cb2936ecd61d6317ac7'),
 ('06_policy','public.trainer_videos.videos_owner_update','f3f6bfc539586fee8b38bb69367e723b'),
 ('06_policy','public.trybe_memberships."Members can join Trybes"','70e9348433694690a90f437e11f1bccb'),
 ('06_policy','public.trybe_memberships."Members can leave Trybes"','0e9a5501d4e98db235f07831c78d1149'),
 ('06_policy','public.trybe_memberships.trybe_memberships_own_delete','105ba614252ab603cc9f3c5b3ceaaa6e'),
 ('06_policy','public.trybe_memberships.trybe_memberships_own_insert','6e42c409191c7fdd9e49d59e829892c5'),
 ('06_policy','public.trybe_memberships.trybe_memberships_own_select','1e068adc6cc3e64c8fccc44ba07c5196'),
 ('06_policy','public.trybe_memberships.trybe_memberships_read_self','c49b2bd3afb8207d1d0aba1578366053'),
 ('06_policy','public.trybes."Anyone can discover Trybes"','1fdfb68c4f48648108951ae916e16390'),
 ('06_policy','public.trybes."Members can create their own Trybe"','8dce8e7a49006357080f2b42f9acf280'),
 ('06_policy','public.user_roles."own roles"','c49b2bd3afb8207d1d0aba1578366053'),
 ('06_policy','public.waitlist_entries.waitlist_signup_public','b0ea04c25b2f401dab97067dabd7a084'),
 ('06_policy','public.wallet_redemptions.redemption_owner_read','1e068adc6cc3e64c8fccc44ba07c5196'),
 ('06_policy','public.wallet_token_lots.wallet_owner_read','1e068adc6cc3e64c8fccc44ba07c5196'),
 ('06_policy','public.wallet_token_units.wallet_unit_owner_read','71d3fc4d5bad190bab4de758def91c65'),
 ('06_policy','public.water_break_campaigns."active campaign public"','780bbae739dbd4793fd85ac91e26ea22'),
 ('06_policy','storage.objects."store photos public"','da1f0b00a36bfcced1214a56dfd417e0'),
 ('06_policy','storage.objects."trainer deletes own photo"','d50ca710799659f6d06b29756437d9de'),
 ('06_policy','storage.objects."trainer replaces own photo"','9c2e7b7719abee89fc9f25fb3224d000'),
 ('06_policy','storage.objects."trainer uploads own photo"','070eaa798844167ab49f3c67b12707c4'),
 ('06_policy','storage.objects.certificate_delete_guard','92652ddea25921a95e3a12959c5f5cdd'),
 ('06_policy','storage.objects.certificate_insert_guard','013cb02ca528bac1a54447d73db8328b'),
 ('06_policy','storage.objects.certificate_orphan_delete','78bd958e3f05bac2848fa9b048a2d4af'),
 ('06_policy','storage.objects.certificate_own_insert','896a21f937764815a412c3869d377ae8'),
 ('06_policy','storage.objects.certificate_private_read','843e8315034a9341cfb1b8f8462f2e7b'),
 ('06_policy','storage.objects.certificate_read_guard','61f7364fff896bd4c22a9684dc9d6cfd'),
 ('06_policy','storage.objects.certificate_update_guard','a7e2ba56457af26b00991511ea823794'),
 ('07_trigger','public.certifications.credential_guard','5888f848129c7f1e857a5d7da17a1b63'),
 ('07_trigger','public.live_sessions.cancellation_refunds','d775c8f9d36880bfe363951361ad5f89'),
 ('07_trigger','public.live_sessions.canonical_class_trainer','c5d1bf5c046160e73839084af838a0bc'),
 ('07_trigger','public.live_sessions.class_calendar','5c5b057dd0c14fd4207daf3e1119f6f6'),
 ('07_trigger','public.live_sessions.class_status','d2e5201d124ab32e1a57a43e9dd5708a'),
 ('07_trigger','public.live_sessions.live_trainer_eligibility','f309e0ded8b1f127099d132924a8f015'),
 ('07_trigger','public.live_sessions.protect_class_calendar','b260dc1a8e482bcee680679ebd9bb8c9'),
 ('07_trigger','public.live_sessions.room_shutdown','2888eb1c5d5d28bc2dcedb2d9f103aee'),
 ('07_trigger','public.post_comments.canonical_comment_author','c712bb1d5a8157d9c553c6c22d2d3fcc'),
 ('07_trigger','public.posts.guard_official_posts','9ca0e974673cee364443a09ed2bee70a'),
 ('07_trigger','public.posts.trybe_post_guard','e557c3deab59a8f48357446336eb731d'),
 ('07_trigger','public.profiles.profile_financial_guard','55886675f0705f3f0b3e3cd011b60a00'),
 ('07_trigger','public.profiles.profile_identity_guard','a9245566ede4c994fff4702330189bb8'),
 ('07_trigger','public.trainer_videos.workout_guard','bde6a6a73c930ca2195d40fac098b6f4'),
 ('08_routine','public.accept_friend_request(p_requester_id uuid)','c475cd08a876826cdd0c232521dedf11'),
 ('08_routine','public.apply_checkout_refund(p_checkout_id text, p_refund_cents integer, p_fully_refunded boolean)','50a5808cfbf28848887d68686d5a59c0'),
 ('08_routine','public.apply_paid_live_checkout(p_checkout_id text, p_user_id uuid, p_session_id uuid, p_gross_cents integer, p_fee_cents integer)','8dec2e4f2dcaae1e3d24c2df242b5880'),
 ('08_routine','public.apply_paid_private_booking(p_checkout_id text, p_user_id uuid, p_trainer_id text, p_day text, p_time text, p_gross_cents integer, p_fee_cents integer, p_trainer_cents integer, p_hold_id uuid)','40e9227d39ed145e89f5e34153017fa7'),
 ('08_routine','public.apply_paid_token_checkout(p_checkout_id text, p_user_id uuid, p_tokens integer, p_gross_cents integer, p_fee_cents integer)','eda16491c6ee26e5e357f3dd3af98c21'),
 ('08_routine','public.apply_payment_dispute(p_id text, p_checkout_id text, p_status text)','5ba66f956c024655b8bb395b409b8424'),
 ('08_routine','public.apply_verified_ad_settlement(p_network text, p_network_event_id text, p_video_id uuid, p_trainer_id uuid, p_break_second integer, p_gross_cents integer, p_fee_cents integer, p_trainer_cents integer)','2bc6ed2bad0d5a6e0e81922f16f76acc'),
 ('08_routine','public.can_edit_menu(_client uuid)','7fe0dd352279fd0464c5c92813a3a428'),
 ('08_routine','public.can_message_friend(p_recipient_id uuid)','fd6cb6d3f395410adf3e02303397d80d'),
 ('08_routine','public.can_see_trybe(_trybe text)','b170cd42493cb121c4f4fe3b7b83117d'),
 ('08_routine','public.cancel_private_session(p_checkout_id text, p_user_id uuid)','c3862612bedef3ff970b454ad1add898'),
 ('08_routine','public.canonical_class_trainer()','efb56e6ed06774085f98ad28703c3f67'),
 ('08_routine','public.canonical_comment_author()','f684c1a85f1c97c8877e2b853991f2d5'),
 ('08_routine','public.check_trainer_live_eligibility()','e4591b13322cc6fee3c14106973326b2'),
 ('08_routine','public.claim_earning_operation(p_id uuid)','d1193482307c825b76c2f983784289c5'),
 ('08_routine','public.claim_recording_import(p_egress_id text)','800366c18fc59d8d1a3966bed3c1f58d'),
 ('08_routine','public.finish_earning_operation(p_id uuid, p_key text, p_provider_id text)','6a9be30755437ed0b0206ca6448fd1a1'),
 ('08_routine','public.get_live_checkout_intent(p_user_id uuid, p_session_id uuid)','47c1e39abaf3cf2cfac2f4cb662a9d46'),
 ('08_routine','public.guard_class_status()','043a6076d2bf03f81ad0bf170250772b'),
 ('08_routine','public.guard_credential()','9b39a97f0a26e2c3cb16b8c66f7edb2c'),
 ('08_routine','public.guard_official_posts()','db1c75c0f3a3437f74d42ce40c875389'),
 ('08_routine','public.guard_profile_identity()','00af86d795ec16c3ae1302c0b82be909'),
 ('08_routine','public.guard_trybe_post()','6c771efca44678ebefc5684b0f417210'),
 ('08_routine','public.guard_workout()','0912b4f6afa28ef780e872b086f695f3'),
 ('08_routine','public.handle_new_user()','6cf8b41b39b3181b9d51e94146dd6ee7'),
 ('08_routine','public.has_role(_user_id uuid, _role app_role)','fabcbff17e14178250d876c2576fe9ac'),
 ('08_routine','public.hold_private_booking(p_trainer_id uuid, p_member_id uuid, p_day date, p_time text)','40280eed23a7b246d31a51c30e0f56d6'),
 ('08_routine','public.joinable_trybe(p_id text)','0faecb6541cbeae6979acdf61994dcc2'),
 ('08_routine','public.moderate_trybe_post(p_post_id uuid, p_action text, p_value boolean)','88248f349930585c7f6ac11b54e5a000'),
 ('08_routine','public.protect_class_calendar()','8386fcd7a86e196db8f4158a9be9aec1'),
 ('08_routine','public.protect_profile_finances()','2db29edbe560015bcbfecadf24fed309'),
 ('08_routine','public.publish_official_announcement(p_body text)','13af5e316150e168a523d4d422f33fdd'),
 ('08_routine','public.queue_cancelled_class_refunds()','f95db5a10c0956536e65a4c162e0a3ed'),
 ('08_routine','public.queue_room_shutdown()','0d8ff9f848caa02e757e0f53f95b4b24'),
 ('08_routine','public.record_class_calendar()','06286ff72cc482226db8a4e6ed1e198b'),
 ('08_routine','public.record_water_break_impression(p_campaign_id uuid, p_video_id uuid, p_break_second integer, p_playback_id uuid, p_viewer_id uuid)','3bf9202da2869ae5acb4d7ba889762cd'),
 ('08_routine','public.redeem_paid_live_token(p_user_id uuid, p_session_id uuid)','e6331316edd96073daaaebb053fbdc4e'),
 ('08_routine','public.release_private_hold(p_id uuid, p_member_id uuid)','de92c6002a57cf3e5a7870af02baa29b'),
 ('08_routine','public.reorder_program_workouts(p_program_id uuid, p_video_ids uuid[])','c89f50fe0a2dc2bb975df7fee55ac205'),
 ('08_routine','public.reserve_class_recording(p_session_id uuid)','ece2912b85e37010cbbb4bf2c951f3b6'),
 ('08_routine','public.restore_won_disputes()','f1785953905690eff621a988f26a57a8'),
 ('08_routine','public.review_trainer_video(p_video_id uuid, p_status text, p_note text)','25718b7be99de6b131780611f574756d'),
 ('08_routine','public.rls_auto_enable()','cd95555b36d9b6b30898cb7304a42fe8'),
 ('08_routine','public.save_program_workouts(p_program_id uuid, p_video_ids uuid[])','3e8cfca71bdf98f80b6d8abcbdbda202'),
 ('08_routine','public.sync_wallet_balance(p_user_id uuid)','5e20af9f82b7dfa66b4414baf1238d1d'),
 ('08_routine','public.trainer_attendance_count(p_trainer_id uuid)','0c19258815d14785be4c0edd5c25d9c1'),
 ('08_routine','public.trainer_is_eligible(p_user_id uuid, p_live boolean)','aca2d00263892215bd0ffb617f6bfa60'),
 ('08_routine','public.unfriend_user(p_friend_id uuid)','68e190621c52f30a885e35cfaacc5ca3'),
 ('08_routine','public.valid_iso_date(p_value text)','a3ae26bddff0d939254298b75df8ab5e'))
 SELECT coalesce(a.section,e.section)||':'||coalesce(a.object_name,e.object_name) INTO changed
 FROM actual a FULL JOIN expected e USING(section,object_name) WHERE a.hash IS DISTINCT FROM e.hash LIMIT 1;
 IF changed IS NOT NULL THEN RAISE EXCEPTION 'Inspected schema changed: %. Reinspect/reconcile; transaction aborted.',changed; END IF;
END $snapshot$;
DO $data$ DECLARE c record; BEGIN
 FOR c IN SELECT 'unsupported_private_status' AS check_name,count(*) AS failures
 FROM public.private_session_access WHERE status NOT IN ('paid','refunded','cancelled')
UNION ALL SELECT 'duplicate_active_private_slots',count(*) FROM (
 SELECT trainer_id,day,time FROM public.private_session_access WHERE status='paid'
 GROUP BY trainer_id,day,time HAVING count(*)>1) duplicates
UNION ALL SELECT 'orphan_video_reviewers',count(*) FROM public.trainer_videos v
 WHERE v.reviewed_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v.reviewed_by)
UNION ALL SELECT 'orphan_friend_request_accounts',count(*) FROM public.friend_requests r
 WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=r.requester_id)
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=r.recipient_id)
UNION ALL SELECT 'self_friend_requests',count(*) FROM public.friend_requests WHERE requester_id=recipient_id
UNION ALL SELECT 'wallet_unit_count_mismatch',count(*) FROM public.wallet_token_lots l
 WHERE l.purchased<>(SELECT count(*) FROM public.wallet_token_units u WHERE u.lot_id=l.id)
UNION ALL SELECT 'wallet_remaining_mismatch',count(*) FROM public.wallet_token_lots l
 WHERE l.remaining<>(SELECT count(*) FROM public.wallet_token_units u WHERE u.lot_id=l.id AND u.state='available')
ORDER BY check_name LOOP
  IF c.failures<>0 THEN RAISE EXCEPTION 'Data preflight failed: % (% rows). Review, never delete records to proceed.',c.check_name,c.failures; END IF;
 END LOOP;
END $data$;
-- Preserve every preexisting application's row, including all financial ledgers.
-- Capture only counts, column names and aggregate checksums in session-local temp
-- objects; no business records are exported. New columns are excluded afterward.
CREATE TEMP TABLE launch_preservation(relation_name text PRIMARY KEY,columns text[],row_count bigint,checksum text) ON COMMIT DROP;
DO $before$ DECLARE r record; cols text[]; n bigint; digest text; BEGIN
 FOR r IN SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname LOOP
  EXECUTE format('LOCK TABLE public.%I IN SHARE MODE',r.relname);
  SELECT array_agg(a.attname::text ORDER BY a.attnum) INTO cols FROM pg_catalog.pg_attribute a WHERE a.attrelid=format('public.%I',r.relname)::regclass AND a.attnum>0 AND NOT a.attisdropped;
  EXECUTE format($digest$SELECT count(*),md5(coalesce(string_agg(h,'' ORDER BY h),'')) FROM (SELECT md5(to_jsonb(t)::text) h FROM public.%I t) d$digest$,r.relname) INTO n,digest;
  INSERT INTO launch_preservation VALUES(r.relname,cols,n,digest);
 END LOOP;
END $before$;

-- REVIEWED SOURCE: 0051_safety_and_messaging.sql ORIGINAL SHA256 ceaf593eac7a4246a6285f3b1300e879498191baf374eac30b9b0c7561006280
-- Additive launch backend. No hosted SQL is executed by this file's generation.
CREATE TABLE IF NOT EXISTS public.account_restrictions (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id), scope text NOT NULL CHECK(scope IN ('content','suspended')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000), admin_id uuid NOT NULL REFERENCES auth.users(id),
 active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.moderation_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL,target_type text NOT NULL,target_id text NOT NULL,
 action text NOT NULL,note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved')),created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION public.account_can_act(p_id uuid,p_content boolean DEFAULT true)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM account_restrictions WHERE user_id=p_id AND active AND (p_content OR scope='suspended'))
$$;
CREATE TABLE IF NOT EXISTS public.audience_announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 4000),
 audience text NOT NULL CHECK(audience IN ('trainers','members')),author_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS official boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.publish_targeted_announcement(p_body text,p_audience text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 INSERT INTO audience_announcements(body,audience,author_id) VALUES(trim(p_body),p_audience,auth.uid()) RETURNING id INTO result;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'announcement',result::text,'publish');
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.publish_official_announcement(p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 INSERT INTO posts(author_id,author_name,trybe,kind,text,visibility,official)
 VALUES(auth.uid(),'Tryumph Gym','official','Announcement',trim(p_body),'public',true) RETURNING id INTO result;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'post',result::text,'official_publish');
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.protect_official_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.official OR NEW.trybe='official' THEN
  IF current_setting('role',true)='authenticated' AND NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Official authorship is reserved'; END IF;
  IF NOT NEW.official OR NEW.trybe<>'official' THEN RAISE EXCEPTION 'Invalid official post'; END IF;
  NEW.author_name='Tryumph Gym';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_official_post ON posts;
CREATE TRIGGER zz_official_post BEFORE INSERT OR UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION protect_official_post();
-- Official publishing is an admin RPC; ordinary author rules still apply to all other posts.
DROP POLICY IF EXISTS official_post_insert ON posts;
CREATE POLICY official_post_insert ON posts FOR INSERT TO authenticated WITH CHECK(official AND trybe='official' AND has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.message_controls (
 user_id uuid NOT NULL REFERENCES auth.users(id),other_id uuid NOT NULL REFERENCES auth.users(id),blocked boolean NOT NULL DEFAULT false,
 muted boolean NOT NULL DEFAULT false,read_at timestamptz,PRIMARY KEY(user_id,other_id),CHECK(user_id<>other_id));
CREATE OR REPLACE FUNCTION public.can_send_message(p_sender uuid,p_recipient uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_sender=auth.uid() AND p_sender<>p_recipient AND account_can_act(p_sender)
 AND account_can_act(p_recipient,false) AND NOT EXISTS(SELECT 1 FROM message_controls WHERE blocked AND
  ((user_id=p_sender AND other_id=p_recipient) OR (user_id=p_recipient AND other_id=p_sender)))
 AND (EXISTS(SELECT 1 FROM friendships WHERE user_id=p_sender AND friend_id=p_recipient AND partner)
  OR trainer_is_eligible(p_recipient,false)
  OR (EXISTS(SELECT 1 FROM profiles WHERE id=p_sender AND role='trainer') AND
      EXISTS(SELECT 1 FROM messages WHERE sender_id=p_recipient AND recipient_id=p_sender)))
$$;
-- Keep existing friend policy and any reviewed inquiry policy. This restrictive guard also
-- constrains a manually installed permissive policy; its existence is shown in preflight.
DROP POLICY IF EXISTS launch_message_permission ON messages;
CREATE POLICY launch_message_permission ON messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(can_send_message(sender_id,recipient_id));
DROP POLICY IF EXISTS launch_trainer_inquiries ON messages;
CREATE POLICY launch_trainer_inquiries ON messages FOR INSERT TO authenticated WITH CHECK(can_send_message(sender_id,recipient_id));
CREATE OR REPLACE FUNCTION public.guard_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('message:'||NEW.sender_id::text));
 IF current_setting('role',true)='authenticated' THEN
  IF NOT can_send_message(NEW.sender_id,NEW.recipient_id) THEN RAISE EXCEPTION 'Messaging unavailable'; END IF;
  IF (SELECT count(*) FROM messages WHERE sender_id=NEW.sender_id AND created_at>now()-interval '1 minute')>=10
   OR (SELECT count(*) FROM messages WHERE sender_id=NEW.sender_id AND created_at>now()-interval '1 day')>=200
  THEN RAISE EXCEPTION 'Message limit reached. Please try later.'; END IF;
 END IF;
 SELECT name INTO NEW.sender_name FROM profiles WHERE id=NEW.sender_id;
 NEW.created_at=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS launch_guard_message ON messages;
CREATE TRIGGER launch_guard_message BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION guard_message();
CREATE INDEX IF NOT EXISTS messages_sender_time ON messages(sender_id,created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_time ON messages(recipient_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.message_contact_names()
RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,p.name FROM profiles p WHERE EXISTS(SELECT 1 FROM messages m WHERE
 (m.sender_id=auth.uid() AND m.recipient_id=p.id) OR (m.recipient_id=auth.uid() AND m.sender_id=p.id))
$$;

CREATE TABLE IF NOT EXISTS public.content_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id uuid NOT NULL REFERENCES auth.users(id),
 target_type text NOT NULL CHECK(target_type IN ('user','trainer','post','comment','message')),target_id uuid NOT NULL,
 reason text NOT NULL CHECK(reason IN ('inappropriate_content','harassment','unsafe_fitness_advice','misrepresentation','spam','other')),
 details text NOT NULL DEFAULT '' CHECK(length(details)<=2000),evidence text,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
 review_note text,reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION public.guard_content_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.reporter_id<>auth.uid() OR NEW.status<>'open' OR NEW.review_note IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.evidence IS NOT NULL THEN RAISE EXCEPTION 'Invalid report'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('report:'||auth.uid()::text));
 IF (SELECT count(*) FROM content_reports WHERE reporter_id=auth.uid() AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Report limit reached'; END IF;
 IF NEW.target_type IN ('user','trainer') THEN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=NEW.target_id AND (NEW.target_type='user' OR role='trainer')) THEN RAISE EXCEPTION 'Unknown account'; END IF;
 ELSIF NEW.target_type='post' THEN
  SELECT text INTO NEW.evidence FROM posts WHERE id=NEW.target_id AND NOT is_hidden AND (visibility='public' OR can_see_trybe(trybe) OR trybe='coach-'||auth.uid()::text);
 ELSIF NEW.target_type='comment' THEN
  SELECT c.text INTO NEW.evidence FROM post_comments c JOIN posts p ON p.id=c.post_id WHERE c.id=NEW.target_id AND can_see_trybe(p.trybe);
 ELSE
  SELECT text INTO NEW.evidence FROM messages WHERE id=NEW.target_id AND auth.uid() IN(sender_id,recipient_id);
 END IF;
 IF NEW.target_type IN ('post','comment','message') AND NEW.evidence IS NULL THEN RAISE EXCEPTION 'Cannot report inaccessible content'; END IF;
 NEW.created_at=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS launch_guard_report ON content_reports;
CREATE TRIGGER launch_guard_report BEFORE INSERT ON content_reports FOR EACH ROW EXECUTE FUNCTION guard_content_report();
CREATE OR REPLACE FUNCTION public.review_content_report(p_id uuid,p_status text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR p_status NOT IN ('reviewing','resolved','dismissed') OR length(p_note)>2000 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 UPDATE content_reports SET status=p_status,review_note=p_note,reviewed_at=now() WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown report'; END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'report',p_id::text,p_status,p_note);
END $$;
CREATE OR REPLACE FUNCTION public.restrict_account(p_id uuid,p_scope text,p_active boolean,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR p_id=auth.uid() OR has_role(p_id,'admin') OR length(trim(p_reason)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Independent admin action and reason required'; END IF;
 INSERT INTO account_restrictions(user_id,scope,reason,admin_id,active) VALUES(p_id,p_scope,trim(p_reason),auth.uid(),p_active)
 ON CONFLICT(user_id) DO UPDATE SET scope=excluded.scope,reason=excluded.reason,admin_id=auth.uid(),active=p_active,updated_at=now();
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'user',p_id::text,CASE WHEN p_active THEN p_scope ELSE 'restore' END,p_reason);
END $$;
CREATE OR REPLACE FUNCTION public.moderate_trybe_post(p_post_id uuid,p_action text,p_value boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE group_id text;
BEGIN
 SELECT trybe INTO group_id FROM posts WHERE id=p_post_id FOR UPDATE;
 IF group_id IS NULL OR NOT (group_id='coach-'||auth.uid()::text OR has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Only leader or admin'; END IF;
 IF p_action='pin' THEN UPDATE posts SET is_pinned=p_value WHERE id=p_post_id;
 ELSIF p_action='hide' THEN UPDATE posts SET is_hidden=p_value WHERE id=p_post_id;
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action) VALUES(auth.uid(),'post',p_post_id::text,p_action||':'||p_value::text);
END $$;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS comment_visibility_guard ON post_comments;
CREATE POLICY comment_visibility_guard ON post_comments AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT is_hidden OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS admin_comments_read ON post_comments;
CREATE POLICY admin_comments_read ON post_comments FOR SELECT TO authenticated USING(has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS admin_profiles_read ON profiles;
-- Profile moderation uses an allowlisted RPC below, not broad access to wellness/finance JSON.
CREATE OR REPLACE FUNCTION public.moderate_comment(p_id uuid,p_hidden boolean,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR length(trim(p_note)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Admin and reason required'; END IF;
 UPDATE post_comments SET is_hidden=p_hidden WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown comment'; END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'comment',p_id::text,'hide:'||p_hidden::text,p_note);
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['account_restrictions','moderation_actions','moderation_appeals','audience_announcements','message_controls','content_reports'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
GRANT SELECT ON account_restrictions,moderation_actions,moderation_appeals,audience_announcements,message_controls,content_reports TO authenticated;
GRANT INSERT ON moderation_appeals,content_reports,message_controls TO authenticated;
GRANT UPDATE(blocked,muted,read_at) ON message_controls TO authenticated;
DROP POLICY IF EXISTS restriction_read ON account_restrictions;
CREATE POLICY restriction_read ON account_restrictions FOR SELECT TO authenticated USING(user_id=auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS moderation_admin_read ON moderation_actions;
CREATE POLICY moderation_admin_read ON moderation_actions FOR SELECT TO authenticated USING(has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS appeal_read ON moderation_appeals;
CREATE POLICY appeal_read ON moderation_appeals FOR SELECT TO authenticated USING(user_id=auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS appeal_insert ON moderation_appeals;
CREATE POLICY appeal_insert ON moderation_appeals FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND status='open');
DROP POLICY IF EXISTS audience_read ON audience_announcements;
CREATE POLICY audience_read ON audience_announcements FOR SELECT TO authenticated USING(has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role=CASE WHEN audience='trainers' THEN 'trainer' ELSE 'member' END));
DROP POLICY IF EXISTS control_own ON message_controls;
CREATE POLICY control_own ON message_controls FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS report_read ON content_reports;
CREATE POLICY report_read ON content_reports FOR SELECT TO authenticated USING(has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS report_insert ON content_reports;
CREATE POLICY report_insert ON content_reports FOR INSERT TO authenticated WITH CHECK(reporter_id=auth.uid());
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['posts','post_comments','post_likes','trainer_videos','live_sessions'] LOOP
 EXECUTE format('DROP POLICY IF EXISTS launch_account_insert ON public.%I',t);
 EXECUTE format('CREATE POLICY launch_account_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.account_can_act(auth.uid()))',t);
 EXECUTE format('DROP POLICY IF EXISTS launch_account_update ON public.%I',t);
 EXECUTE format('CREATE POLICY launch_account_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.account_can_act(auth.uid())) WITH CHECK(public.account_can_act(auth.uid()))',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION account_can_act(uuid,boolean),can_send_message(uuid,uuid),message_contact_names(),publish_targeted_announcement(text,text),publish_official_announcement(text),review_content_report(uuid,text,text),restrict_account(uuid,text,boolean,text),moderate_comment(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION account_can_act(uuid,boolean) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION can_send_message(uuid,uuid),message_contact_names(),publish_targeted_announcement(text,text),publish_official_announcement(text),review_content_report(uuid,text,text),restrict_account(uuid,text,boolean,text),moderate_comment(uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_trybe_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF current_setting('role',true)='authenticated' THEN
  IF NEW.visibility='public' AND (TG_OP='INSERT' OR NEW.visibility IS DISTINCT FROM OLD.visibility) AND NOT (NEW.official AND NEW.trybe='official' AND public.has_role(auth.uid(),'admin')) AND NOT (NEW.trybe='coach-'||auth.uid()::text AND
    EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer')) THEN RAISE EXCEPTION 'Only leaders publish public posts'; END IF;
  IF TG_OP='INSERT' AND (NEW.is_hidden OR NEW.is_pinned) THEN RAISE EXCEPTION 'Moderation flags are server managed'; END IF;
  IF TG_OP='UPDATE' AND (NEW.trybe,NEW.author_id) IS DISTINCT FROM (OLD.trybe,OLD.author_id) THEN RAISE EXCEPTION 'Cannot reassign a post'; END IF;
  SELECT name INTO NEW.author_name FROM profiles WHERE id=NEW.author_id;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION review_moderation_appeal(p_id uuid,p_status text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR p_status NOT IN ('reviewing','resolved') OR length(trim(p_note)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Admin review and reason required'; END IF;
 UPDATE moderation_appeals SET status=p_status WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown appeal'; END IF;
 INSERT INTO moderation_actions(actor_id,target_type,target_id,action,note) VALUES(auth.uid(),'appeal',p_id::text,p_status,p_note);
END $$;
REVOKE ALL ON FUNCTION review_moderation_appeal(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION review_moderation_appeal(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_profile_directory()
RETURNS TABLE(id uuid,name text,role text,created_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 RETURN QUERY SELECT p.id,p.name,p.role,p.created_at FROM profiles p ORDER BY p.created_at DESC LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION admin_profile_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION admin_profile_directory() TO authenticated;
CREATE OR REPLACE FUNCTION guard_moderation_appeal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('appeal:'||auth.uid()::text));
 IF NEW.user_id<>auth.uid() OR NEW.status<>'open' OR (SELECT count(*) FROM moderation_appeals WHERE user_id=auth.uid() AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'Appeal unavailable or daily limit reached'; END IF;
 NEW.created_at=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS moderation_appeal_guard ON moderation_appeals;
CREATE TRIGGER moderation_appeal_guard BEFORE INSERT ON moderation_appeals FOR EACH ROW EXECUTE FUNCTION guard_moderation_appeal();
-- Privacy holds even if an older manual permissive SELECT policy remains.
DROP POLICY IF EXISTS message_participant_read_guard ON messages;
CREATE POLICY message_participant_read_guard ON messages AS RESTRICTIVE FOR SELECT TO authenticated
 USING(auth.uid() IN(sender_id,recipient_id));
DROP POLICY IF EXISTS report_admin_read_guard ON content_reports;
CREATE POLICY report_admin_read_guard ON content_reports AS RESTRICTIVE FOR SELECT TO authenticated
 USING(has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS announcement_audience_guard ON audience_announcements;
CREATE POLICY announcement_audience_guard ON audience_announcements AS RESTRICTIVE FOR SELECT TO authenticated
 USING(has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role=CASE WHEN audience='trainers' THEN 'trainer' ELSE 'member' END));


-- REVIEWED SOURCE: 0052_notifications_and_eligibility.sql ORIGINAL SHA256 0fca12ed7d82c1de213b35a573c019c04c399bd76a831a0088e43e2b08bd69a7
CREATE TABLE IF NOT EXISTS notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),session_updates boolean NOT NULL DEFAULT true,
 credential_updates boolean NOT NULL DEFAULT true,friend_activity boolean NOT NULL DEFAULT false,share_live_activity boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS account_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),event_key text NOT NULL,
 category text NOT NULL CHECK(category IN ('session','credential','friend','milestone','moderation')),body text NOT NULL,
 href text NOT NULL DEFAULT '/account',read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,event_key));
CREATE TABLE IF NOT EXISTS account_activity_days (
 user_id uuid NOT NULL REFERENCES auth.users(id),day date NOT NULL,time_zone text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS trainer_credential_requirements (
 trainer_id uuid NOT NULL REFERENCES auth.users(id),credential_name text NOT NULL,created_by uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(trainer_id,credential_name));
CREATE OR REPLACE FUNCTION notify_account(p_user uuid,p_key text,p_category text,p_body text,p_href text DEFAULT '/account')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_category='session' AND EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=p_user AND NOT session_updates)
 OR p_category='credential' AND EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=p_user AND NOT credential_updates)
 OR p_category='friend' AND NOT EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=p_user AND friend_activity) THEN RETURN; END IF;
 INSERT INTO account_notifications(user_id,event_key,category,body,href) VALUES(p_user,p_key,p_category,p_body,p_href) ON CONFLICT DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION record_account_activity(p_time_zone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE local_day date; days jsonb; n integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_time_zone) THEN RAISE EXCEPTION 'Valid signed-in time zone required'; END IF;
 local_day=(now() AT TIME ZONE p_time_zone)::date;
 PERFORM 1 FROM profiles WHERE id=auth.uid() FOR UPDATE;
 INSERT INTO account_activity_days(user_id,day,time_zone) VALUES(auth.uid(),local_day,p_time_zone) ON CONFLICT DO NOTHING;
 SELECT coalesce(jsonb_agg(d ORDER BY d),'[]') INTO days FROM (
  SELECT value #>> '{}' AS d FROM profiles p CROSS JOIN LATERAL jsonb_array_elements(p.active_days) WHERE p.id=auth.uid() AND valid_iso_date(value #>> '{}') AND (value #>> '{}')<=local_day::text
  UNION SELECT day::text FROM account_activity_days WHERE user_id=auth.uid()) existing;
 UPDATE profiles SET active_days=days WHERE id=auth.uid();
 n=jsonb_array_length(days);
 IF n=ANY(ARRAY[1,7,30,100,365,500,1000,2000]) THEN
  PERFORM notify_account(auth.uid(),'activity:'||n,'milestone',n||' distinct signed-in active days. These are visits, not completed workouts.');
 END IF;
 RETURN days;
END $$;
CREATE OR REPLACE FUNCTION protect_activity_days()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF current_user IN ('anon','authenticated') AND NEW.active_days IS DISTINCT FROM OLD.active_days THEN NEW.active_days=OLD.active_days; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS activity_days_guard ON profiles;
CREATE TRIGGER activity_days_guard BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_activity_days();

CREATE OR REPLACE FUNCTION trainer_is_eligible(p_user_id uuid,p_live boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT account_can_act(p_user_id) AND EXISTS(SELECT 1 FROM profiles WHERE id=p_user_id AND role='trainer')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified'
  AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id
  AND valid_iso_date(expires) AND expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AND name ~* '\m(CPR|cardiopulmonary resuscitation)\M')
 AND EXISTS(SELECT 1 FROM certifications WHERE user_id=p_user_id AND status='verified'
  AND verified_at IS NOT NULL AND verified_by IS NOT NULL AND verified_by<>user_id
  AND valid_iso_date(expires) AND expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AND name ~* '\m(AED|automated external defibrillator)\M')
 AND NOT EXISTS(SELECT 1 FROM trainer_credential_requirements r WHERE r.trainer_id=p_user_id AND NOT EXISTS(
  SELECT 1 FROM certifications c WHERE c.user_id=p_user_id AND lower(c.name)=lower(r.credential_name) AND c.status='verified'
   AND c.verified_at IS NOT NULL AND c.verified_by IS NOT NULL AND c.verified_by<>c.user_id
   AND valid_iso_date(c.expires) AND c.expires>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')))
 AND (NOT p_live OR (SELECT count(*) FROM trainer_videos WHERE user_id=p_user_id AND review_status='approved')>=5)
$$;
DROP POLICY IF EXISTS trainer_new_content_eligibility ON trainer_videos;
CREATE POLICY trainer_new_content_eligibility ON trainer_videos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(trainer_is_eligible(auth.uid(),false));
DROP POLICY IF EXISTS trainer_content_edit_eligibility ON trainer_videos;
CREATE POLICY trainer_content_edit_eligibility ON trainer_videos AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(has_role(auth.uid(),'admin') OR trainer_is_eligible(auth.uid(),false)) WITH CHECK(has_role(auth.uid(),'admin') OR trainer_is_eligible(auth.uid(),false));
DROP POLICY IF EXISTS trainer_post_eligibility ON posts;
CREATE POLICY trainer_post_eligibility ON posts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 has_role(auth.uid(),'admin') OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer') OR trainer_is_eligible(auth.uid(),false));
CREATE OR REPLACE FUNCTION generate_credential_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; stage integer; days_left integer;
BEGIN
 FOR c IN SELECT * FROM certifications WHERE status='verified' AND verified_at IS NOT NULL AND verified_by<>user_id AND valid_iso_date(expires)
 AND NOT EXISTS(SELECT 1 FROM certifications newer WHERE newer.user_id=certifications.user_id AND lower(newer.name)=lower(certifications.name)
  AND newer.status='verified' AND newer.verified_at IS NOT NULL AND newer.verified_by<>newer.user_id AND valid_iso_date(newer.expires) AND newer.expires>certifications.expires) LOOP
  days_left=c.expires::date-(now() AT TIME ZONE 'America/Chicago')::date;
  stage=CASE WHEN days_left<0 THEN 0 WHEN days_left<=7 THEN 7 WHEN days_left<=14 THEN 14 WHEN days_left<=30 THEN 30 WHEN days_left<=60 THEN 60 ELSE NULL END;
  IF stage IS NOT NULL THEN
   PERFORM notify_account(c.user_id,'credential:'||c.id||':'||stage,'credential',c.name||CASE WHEN stage=0 THEN ' has expired. Renew with verified evidence before new training activity.' ELSE ' expires on '||c.expires||'. Please renew before expiry.' END,'/studio');
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION notify_class_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid; event_id uuid := gen_random_uuid();
BEGIN
 IF (NEW.status,NEW.title,NEW.starts_at) IS DISTINCT FROM (OLD.status,OLD.title,OLD.starts_at) THEN
  FOR u IN SELECT user_id FROM live_room_access WHERE session_id=NEW.id AND status IN ('paid','pending','cancelled') LOOP
   PERFORM notify_account(u,'class:'||NEW.id||':'||event_id,'session',NEW.title||' · '||NEW.status||' · '||NEW.starts_at,'/live');
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_class_change ON live_sessions;
CREATE TRIGGER notify_class_change AFTER UPDATE ON live_sessions FOR EACH ROW EXECUTE FUNCTION notify_class_change();
CREATE OR REPLACE FUNCTION notify_friend_attendance(p_user uuid,p_session uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM notification_preferences WHERE user_id=p_user AND share_live_activity) THEN RETURN; END IF;
 FOR f IN SELECT back.user_id FROM friendships back JOIN friendships mutual ON mutual.user_id=p_user AND mutual.friend_id=back.user_id AND mutual.partner
 WHERE back.friend_id=p_user AND back.partner AND NOT EXISTS(SELECT 1 FROM message_controls WHERE blocked AND ((user_id=p_user AND other_id=back.user_id) OR (user_id=back.user_id AND other_id=p_user))) LOOP
  PERFORM notify_account(f.user_id,'friend:'||p_user||':'||p_session,'friend','An accountability partner joined a community live class.','/live');
 END LOOP;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['notification_preferences','account_notifications','account_activity_days','trainer_credential_requirements'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON %I TO service_role',t); END LOOP;
END $$;
GRANT SELECT ON notification_preferences,account_notifications,account_activity_days,trainer_credential_requirements TO authenticated;
GRANT INSERT,UPDATE ON notification_preferences TO authenticated;
GRANT UPDATE(read_at) ON account_notifications TO authenticated;
GRANT INSERT,DELETE ON trainer_credential_requirements TO authenticated;
DROP POLICY IF EXISTS preferences_own ON notification_preferences;
CREATE POLICY preferences_own ON notification_preferences FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS notifications_own ON account_notifications;
CREATE POLICY notifications_own ON account_notifications FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS activity_own ON account_activity_days;
CREATE POLICY activity_own ON account_activity_days FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS requirements_read ON trainer_credential_requirements;
CREATE POLICY requirements_read ON trainer_credential_requirements FOR SELECT TO authenticated USING(trainer_id=auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS requirements_admin ON trainer_credential_requirements;
CREATE POLICY requirements_admin ON trainer_credential_requirements FOR ALL TO authenticated USING(has_role(auth.uid(),'admin')) WITH CHECK(has_role(auth.uid(),'admin') AND created_by=auth.uid());
REVOKE ALL ON FUNCTION notify_account(uuid,text,text,text,text),generate_credential_alerts(),notify_friend_attendance(uuid,uuid),record_account_activity(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION notify_account(uuid,text,text,text,text),generate_credential_alerts(),notify_friend_attendance(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION record_account_activity(text) TO authenticated;
-- Audience classification is protected after signup; role changes require trusted admin review.
CREATE OR REPLACE FUNCTION guard_profile_role()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF current_user IN ('anon','authenticated') AND NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION 'Account role changes require support'; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_role_guard ON profiles;
CREATE TRIGGER profile_role_guard BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_role();
-- Old partner-reservation RPC must honor explicit sharing and receiving consent too.
CREATE OR REPLACE FUNCTION public.partner_reservations()
RETURNS TABLE(friend_id uuid,friend_name text,reservations jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT f.friend_id,f.friend_name,coalesce((SELECT jsonb_agg(a.session_id) FROM live_room_access a
 JOIN live_sessions s ON s.id=a.session_id WHERE a.user_id=f.friend_id AND a.status IN ('pending','paid') AND s.status IN ('scheduled','live')),'[]'::jsonb) FROM friendships f
 JOIN friendships back ON back.user_id=f.friend_id AND back.friend_id=f.user_id AND back.partner
 JOIN profiles p ON p.id=f.friend_id
 JOIN notification_preferences sharing ON sharing.user_id=f.friend_id AND sharing.share_live_activity
 JOIN notification_preferences receiving ON receiving.user_id=auth.uid() AND receiving.friend_activity
 WHERE f.user_id=auth.uid() AND f.partner AND NOT EXISTS(SELECT 1 FROM message_controls WHERE blocked AND
 ((user_id=f.friend_id AND other_id=auth.uid()) OR (user_id=auth.uid() AND other_id=f.friend_id)))
$$;
CREATE OR REPLACE FUNCTION notify_restriction_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM notify_account(NEW.user_id,'restriction:'||NEW.updated_at,'moderation',CASE WHEN NEW.active THEN 'Account restriction: '||NEW.reason||'. You can submit an appeal from your notification center.' ELSE 'Your account restriction has been lifted.' END);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_restriction_change ON account_restrictions;
CREATE TRIGGER notify_restriction_change AFTER INSERT OR UPDATE ON account_restrictions FOR EACH ROW EXECUTE FUNCTION notify_restriction_change();
-- Raw fallback storage upload must enforce the same eligibility as Bunny tickets.
DROP POLICY IF EXISTS workout_storage_upload_guard ON storage.objects;
CREATE POLICY workout_storage_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'videos' OR ((storage.foldername(name))[1]=auth.uid()::text AND trainer_is_eligible(auth.uid(),false)));
DROP POLICY IF EXISTS workout_storage_replace_guard ON storage.objects;
CREATE POLICY workout_storage_replace_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'videos') WITH CHECK(bucket_id<>'videos');


-- REVIEWED SOURCE: 0053_verified_live_attendance.sql ORIGINAL SHA256 0e7387ba1abef8f486cc4c467b5a144f9ff2a0e654b4432d7f312658664ffe3f
-- Reservation never debits a wallet. Only the signed provider attendance handler calls consume.
CREATE OR REPLACE FUNCTION reserve_live_class(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s live_sessions%ROWTYPE;
BEGIN
 SELECT * INTO s FROM live_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR s.status NOT IN ('scheduled','live') OR s.starts_at+s.minutes*interval '1 minute'<now()
 OR NOT trainer_is_eligible(s.trainer_id,true) OR NOT account_can_act(p_user_id,false) OR s.trainer_id=p_user_id THEN RAISE EXCEPTION 'Class unavailable'; END IF;
 INSERT INTO live_room_access(session_id,user_id,status) VALUES(p_session_id,p_user_id,'pending')
 ON CONFLICT(session_id,user_id) DO UPDATE SET status=CASE WHEN live_room_access.status='paid' THEN 'paid' ELSE 'pending' END;
 PERFORM notify_account(p_user_id,'reserved:'||p_session_id,'session','Class reserved: '||s.title||'. One token is spent only on verified room entry.','/live');
END $$;
CREATE OR REPLACE FUNCTION redeem_paid_live_token(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM reserve_live_class(p_user_id,p_session_id); END $$;
CREATE OR REPLACE FUNCTION consume_attended_live_token(p_user_id uuid,p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s live_sessions%ROWTYPE; l wallet_token_lots%ROWTYPE; u wallet_token_units%ROWTYPE; redemption uuid; gross integer; fee integer; net integer;
BEGIN
 SELECT * INTO s FROM live_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR s.status NOT IN ('scheduled','live') OR s.starts_at+s.minutes*interval '1 minute'<now()
 OR s.starts_at>now()+interval '10 minutes' OR NOT trainer_is_eligible(s.trainer_id,true) OR s.trainer_id=p_user_id THEN RAISE EXCEPTION 'Class unavailable'; END IF;
 PERFORM 1 FROM profiles WHERE id=p_user_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM live_room_access WHERE session_id=p_session_id AND user_id=p_user_id AND status='paid') THEN
  UPDATE live_room_access SET first_joined_at=now() WHERE session_id=p_session_id AND user_id=p_user_id AND first_joined_at IS NULL;
  IF FOUND THEN PERFORM notify_friend_attendance(p_user_id,p_session_id); END IF;
  RETURN;
 END IF;
 SELECT units.* INTO u FROM wallet_token_units units JOIN wallet_token_lots lots ON lots.id=units.lot_id
 WHERE lots.user_id=p_user_id AND NOT lots.frozen AND units.state='available' ORDER BY lots.created_at,units.unit_index LIMIT 1 FOR UPDATE OF units;
 IF NOT FOUND THEN RAISE EXCEPTION 'No verified purchased tokens available'; END IF;
 SELECT * INTO l FROM wallet_token_lots WHERE id=u.lot_id;
 gross=floor(l.gross_cents::numeric*(u.unit_index+1)/l.purchased)-floor(l.gross_cents::numeric*u.unit_index/l.purchased);
 fee=floor(l.fee_cents::numeric*(u.unit_index+1)/l.purchased)-floor(l.fee_cents::numeric*u.unit_index/l.purchased);net=gross-fee;
 INSERT INTO wallet_redemptions(lot_id,unit_index,user_id,session_id) VALUES(l.id,u.unit_index,p_user_id,p_session_id) RETURNING id INTO redemption;
 UPDATE wallet_token_units SET state='spent',redemption_id=redemption WHERE lot_id=u.lot_id AND unit_index=u.unit_index;
 INSERT INTO live_room_access(session_id,user_id,status,wallet_lot_id,wallet_redemption_id) VALUES(p_session_id,p_user_id,'paid',l.id,redemption)
 ON CONFLICT(session_id,user_id) DO UPDATE SET status='paid',wallet_lot_id=l.id,wallet_redemption_id=redemption,stripe_checkout_session_id=NULL;
 INSERT INTO trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
 VALUES(s.trainer_id::text,'live','wallet:'||redemption::text,gross,fee,net,50,floor(net*0.5));
 UPDATE profiles SET ledger=jsonb_build_array(jsonb_build_object('id','wallet:'||redemption::text,'label','Live class: '||s.title,'tokens',-1,'date',current_date))||coalesce(ledger,'[]'::jsonb) WHERE id=p_user_id;
 UPDATE live_room_access SET first_joined_at=coalesce(first_joined_at,now()) WHERE session_id=p_session_id AND user_id=p_user_id;
 PERFORM notify_friend_attendance(p_user_id,p_session_id);
 PERFORM sync_wallet_balance(p_user_id);
END $$;

REVOKE ALL ON FUNCTION reserve_live_class(uuid,uuid),consume_attended_live_token(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION reserve_live_class(uuid,uuid),consume_attended_live_token(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION set_live_reservation(p_session uuid,p_reserved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF p_reserved THEN PERFORM reserve_live_class(auth.uid(),p_session); END IF;
 UPDATE profiles SET reservations=(SELECT coalesce(jsonb_agg(v),'[]') FROM (
  SELECT value v FROM jsonb_array_elements(reservations) WHERE value<>to_jsonb(p_session::text)
  UNION SELECT to_jsonb(p_session::text) WHERE p_reserved) dedup) WHERE id=auth.uid();
 IF NOT p_reserved THEN DELETE FROM live_room_access WHERE session_id=p_session AND user_id=auth.uid() AND status='pending'; END IF;
END $$;
REVOKE ALL ON FUNCTION set_live_reservation(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION set_live_reservation(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION generate_live_session_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 FOR r IN SELECT a.user_id,s.id,s.title FROM live_room_access a JOIN live_sessions s ON s.id=a.session_id
 WHERE a.status IN ('pending','paid') AND s.status IN ('scheduled','live') AND s.starts_at>now() AND s.starts_at<=now()+interval '10 minutes' LOOP
  PERFORM notify_account(r.user_id,'class-reminder:'||r.id,'session',r.title||' starts within 10 minutes. Reservation is free; a token is spent on verified entry.','/live');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION generate_live_session_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION generate_live_session_reminders() TO service_role;


-- REVIEWED SOURCE: 0054_private_deposits.sql ORIGINAL SHA256 38c35614f659e63161918f98341b7fc0c09bef1e0448e2648a7a577677bb2ca6
-- Version 1 paid bookings remain fully paid; no second charge is created for them.
ALTER TABLE private_booking_holds ADD COLUMN IF NOT EXISTS total_cents integer;
ALTER TABLE private_booking_holds ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS payment_version integer NOT NULL DEFAULT 1;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS total_cents integer;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS deposit_cents integer;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS balance_cents integer;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS both_present_at timestamptz;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS member_confirmed_at timestamptz;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS deposit_origin text;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS transfer_used boolean NOT NULL DEFAULT false;
ALTER TABLE private_session_access ADD COLUMN IF NOT EXISTS transfer_from text;
ALTER TABLE private_session_access DROP CONSTRAINT IF EXISTS private_session_access_status_check;
ALTER TABLE private_session_access ADD CONSTRAINT private_session_access_status_check CHECK(status IN ('paid','refunded','cancelled','deposit_paid','balance_pending','credential_hold','transferred'));
DROP INDEX IF EXISTS private_active_slot;
CREATE UNIQUE INDEX private_active_slot ON private_session_access(trainer_id,day,time) WHERE status IN ('paid','deposit_paid','balance_pending','credential_hold');
CREATE TABLE IF NOT EXISTS private_payment_methods (
 booking_id text PRIMARY KEY REFERENCES private_session_access(checkout_id),customer_id text NOT NULL,payment_method_id text NOT NULL);
CREATE TABLE IF NOT EXISTS private_booking_payments (
 payment_id text PRIMARY KEY,booking_id text NOT NULL REFERENCES private_session_access(checkout_id),stage text NOT NULL CHECK(stage IN ('deposit','balance')),
 intent_id text UNIQUE,gross_cents integer NOT NULL CHECK(gross_cents>0),fee_cents integer NOT NULL CHECK(fee_cents>=0 AND fee_cents<=gross_cents),
 refunded_cents integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(booking_id,stage));
CREATE TABLE IF NOT EXISTS private_balance_operations (
 booking_id text PRIMARY KEY REFERENCES private_session_access(checkout_id),operation_key text NOT NULL UNIQUE,
 intent_id text UNIQUE,checkout_id text,lease_until timestamptz NOT NULL DEFAULT now(),status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','requires_action','processing','succeeded','failed')),last_error text);
CREATE TABLE IF NOT EXISTS private_reschedule_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id text NOT NULL REFERENCES private_session_access(checkout_id),
 member_id uuid NOT NULL REFERENCES auth.users(id),day date NOT NULL,time text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','declined')),UNIQUE(booking_id,day,time));
ALTER TABLE trainer_earnings ADD COLUMN IF NOT EXISTS fulfillment_pending boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION prepare_deposit_booking(p_trainer uuid,p_member uuid,p_day date,p_time text,p_terms text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h uuid; price integer;
BEGIN
 IF p_terms<>'private-deposit-v1' OR NOT account_can_act(p_member,false) THEN RAISE EXCEPTION 'Consent and active account required'; END IF;
 h=hold_private_booking(p_trainer,p_member,p_day,p_time);
 SELECT round((extra->'trainer'->>'rate')::numeric*100)::integer INTO price FROM profiles WHERE id=p_trainer;
 -- Stripe minimum applies to EACH installment: 25% deposit at least 50 cents.
 IF price NOT BETWEEN 200 AND 100000 THEN RAISE EXCEPTION 'Trainer price must support both installments (minimum $2)'; END IF;
 UPDATE private_booking_holds SET total_cents=coalesce(total_cents,price),terms_version=p_terms WHERE id=h;
 RETURN h;
END $$;
CREATE OR REPLACE FUNCTION apply_private_deposit(p_checkout text,p_hold uuid,p_member uuid,p_gross integer,p_fee integer,p_customer text,p_method text,p_intent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h private_booking_holds%ROWTYPE; amount integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_checkout));
 IF EXISTS(SELECT 1 FROM private_booking_payments WHERE payment_id=p_checkout) THEN RETURN; END IF;
 SELECT * INTO h FROM private_booking_holds WHERE id=p_hold FOR UPDATE;
 IF NOT FOUND OR h.member_id<>p_member OR h.expires_at<=now() OR (h.day::text||' '||h.time)::timestamp AT TIME ZONE 'America/Chicago'<=now() OR h.terms_version<>'private-deposit-v1' OR h.total_cents IS NULL THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
 amount=floor((h.total_cents+2)::numeric/4);
 IF p_gross<>amount OR p_fee<0 OR p_fee>amount OR p_customer='' OR p_method='' OR p_intent='' THEN RAISE EXCEPTION 'Invalid deposit'; END IF;
 IF NOT trainer_is_eligible(h.trainer_id,false) OR NOT account_can_act(p_member,false) THEN RAISE EXCEPTION 'Trainer or member unavailable'; END IF;
 INSERT INTO private_session_access(checkout_id,trainer_id,member_id,day,time,starts_at,status,payment_version,total_cents,deposit_cents,balance_cents,terms_version,deposit_origin)
 VALUES(p_checkout,h.trainer_id,h.member_id,h.day,h.time,(h.day::text||' '||h.time)::timestamp AT TIME ZONE 'America/Chicago',
 'deposit_paid',2,h.total_cents,amount,h.total_cents-amount,h.terms_version,p_checkout);
 INSERT INTO checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents) VALUES(p_checkout,'booking',p_member,amount,p_fee);
 INSERT INTO private_booking_payments(payment_id,booking_id,stage,intent_id,gross_cents,fee_cents) VALUES(p_checkout,p_checkout,'deposit',p_intent,amount,p_fee);
 INSERT INTO private_payment_methods(booking_id,customer_id,payment_method_id) VALUES(p_checkout,p_customer,p_method);
 INSERT INTO trainer_busy(trainer_id,day,time,source) VALUES(h.trainer_id::text,h.day,h.time,'booked');
 DELETE FROM private_booking_holds WHERE id=h.id;
 PERFORM notify_account(h.member_id,'deposit:'||p_checkout,'session','Private session reserved. Deposit paid; balance is due only after both participants enter the waiting room.');
 PERFORM notify_account(h.trainer_id,'deposit:'||p_checkout,'session','A private session deposit was received.','/studio');
END $$;
CREATE OR REPLACE FUNCTION record_private_both_present(p_booking text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE;
BEGIN
 SELECT * INTO b FROM private_session_access WHERE checkout_id=p_booking FOR UPDATE;
 IF NOT FOUND OR b.payment_version<>2 OR b.status NOT IN ('deposit_paid','balance_pending') OR NOT trainer_is_eligible(b.trainer_id,false)
 OR NOT account_can_act(b.member_id,false) OR now()<b.starts_at OR now()>b.starts_at+interval '15 minutes'
 OR EXISTS(SELECT 1 FROM private_booking_payments p JOIN checkout_payment_state s ON s.checkout_id=p.payment_id
 WHERE p.payment_id=coalesce(b.deposit_origin,b.checkout_id) AND (s.refunded_cents>0 OR EXISTS(SELECT 1 FROM payment_disputes WHERE checkout_id=s.checkout_id AND status IN ('open','lost')))) THEN RETURN false; END IF;
 UPDATE private_session_access SET both_present_at=coalesce(both_present_at,now()),status='balance_pending' WHERE checkout_id=p_booking;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION claim_private_balance(p_booking text)
RETURNS SETOF private_balance_operations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE;
BEGIN
 SELECT * INTO b FROM private_session_access WHERE checkout_id=p_booking FOR UPDATE;
 IF NOT FOUND OR b.payment_version<>2 OR b.status<>'balance_pending' OR b.both_present_at IS NULL OR NOT trainer_is_eligible(b.trainer_id,false) THEN RETURN; END IF;
 INSERT INTO private_balance_operations(booking_id,operation_key,lease_until) VALUES(p_booking,'balance:'||p_booking,now()+interval '2 minutes') ON CONFLICT DO NOTHING;
 IF FOUND THEN RETURN QUERY SELECT * FROM private_balance_operations WHERE booking_id=p_booking; RETURN; END IF;
 RETURN QUERY UPDATE private_balance_operations SET lease_until=now()+interval '2 minutes' WHERE booking_id=p_booking AND lease_until<=now() AND status<>'succeeded' RETURNING *;
END $$;
CREATE OR REPLACE FUNCTION apply_private_balance(p_booking text,p_intent text,p_gross integer,p_fee integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE;
BEGIN
 SELECT * INTO b FROM private_session_access WHERE checkout_id=p_booking FOR UPDATE;
 IF NOT FOUND OR b.payment_version<>2 OR b.both_present_at IS NULL OR p_gross<>b.balance_cents OR p_fee<0 OR p_fee>p_gross THEN RAISE EXCEPTION 'Invalid balance payment'; END IF;
 IF EXISTS(SELECT 1 FROM private_booking_payments WHERE payment_id=p_intent) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM private_booking_payments WHERE booking_id=p_booking AND stage='balance') THEN RAISE EXCEPTION 'Second balance payment'; END IF;
 INSERT INTO checkout_payment_state(checkout_id,kind,user_id,gross_cents,fee_cents) VALUES(p_intent,'booking',b.member_id,p_gross,p_fee);
 INSERT INTO private_booking_payments(payment_id,booking_id,stage,intent_id,gross_cents,fee_cents) VALUES(p_intent,p_booking,'balance',p_intent,p_gross,p_fee);
 UPDATE private_balance_operations SET status='succeeded',intent_id=p_intent WHERE booking_id=p_booking;
 IF b.status IN ('cancelled','refunded','credential_hold','transferred') OR NOT trainer_is_eligible(b.trainer_id,false) OR now()>b.starts_at+interval '60 minutes' THEN
  INSERT INTO refund_jobs(checkout_id,reason) VALUES(p_intent,'unfulfillable_balance') ON CONFLICT DO NOTHING;
  RETURN;
 END IF;
 UPDATE private_session_access SET status='paid' WHERE checkout_id=p_booking;
 PERFORM notify_account(b.member_id,'balance:'||p_booking,'session','Private session balance confirmed. Full session access is ready.');
END $$;
-- No deposit or balance earnings before the completed session; fees are allocated separately
-- to each real charge so both processing fees precede the agreed 90% split.
CREATE OR REPLACE FUNCTION finalize_delivered_private_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE; p private_booking_payments%ROWTYPE;
BEGIN
 FOR b IN SELECT * FROM private_session_access WHERE payment_version=2 AND status='paid' AND both_present_at IS NOT NULL
 AND member_confirmed_at IS NOT NULL AND both_present_at+interval '60 minutes'<now() AND delivered_at IS NULL FOR UPDATE LOOP
  UPDATE private_session_access SET delivered_at=now() WHERE checkout_id=b.checkout_id;
  FOR p IN SELECT * FROM private_booking_payments WHERE (booking_id=b.checkout_id AND stage='balance') OR payment_id=b.deposit_origin LOOP
   IF EXISTS(SELECT 1 FROM payment_disputes WHERE checkout_id=p.payment_id AND status IN ('open','lost')) THEN CONTINUE; END IF;
   INSERT INTO trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents,reversal_target_cents,status)
   VALUES(b.trainer_id::text,'oneonone',p.payment_id,p.gross_cents,p.fee_cents,p.gross_cents-p.fee_cents,90,floor((p.gross_cents-p.fee_cents)*0.9),
   floor(floor((p.gross_cents-p.fee_cents)*0.9)*p.refunded_cents/p.gross_cents),CASE WHEN p.refunded_cents>=p.gross_cents THEN 'refunded' ELSE 'pending' END) ON CONFLICT(ref) DO NOTHING;
  END LOOP;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION cancel_private_session(p_checkout_id text,p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE; p record;
BEGIN
 SELECT * INTO b FROM private_session_access WHERE checkout_id=p_checkout_id FOR UPDATE;
 IF NOT FOUND OR p_user_id NOT IN(b.trainer_id,b.member_id) THEN RAISE EXCEPTION 'Not your booking'; END IF;
 IF b.delivered_at IS NOT NULL THEN RAISE EXCEPTION 'Contact support about a completed session'; END IF;
 IF b.status IN ('refunded','cancelled','transferred') THEN RETURN; END IF;
 UPDATE private_session_access SET status='cancelled' WHERE checkout_id=p_checkout_id;
 DELETE FROM trainer_busy WHERE trainer_id=b.trainer_id::text AND day=b.day AND time=b.time AND source='booked';
 -- Launch policy deliberately grants a full refund on all unfulfilled cancellations,
 -- including member late cancellation/no-show; no speculative retained cancellation fee.
 IF b.payment_version=1 THEN INSERT INTO refund_jobs(checkout_id,reason) VALUES(p_checkout_id,'private_cancelled') ON CONFLICT DO NOTHING;
 ELSE
  FOR p IN SELECT payment_id FROM private_booking_payments WHERE booking_id=b.checkout_id OR payment_id=b.deposit_origin LOOP
   INSERT INTO refund_jobs(checkout_id,reason) VALUES(p.payment_id,'private_cancelled_full_refund') ON CONFLICT(checkout_id) DO UPDATE SET target_cents=NULL,completed_at=NULL;
  END LOOP;
 END IF;
 PERFORM notify_account(b.member_id,'cancel:'||p_checkout_id,'session','Private session cancelled. A full refund has been queued; processing status remains visible.');
 PERFORM notify_account(b.trainer_id,'cancel:'||p_checkout_id,'session','Private session cancelled; no session payout.','/studio');
END $$;
CREATE OR REPLACE FUNCTION request_private_reschedule(p_booking text,p_day date,p_time text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE; result uuid;
BEGIN
 SELECT * INTO b FROM private_session_access WHERE checkout_id=p_booking FOR UPDATE;
 IF NOT FOUND OR b.member_id<>auth.uid() OR b.payment_version<>2 OR b.transfer_used OR b.status NOT IN ('deposit_paid','credential_hold') OR b.both_present_at IS NOT NULL OR p_day<=current_date THEN RAISE EXCEPTION 'Deposit cannot be transferred'; END IF;
 INSERT INTO private_reschedule_requests(booking_id,member_id,day,time) VALUES(p_booking,auth.uid(),p_day,p_time) ON CONFLICT(booking_id,day,time) DO UPDATE SET status='requested' RETURNING id INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION approve_private_reschedule(p_request uuid,p_approve boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r private_reschedule_requests%ROWTYPE; b private_session_access%ROWTYPE; h uuid; result text;
BEGIN
 SELECT * INTO r FROM private_reschedule_requests WHERE id=p_request FOR UPDATE;
 SELECT * INTO b FROM private_session_access WHERE checkout_id=r.booking_id FOR UPDATE;
 IF NOT FOUND OR b.trainer_id<>auth.uid() OR r.status<>'requested' THEN RAISE EXCEPTION 'Trainer decision required'; END IF;
 IF NOT p_approve THEN UPDATE private_reschedule_requests SET status='declined' WHERE id=p_request; RETURN b.checkout_id; END IF;
 IF b.payment_version<>2 OR b.transfer_used OR b.both_present_at IS NOT NULL OR b.status NOT IN ('deposit_paid','credential_hold') OR NOT trainer_is_eligible(b.trainer_id,false)
 OR EXISTS(SELECT 1 FROM refund_jobs WHERE checkout_id=b.deposit_origin)
 OR EXISTS(SELECT 1 FROM checkout_payment_state WHERE checkout_id=b.deposit_origin AND refunded_cents>0)
 OR EXISTS(SELECT 1 FROM payment_disputes WHERE checkout_id=b.deposit_origin AND status IN ('open','lost')) THEN RAISE EXCEPTION 'Deposit is unavailable'; END IF;
 h=hold_private_booking(b.trainer_id,b.member_id,r.day,r.time); result='rescheduled:'||r.id;
 UPDATE private_session_access SET status='transferred',transfer_used=true WHERE checkout_id=b.checkout_id;
 DELETE FROM trainer_busy WHERE trainer_id=b.trainer_id::text AND day=b.day AND time=b.time AND source='booked';
 INSERT INTO private_session_access(checkout_id,trainer_id,member_id,day,time,starts_at,status,payment_version,total_cents,deposit_cents,balance_cents,terms_version,deposit_origin,transfer_used,transfer_from)
 VALUES(result,b.trainer_id,b.member_id,r.day,r.time,(r.day::text||' '||r.time)::timestamp AT TIME ZONE 'America/Chicago','deposit_paid',2,b.total_cents,b.deposit_cents,b.balance_cents,b.terms_version,b.deposit_origin,true,b.checkout_id);
 INSERT INTO private_payment_methods SELECT result,customer_id,payment_method_id FROM private_payment_methods WHERE booking_id=b.checkout_id;
 INSERT INTO trainer_busy(trainer_id,day,time,source) VALUES(b.trainer_id::text,r.day,r.time,'booked');
 DELETE FROM private_booking_holds WHERE id=h;
 UPDATE private_reschedule_requests SET status='approved' WHERE id=r.id;
 PERFORM notify_account(b.member_id,'rescheduled:'||r.id,'session','Trainer approved the new date. Your existing deposit was transferred once; no new deposit was charged.');
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION maintain_private_bookings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE;
BEGIN
 FOR b IN SELECT * FROM private_session_access WHERE status IN ('paid','deposit_paid','balance_pending','credential_hold') AND delivered_at IS NULL AND (payment_version=2 OR starts_at>now()) FOR UPDATE LOOP
  IF (b.both_present_at IS NULL OR b.status<>'paid') AND NOT trainer_is_eligible(b.trainer_id,false) THEN
   UPDATE private_session_access SET status='credential_hold' WHERE checkout_id=b.checkout_id;
   PERFORM notify_account(b.member_id,'credential-hold:'||b.checkout_id,'session','Trainer credentials are unavailable. Session is on hold; request a full refund now or propose one consensual reschedule.');
   PERFORM notify_account(b.trainer_id,'credential-hold:'||b.checkout_id,'credential','An upcoming booking is on credential hold. Renewal alone does not restart it.','/studio');
  END IF;
  IF (b.status='credential_hold' AND b.starts_at<=now()) OR (b.both_present_at IS NULL AND b.starts_at+interval '15 minutes'<now())
  OR (b.status IN ('deposit_paid','balance_pending') AND b.starts_at+interval '60 minutes'<now()) THEN
   PERFORM cancel_private_session(b.checkout_id,b.member_id);
  END IF;
 END LOOP;
 PERFORM finalize_delivered_private_sessions();
 INSERT INTO private_room_shutdown_jobs(booking_id)
 SELECT checkout_id FROM private_session_access WHERE status='paid'
 AND (payment_version=2 OR starts_at>now()-interval '1 day')
 AND coalesce(both_present_at,starts_at)+interval '60 minutes'<now() ON CONFLICT DO NOTHING;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['private_payment_methods','private_booking_payments','private_balance_operations','private_reschedule_requests'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('REVOKE ALL ON %I FROM anon,authenticated',t); EXECUTE format('GRANT ALL ON %I TO service_role',t); END LOOP;
END $$;
GRANT SELECT ON private_reschedule_requests TO authenticated;
DROP POLICY IF EXISTS reschedule_participants ON private_reschedule_requests;
CREATE POLICY reschedule_participants ON private_reschedule_requests FOR SELECT TO authenticated USING(member_id=auth.uid() OR EXISTS(SELECT 1 FROM private_session_access WHERE checkout_id=booking_id AND trainer_id=auth.uid()));
REVOKE ALL ON FUNCTION prepare_deposit_booking(uuid,uuid,date,text,text),apply_private_deposit(text,uuid,uuid,integer,integer,text,text,text),record_private_both_present(text),claim_private_balance(text),apply_private_balance(text,text,integer,integer),finalize_delivered_private_sessions(),maintain_private_bookings(),request_private_reschedule(text,date,text),approve_private_reschedule(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION prepare_deposit_booking(uuid,uuid,date,text,text),apply_private_deposit(text,uuid,uuid,integer,integer,text,text,text),record_private_both_present(text),claim_private_balance(text),apply_private_balance(text,text,integer,integer),finalize_delivered_private_sessions(),maintain_private_bookings() TO service_role;
GRANT EXECUTE ON FUNCTION request_private_reschedule(text,date,text),approve_private_reschedule(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION apply_checkout_refund_legacy(p_checkout_id text,p_refund_cents integer,p_fully_refunded boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v checkout_payment_state%ROWTYPE; u wallet_token_units%ROWTYPE; e trainer_earnings%ROWTYPE; target integer; revoked_count integer; rounded integer; before_balance integer; after_balance integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_checkout_id));
 SELECT * INTO v FROM checkout_payment_state WHERE checkout_id=p_checkout_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF p_refund_cents<0 OR p_refund_cents>v.gross_cents THEN RAISE EXCEPTION 'Invalid refund'; END IF;
 IF p_refund_cents<=v.refunded_cents THEN RETURN; END IF;
 UPDATE checkout_payment_state SET refunded_cents=p_refund_cents WHERE checkout_id=p_checkout_id;
 IF v.kind='tokens' THEN
  SELECT tokens INTO before_balance FROM profiles WHERE id=v.user_id FOR UPDATE;
  revoked_count=ceil(v.quantity::numeric*p_refund_cents/v.gross_cents);
  FOR u IN SELECT * FROM wallet_token_units WHERE lot_id=p_checkout_id AND unit_index>=v.quantity-revoked_count AND state<>'refunded' FOR UPDATE LOOP
   UPDATE wallet_token_units SET state='refunded' WHERE lot_id=u.lot_id AND unit_index=u.unit_index;
   IF u.redemption_id IS NOT NULL THEN
    UPDATE live_room_access SET status='refunded' WHERE wallet_redemption_id=u.redemption_id;
    UPDATE trainer_earnings SET reversal_target_cents=payout_cents,
      status=CASE WHEN transfer_id IS NULL AND operation_key IS NULL THEN 'refunded' ELSE 'reversal_due' END WHERE ref='wallet:'||u.redemption_id::text;
   END IF;
  END LOOP;
  PERFORM sync_wallet_balance(v.user_id);
  SELECT tokens INTO after_balance FROM profiles WHERE id=v.user_id;
  UPDATE profiles SET ledger=jsonb_build_array(jsonb_build_object('id','refund:'||p_checkout_id||':'||p_refund_cents::text,
   'label','Payment refund $'||((p_refund_cents-v.refunded_cents)/100.0)::text,'tokens',after_balance-before_balance,'date',current_date))||coalesce(ledger,'[]'::jsonb) WHERE id=v.user_id;
  -- Token refunds are whole $5 units. Finish a provider-initiated fractional refund via an auditable job.
  rounded=least(v.gross_cents,revoked_count*500);
  IF rounded>p_refund_cents THEN
   INSERT INTO refund_jobs(checkout_id,reason,target_cents) VALUES(p_checkout_id,'complete_token_unit_refund',rounded)
   ON CONFLICT(checkout_id) DO UPDATE SET target_cents=CASE WHEN refund_jobs.target_cents IS NULL THEN NULL ELSE greatest(refund_jobs.target_cents,excluded.target_cents) END,completed_at=NULL;
  END IF;
 ELSIF p_refund_cents=v.gross_cents THEN
  UPDATE private_session_access SET status='refunded' WHERE checkout_id=p_checkout_id;
  DELETE FROM trainer_busy WHERE source='booked' AND (trainer_id,day,time) IN(SELECT trainer_id::text,day,time FROM private_session_access WHERE checkout_id=p_checkout_id);
  UPDATE profiles SET bookings=(SELECT coalesce(jsonb_agg(b),'[]'::jsonb) FROM jsonb_array_elements(coalesce(bookings,'[]'::jsonb)) b WHERE b->>'id'<>p_checkout_id) WHERE id=v.user_id;
  UPDATE live_room_access SET status='refunded' WHERE stripe_checkout_session_id=p_checkout_id;
 END IF;
 SELECT * INTO e FROM trainer_earnings WHERE ref=p_checkout_id FOR UPDATE;
 IF FOUND THEN
  target=floor(e.payout_cents::numeric*p_refund_cents/v.gross_cents);
  UPDATE trainer_earnings SET reversal_target_cents=target,status=CASE
   WHEN operation_key IS NOT NULL THEN CASE WHEN transfer_id IS NULL THEN 'transferring' ELSE 'reversal_due' END
   WHEN transfer_id IS NOT NULL THEN CASE WHEN target>withheld_cents+transfer_reversed_cents THEN 'reversal_due' ELSE 'paid' END
   WHEN p_refund_cents=v.gross_cents THEN 'refunded' ELSE 'pending' END WHERE id=e.id;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION apply_checkout_refund(p_checkout_id text,p_refund_cents integer,p_fully_refunded boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE; customer uuid;
BEGIN
 PERFORM apply_checkout_refund_legacy(p_checkout_id,p_refund_cents,p_fully_refunded);
 SELECT user_id INTO customer FROM checkout_payment_state WHERE checkout_id=p_checkout_id AND refunded_cents=p_refund_cents;
 IF customer IS NOT NULL AND p_refund_cents>0 THEN
  PERFORM notify_account(customer,'refund-confirmed:'||p_checkout_id||':'||p_refund_cents,'session','Refund confirmed: $'||(p_refund_cents/100.0)::text||' refunded in total for this payment.');
 END IF;
 UPDATE private_booking_payments SET refunded_cents=greatest(refunded_cents,p_refund_cents) WHERE payment_id=p_checkout_id;
 FOR b IN SELECT * FROM private_session_access WHERE payment_version=2 AND delivered_at IS NULL AND status NOT IN ('transferred','refunded','cancelled')
 AND (deposit_origin=p_checkout_id OR checkout_id IN(SELECT booking_id FROM private_booking_payments WHERE payment_id=p_checkout_id)) FOR UPDATE LOOP
  IF p_refund_cents>0 THEN PERFORM cancel_private_session(b.checkout_id,b.member_id); END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION apply_checkout_refund_legacy(text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION apply_checkout_refund_legacy(text,integer,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.hold_private_booking(p_trainer_id uuid,p_member_id uuid,p_day date,p_time text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE out_id uuid; start_time timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_trainer_id::text||p_day::text));
 start_time=(p_day::text||' '||p_time)::timestamp AT TIME ZONE 'America/Chicago';
 IF p_member_id=p_trainer_id OR start_time<=now() OR p_day>current_date+365
 OR p_time NOT IN ('07:00','09:00','12:00','15:00','19:00') OR NOT trainer_is_eligible(p_trainer_id,false)
 THEN RAISE EXCEPTION 'Invalid private booking'; END IF;
 DELETE FROM private_booking_holds WHERE expires_at<now();
 SELECT id INTO out_id FROM private_booking_holds WHERE trainer_id=p_trainer_id AND member_id=p_member_id AND day=p_day AND time=p_time;
 IF FOUND THEN RETURN out_id; END IF;
 IF EXISTS(SELECT 1 FROM trainer_busy WHERE trainer_id=p_trainer_id::text AND day=p_day AND (time=p_time OR time='ALL'))
 OR EXISTS(SELECT 1 FROM live_sessions WHERE trainer_id=p_trainer_id AND status IN ('scheduled','live')
  AND starts_at<start_time+interval '1 hour' AND starts_at+minutes*interval '1 minute'>start_time)
 OR EXISTS(SELECT 1 FROM private_session_access WHERE trainer_id=p_trainer_id AND status IN ('paid','deposit_paid','balance_pending','credential_hold')
  AND starts_at<start_time+interval '1 hour' AND starts_at+interval '1 hour'>start_time)
 THEN RAISE EXCEPTION 'Trainer unavailable'; END IF;
 INSERT INTO private_booking_holds(trainer_id,member_id,day,time) VALUES(p_trainer_id,p_member_id,p_day,p_time) RETURNING id INTO out_id;
 RETURN out_id;
END $$;
-- A new live class cannot take a time already reserved in a private checkout or paid booking.
CREATE OR REPLACE FUNCTION public.protect_class_calendar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.starts_at=OLD.starts_at THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(NEW.trainer_id::text||(NEW.starts_at AT TIME ZONE 'America/Chicago')::date::text));
 IF EXISTS(SELECT 1 FROM private_booking_holds WHERE trainer_id=NEW.trainer_id AND expires_at>now()
  AND (day::text||' '||time)::timestamp AT TIME ZONE 'America/Chicago'<NEW.starts_at+NEW.minutes*interval '1 minute'
  AND ((day::text||' '||time)::timestamp AT TIME ZONE 'America/Chicago')+interval '1 hour'>NEW.starts_at)
 OR EXISTS(SELECT 1 FROM private_session_access WHERE trainer_id=NEW.trainer_id AND status IN ('paid','deposit_paid','balance_pending','credential_hold')
  AND starts_at<NEW.starts_at+NEW.minutes*interval '1 minute' AND starts_at+interval '1 hour'>NEW.starts_at)
 THEN RAISE EXCEPTION 'Time conflicts with a private reservation'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_class_calendar ON live_sessions;
CREATE TRIGGER protect_class_calendar BEFORE INSERT OR UPDATE OF starts_at ON live_sessions FOR EACH ROW EXECUTE FUNCTION protect_class_calendar();
ALTER TABLE private_balance_operations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS private_room_shutdown_jobs (
 booking_id text PRIMARY KEY REFERENCES private_session_access(checkout_id),completed_at timestamptz,last_error text);
ALTER TABLE private_room_shutdown_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_room_shutdown_jobs FROM anon,authenticated;
GRANT ALL ON private_room_shutdown_jobs TO service_role;
CREATE OR REPLACE FUNCTION queue_private_room_shutdown()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status IN ('cancelled','refunded','credential_hold','transferred') AND NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO private_room_shutdown_jobs(booking_id) VALUES(NEW.checkout_id) ON CONFLICT(booking_id) DO UPDATE SET completed_at=NULL;
 END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS private_room_shutdown ON private_session_access;
CREATE TRIGGER private_room_shutdown AFTER UPDATE ON private_session_access FOR EACH ROW EXECUTE FUNCTION queue_private_room_shutdown();
ALTER TABLE refund_jobs ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE refund_jobs ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
-- Disputes on either installment must lock the corresponding active booking, including
-- a rescheduled booking linked to the original deposit. Preserve the existing ledger engine.
CREATE OR REPLACE FUNCTION public.apply_payment_dispute_legacy(p_id text,p_checkout_id text,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v checkout_payment_state%ROWTYPE; prior payment_disputes%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_checkout_id));
 SELECT * INTO prior FROM payment_disputes WHERE id=p_id FOR UPDATE;
 IF FOUND AND prior.status IN ('won','lost') THEN RETURN; END IF;
 INSERT INTO payment_disputes(id,checkout_id,status) VALUES(p_id,p_checkout_id,p_status)
 ON CONFLICT(id) DO UPDATE SET status=p_status;
 SELECT * INTO v FROM checkout_payment_state WHERE checkout_id=p_checkout_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF p_status='open' OR p_status='lost' THEN
  UPDATE payment_disputes SET wallet_remaining=coalesce(wallet_remaining,(SELECT remaining FROM wallet_token_lots WHERE id=p_checkout_id)),
   wallet_revoked=coalesce(wallet_revoked,(SELECT revoked FROM wallet_token_lots WHERE id=p_checkout_id)) WHERE id=p_id;
  UPDATE wallet_token_lots SET frozen=true WHERE id=p_checkout_id;
  UPDATE profiles SET tokens=(SELECT coalesce(sum(remaining),0) FROM wallet_token_lots WHERE user_id=v.user_id AND NOT frozen) WHERE id=v.user_id;
  UPDATE private_session_access SET status='cancelled' WHERE checkout_id=p_checkout_id AND status='paid';
  UPDATE live_room_access SET status='cancelled' WHERE (stripe_checkout_session_id=p_checkout_id OR wallet_lot_id=p_checkout_id) AND status='paid';
  UPDATE trainer_earnings SET reversal_target_cents=payout_cents,
   status=CASE WHEN transfer_id IS NULL AND operation_key IS NULL THEN 'refunded' ELSE 'reversal_due' END
   WHERE ref=p_checkout_id OR ref IN(SELECT 'wallet:'||id::text FROM wallet_redemptions WHERE lot_id=p_checkout_id);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apply_payment_dispute(p_id text,p_checkout_id text,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM apply_payment_dispute_legacy(p_id,p_checkout_id,p_status);
 IF EXISTS(SELECT 1 FROM payment_disputes WHERE id=p_id AND status IN ('open','lost')) THEN
  UPDATE private_session_access SET status='credential_hold' WHERE payment_version=2 AND delivered_at IS NULL
   AND status IN ('paid','deposit_paid','balance_pending') AND (deposit_origin=p_checkout_id OR checkout_id IN(SELECT booking_id FROM private_booking_payments WHERE payment_id=p_checkout_id));
 END IF;
END $$;
REVOKE ALL ON FUNCTION apply_payment_dispute_legacy(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION apply_payment_dispute_legacy(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.restore_won_disputes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d payment_disputes%ROWTYPE; v checkout_payment_state%ROWTYPE; e trainer_earnings%ROWTYPE;
 desired integer; actual integer; refund_target integer;
BEGIN
 FOR d IN SELECT * FROM payment_disputes WHERE status='won' AND NOT reconciled FOR UPDATE LOOP
  IF EXISTS(SELECT 1 FROM trainer_earnings WHERE operation_key IS NOT NULL AND
   (ref=d.checkout_id OR ref IN(SELECT 'wallet:'||id::text FROM wallet_redemptions WHERE lot_id=d.checkout_id))) THEN CONTINUE; END IF;
  SELECT * INTO v FROM checkout_payment_state WHERE checkout_id=d.checkout_id;
  IF NOT FOUND THEN CONTINUE; END IF;
  UPDATE wallet_token_lots SET frozen=false WHERE id=d.checkout_id;
  UPDATE profiles SET tokens=(SELECT coalesce(sum(remaining),0) FROM wallet_token_lots WHERE user_id=v.user_id AND NOT frozen) WHERE id=v.user_id;
  IF v.refunded_cents=0 THEN
   UPDATE private_session_access SET status='paid' WHERE checkout_id=d.checkout_id AND status='cancelled' AND payment_version=1;
   UPDATE live_room_access a SET status='paid' WHERE (stripe_checkout_session_id=d.checkout_id OR wallet_lot_id=d.checkout_id)
    AND status='cancelled' AND EXISTS(SELECT 1 FROM live_sessions WHERE id=a.session_id AND status IN ('scheduled','live'));
  END IF;
  FOR e IN SELECT * FROM trainer_earnings WHERE ref=d.checkout_id OR
    ref IN(SELECT 'wallet:'||id::text FROM wallet_redemptions WHERE lot_id=d.checkout_id) FOR UPDATE LOOP
   refund_target=CASE WHEN v.gross_cents>0 THEN floor(e.payout_cents::numeric*v.refunded_cents/v.gross_cents) ELSE e.payout_cents END;
   desired=e.payout_cents-refund_target;
   IF e.transfer_id IS NULL THEN
    UPDATE trainer_earnings SET reversal_target_cents=refund_target,status=CASE WHEN desired>0 THEN 'pending' ELSE 'refunded' END WHERE id=e.id;
   ELSE
    actual=e.payout_cents-e.withheld_cents-e.transfer_reversed_cents;
    UPDATE trainer_earnings SET reversal_target_cents=greatest(refund_target,e.withheld_cents+e.transfer_reversed_cents),
      status=CASE WHEN refund_target>e.withheld_cents+e.transfer_reversed_cents THEN 'reversal_due' ELSE 'paid' END WHERE id=e.id;
    IF desired>actual THEN
     INSERT INTO trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents,adjustment_for)
     VALUES(e.trainer_slug,e.source,'dispute-recovery:'||d.id||':'||e.id::text,desired-actual,0,desired-actual,100,desired-actual,e.id)
     ON CONFLICT(ref) DO NOTHING;
    END IF;
   END IF;
  END LOOP;
  UPDATE payment_disputes SET reconciled=true WHERE id=d.id;
 END LOOP;
END $$;


CREATE OR REPLACE FUNCTION confirm_private_delivery(p_booking text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b private_session_access%ROWTYPE;
BEGIN
 SELECT * INTO b FROM private_session_access WHERE checkout_id=p_booking FOR UPDATE;
 IF NOT FOUND OR b.member_id<>auth.uid() OR b.payment_version<>2 OR b.status<>'paid' OR b.both_present_at IS NULL
 OR b.both_present_at+interval '60 minutes'>=now() THEN RAISE EXCEPTION 'Only the member can confirm a received session after its session window'; END IF;
 UPDATE private_session_access SET member_confirmed_at=coalesce(member_confirmed_at,now()) WHERE checkout_id=p_booking;
 PERFORM finalize_delivered_private_sessions();
END $$;
REVOKE ALL ON FUNCTION confirm_private_delivery(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION confirm_private_delivery(text) TO authenticated;
CREATE TABLE IF NOT EXISTS launch_schema_versions(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE launch_schema_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON launch_schema_versions FROM anon,authenticated;
GRANT ALL ON launch_schema_versions TO service_role;
INSERT INTO launch_schema_versions(version) VALUES('0054_launch_completion') ON CONFLICT DO NOTHING;
-- Apply a delayed successful-payment event together with already-known refunds in
-- ONE transaction. There is no intermediate spendable/paid access window.
CREATE OR REPLACE FUNCTION settle_paid_checkout(p_kind text,p_args jsonb,p_refunded integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payment text;
BEGIN
 payment=p_args->>'p_checkout_id';
 IF p_kind='tokens' THEN
  PERFORM apply_paid_token_checkout(payment,(p_args->>'p_user_id')::uuid,(p_args->>'p_tokens')::integer,(p_args->>'p_gross_cents')::integer,(p_args->>'p_fee_cents')::integer);
 ELSIF p_kind='deposit' THEN
  payment=p_args->>'p_checkout';
  PERFORM apply_private_deposit(payment,(p_args->>'p_hold')::uuid,(p_args->>'p_member')::uuid,(p_args->>'p_gross')::integer,(p_args->>'p_fee')::integer,p_args->>'p_customer',p_args->>'p_method',p_args->>'p_intent');
 ELSIF p_kind='balance' THEN
  payment=p_args->>'p_intent';
  PERFORM apply_private_balance(p_args->>'p_booking',payment,(p_args->>'p_gross')::integer,(p_args->>'p_fee')::integer);
 ELSIF p_kind='booking' THEN
  PERFORM apply_paid_private_booking(payment,(p_args->>'p_user_id')::uuid,p_args->>'p_trainer_id',p_args->>'p_day',p_args->>'p_time',(p_args->>'p_gross_cents')::integer,(p_args->>'p_fee_cents')::integer,(p_args->>'p_trainer_cents')::integer,(p_args->>'p_hold_id')::uuid);
 ELSIF p_kind='live' THEN
  PERFORM apply_paid_live_checkout(payment,(p_args->>'p_user_id')::uuid,(p_args->>'p_session_id')::uuid,(p_args->>'p_gross_cents')::integer,(p_args->>'p_fee_cents')::integer);
 ELSE RAISE EXCEPTION 'Unknown settlement'; END IF;
 IF p_refunded>0 THEN PERFORM apply_checkout_refund(payment,p_refunded,false); END IF;
END $$;
REVOKE ALL ON FUNCTION settle_paid_checkout(text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION settle_paid_checkout(text,jsonb,integer) TO service_role;


-- REVIEWED SOURCE: 0055_contact_delivery.sql ORIGINAL SHA256 b4c979d8f6716e5924d95084f5de104ad066ad58d1ba24d0e374b282a142b807
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


-- REVIEWED SOURCE: 0056_friendship_contract.sql ORIGINAL SHA256 dfc899ec1a57267289544cc52ef087324a0e28fcb05e462e11b28a83556b85ff
-- Preserve current friend-request/unfriend UI and any already-applied manual data.
CREATE TABLE IF NOT EXISTS friend_requests (
 requester_id uuid NOT NULL REFERENCES auth.users(id),recipient_id uuid NOT NULL REFERENCES auth.users(id),
 requester_name text NOT NULL,recipient_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(requester_id,recipient_id),CHECK(requester_id<>recipient_id));
CREATE TABLE IF NOT EXISTS legacy_friendship_grants (
 user_id uuid NOT NULL,friend_id uuid NOT NULL,PRIMARY KEY(user_id,friend_id));
-- Grandfather existing partner messaging, without allowing new unilateral friend inserts.
-- HOSTED ADAPTATION: preserve only the existing mutually accepted messaging contract.
INSERT INTO legacy_friendship_grants SELECT f.user_id,f.friend_id FROM friendships f WHERE f.partner AND EXISTS(SELECT 1 FROM friendships b WHERE b.user_id=f.friend_id AND b.friend_id=f.user_id) ON CONFLICT DO NOTHING;
ALTER TABLE legacy_friendship_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_friendship_grants FROM PUBLIC,anon,authenticated;
GRANT ALL ON legacy_friendship_grants TO service_role;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON friend_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON friend_requests TO authenticated;
GRANT ALL ON friend_requests TO service_role;
DROP POLICY IF EXISTS friend_request_read ON friend_requests;
CREATE POLICY friend_request_read ON friend_requests FOR SELECT TO authenticated USING(auth.uid() IN(requester_id,recipient_id));
DROP POLICY IF EXISTS friend_request_read_guard ON friend_requests;
CREATE POLICY friend_request_read_guard ON friend_requests AS RESTRICTIVE FOR SELECT TO authenticated USING(auth.uid() IN(requester_id,recipient_id));
DROP POLICY IF EXISTS friend_request_insert ON friend_requests;
CREATE POLICY friend_request_insert ON friend_requests FOR INSERT TO authenticated WITH CHECK(requester_id=auth.uid() AND recipient_id<>auth.uid());
DROP POLICY IF EXISTS friend_request_delete ON friend_requests;
CREATE POLICY friend_request_delete ON friend_requests FOR DELETE TO authenticated USING(auth.uid() IN(requester_id,recipient_id));
CREATE OR REPLACE FUNCTION guard_friend_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.requester_id<>auth.uid() OR NEW.recipient_id=auth.uid() OR NOT account_can_act(auth.uid(),false)
 OR EXISTS(SELECT 1 FROM message_controls WHERE blocked AND ((user_id=NEW.requester_id AND other_id=NEW.recipient_id) OR (user_id=NEW.recipient_id AND other_id=NEW.requester_id))) THEN RAISE EXCEPTION 'Friend request unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('friend-request:'||auth.uid()::text));
 IF (SELECT count(*) FROM friend_requests WHERE requester_id=auth.uid() AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Friend request limit reached'; END IF;
 SELECT name INTO NEW.requester_name FROM profiles WHERE id=NEW.requester_id;
 SELECT name INTO NEW.recipient_name FROM profiles WHERE id=NEW.recipient_id;
 IF NEW.requester_name IS NULL OR NEW.recipient_name IS NULL THEN RAISE EXCEPTION 'Unknown account'; END IF;
 NEW.created_at=now(); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_friend_request ON friend_requests;
CREATE TRIGGER guard_friend_request BEFORE INSERT ON friend_requests FOR EACH ROW EXECUTE FUNCTION guard_friend_request();
DROP POLICY IF EXISTS no_unilateral_friendships ON friendships;
CREATE POLICY no_unilateral_friendships ON friendships AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
CREATE OR REPLACE FUNCTION guard_friendship_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF current_setting('role',true)='authenticated' AND (NEW.user_id,NEW.friend_id,NEW.friend_name) IS DISTINCT FROM (OLD.user_id,OLD.friend_id,OLD.friend_name) THEN RAISE EXCEPTION 'Friend identities are immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_friendship_identity ON friendships;
CREATE TRIGGER guard_friendship_identity BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION guard_friendship_identity();
CREATE OR REPLACE FUNCTION accept_friend_request(p_requester_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r friend_requests%ROWTYPE; me uuid := auth.uid();
BEGIN
 IF me IS NULL OR p_requester_id=me OR NOT account_can_act(me,false) THEN RAISE EXCEPTION 'Invalid account'; END IF;
 SELECT * INTO r FROM friend_requests WHERE requester_id=p_requester_id AND recipient_id=me FOR UPDATE;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM friendships WHERE user_id=me AND friend_id=p_requester_id) AND EXISTS(SELECT 1 FROM friendships WHERE user_id=p_requester_id AND friend_id=me) THEN RETURN; END IF;
  RAISE EXCEPTION 'No incoming request';
 END IF;
 IF EXISTS(SELECT 1 FROM message_controls WHERE blocked AND ((user_id=me AND other_id=p_requester_id) OR (user_id=p_requester_id AND other_id=me))) THEN RAISE EXCEPTION 'Account is blocked'; END IF;
 INSERT INTO friendships(user_id,friend_id,friend_name) VALUES(me,p_requester_id,r.requester_name),(p_requester_id,me,r.recipient_name) ON CONFLICT DO NOTHING;
 DELETE FROM friend_requests WHERE (requester_id=p_requester_id AND recipient_id=me) OR (requester_id=me AND recipient_id=p_requester_id);
END $$;
CREATE OR REPLACE FUNCTION unfriend_user(p_friend_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR auth.uid()=p_friend_id THEN RAISE EXCEPTION 'Invalid friend'; END IF;
 DELETE FROM friendships WHERE (user_id=auth.uid() AND friend_id=p_friend_id) OR (user_id=p_friend_id AND friend_id=auth.uid());
 DELETE FROM legacy_friendship_grants WHERE (user_id=auth.uid() AND friend_id=p_friend_id) OR (user_id=p_friend_id AND friend_id=auth.uid());
 DELETE FROM friend_requests WHERE (requester_id=auth.uid() AND recipient_id=p_friend_id) OR (requester_id=p_friend_id AND recipient_id=auth.uid());
 -- Conversation history is preserved for its participants and safety reports.
END $$;
CREATE OR REPLACE FUNCTION remove_reverse_friendship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF pg_trigger_depth()=1 THEN
  DELETE FROM friendships WHERE user_id=OLD.friend_id AND friend_id=OLD.user_id;
  DELETE FROM legacy_friendship_grants WHERE (user_id=OLD.user_id AND friend_id=OLD.friend_id) OR (user_id=OLD.friend_id AND friend_id=OLD.user_id);
 END IF; RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS remove_reverse_friendship ON friendships;
CREATE TRIGGER remove_reverse_friendship AFTER DELETE ON friendships FOR EACH ROW EXECUTE FUNCTION remove_reverse_friendship();
CREATE OR REPLACE FUNCTION public.can_send_message(p_sender uuid,p_recipient uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_sender=auth.uid() AND p_sender<>p_recipient AND account_can_act(p_sender)
 AND account_can_act(p_recipient,false) AND NOT EXISTS(SELECT 1 FROM message_controls WHERE blocked AND
 ((user_id=p_sender AND other_id=p_recipient) OR (user_id=p_recipient AND other_id=p_sender)))
 AND (EXISTS(SELECT 1 FROM friendships f WHERE f.user_id=p_sender AND f.friend_id=p_recipient
  AND (EXISTS(SELECT 1 FROM friendships back WHERE back.user_id=p_recipient AND back.friend_id=p_sender)
   OR (f.partner AND EXISTS(SELECT 1 FROM legacy_friendship_grants g WHERE g.user_id=p_sender AND g.friend_id=p_recipient))))
 OR trainer_is_eligible(p_recipient,false)
 OR (EXISTS(SELECT 1 FROM profiles WHERE id=p_sender AND role='trainer') AND EXISTS(SELECT 1 FROM messages WHERE sender_id=p_recipient AND recipient_id=p_sender)))
$$;
REVOKE ALL ON FUNCTION accept_friend_request(uuid),unfriend_user(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION accept_friend_request(uuid),unfriend_user(uuid) TO authenticated;
INSERT INTO launch_schema_versions(version) VALUES('0056_friendship_contract') ON CONFLICT DO NOTHING;
-- A coach owns their Trybe without having to join it as a member.
CREATE OR REPLACE FUNCTION can_see_trybe(_trybe text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND (
  EXISTS(SELECT 1 FROM trybe_memberships WHERE user_id=auth.uid() AND trybe_id=_trybe)
  OR (_trybe='coach-'||auth.uid()::text AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer')))
$$;
DROP POLICY IF EXISTS friend_request_delete_guard ON friend_requests;
CREATE POLICY friend_request_delete_guard ON friend_requests AS RESTRICTIVE FOR DELETE TO authenticated USING(auth.uid() IN(requester_id,recipient_id));
DROP POLICY IF EXISTS friendship_update_guard ON friendships;
CREATE POLICY friendship_update_guard ON friendships AS RESTRICTIVE FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS friendship_delete_guard ON friendships;
CREATE POLICY friendship_delete_guard ON friendships AS RESTRICTIVE FOR DELETE TO authenticated USING(user_id=auth.uid());


-- REVIEWED SOURCE: 0057_hosted_compatibility.sql ORIGINAL SHA256 6635c180aec3b3660441c4c69f206a6463e8b5b0a0f8268f764a66b7ff3a3001
-- Targeted compatibility for the inspected mixed hosted schema (978 rows, 2026-10-27).
-- No table drops, account/media/message/financial-row changes, or paid-state backfills.
-- Existing stricter column grants, manual FK cascades, membership checks and extra
-- comments/trybes tables remain in place. Apply ONLY through the reviewed staging path.

-- PUBLIC role checks in approved-video/posts RLS must be executable by readers.
-- Preserve the hosted has_role implementation, empty search_path and ownership.
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO anon,authenticated,service_role;

-- RLS never protects TRUNCATE. Remove inherited client maintenance capabilities,
-- including on dormant tables. Keep ordinary DML and column ACLs unchanged.
DO $acl$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
  EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM PUBLIC,anon,authenticated',r.relname);
  IF current_setting('server_version_num')::integer>=170000 THEN
   EXECUTE format('REVOKE MAINTAIN ON public.%I FROM PUBLIC,anon,authenticated',r.relname);
  END IF;
 END LOOP;
END $acl$;
-- Confirmed unsafe defaults for postgres-owned public tables. Leave Supabase
-- role/schema ownership and service_role defaults intact.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 REVOKE TRUNCATE,REFERENCES,TRIGGER ON TABLES FROM anon,authenticated;
DO $defaults$ BEGIN
 IF current_setting('server_version_num')::integer>=170000 THEN
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN ON TABLES FROM anon,authenticated;
 END IF;
END $defaults$;

-- Restore missing launch read/notification contracts without reopening paused features.
GRANT SELECT ON public.trainer_accounts,public.trainer_earnings,public.waitlist_entries TO authenticated;
GRANT SELECT ON public.reviews TO anon,authenticated;
GRANT INSERT ON public.reviews TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.push_reminders TO authenticated;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.push_reminders'::regclass AND polname='own reminders') THEN
  CREATE POLICY "own reminders" ON public.push_reminders AS PERMISSIVE FOR ALL TO "authenticated" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.push_subscriptions'::regclass AND polname='own subs') THEN
  CREATE POLICY "own subs" ON public.push_subscriptions AS PERMISSIVE FOR ALL TO "authenticated" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.reviews'::regclass AND polname='reviews_insert') THEN
  CREATE POLICY reviews_insert ON public.reviews AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((author_id = auth.uid()));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.reviews'::regclass AND polname='reviews_read') THEN
  CREATE POLICY reviews_read ON public.reviews AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.trainer_accounts'::regclass AND polname='own or admin read') THEN
  CREATE POLICY "own or admin read" ON public.trainer_accounts AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.trainer_earnings'::regclass AND polname='own or admin read') THEN
  CREATE POLICY "own or admin read" ON public.trainer_earnings AS PERMISSIVE FOR SELECT TO "authenticated" USING ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM trainer_accounts a
  WHERE ((a.user_id = auth.uid()) AND ((a.slug = trainer_earnings.trainer_slug) OR ((a.user_id)::text = trainer_earnings.trainer_slug)))))));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.waitlist_entries'::regclass AND polname='admin read') THEN
  CREATE POLICY "admin read" ON public.waitlist_entries AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='avatars owner delete') THEN
  CREATE POLICY "avatars owner delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='avatars owner insert') THEN
  CREATE POLICY "avatars owner insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='avatars owner update') THEN
  CREATE POLICY "avatars owner update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='avatars public read') THEN
  CREATE POLICY "avatars public read" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'avatars'::text));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='videos own delete') THEN
  CREATE POLICY "videos own delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'videos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='videos own read') THEN
  CREATE POLICY "videos own read" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'videos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='videos own upload') THEN
  CREATE POLICY "videos own upload" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'videos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
 END IF;
END $policy$;

-- The manual inquiry policy has an incorrectly correlated subquery and depends on
-- a profile SELECT that RLS denies for another account. Reuse its existing name;
-- the definer helper checks auth identity, mutual friendship/eligible inquiry,
-- blocks and account restrictions. Retain the separate RESTRICTIVE insert guard.
DO $inquiry$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.messages'::regclass
 AND polname='Trainer inquiries may be sent without friendship') THEN
  ALTER POLICY "Trainer inquiries may be sent without friendship" ON public.messages
   WITH CHECK(public.can_send_message(sender_id,recipient_id));
  -- 0051's additional permissive policy is redundant when the manual policy exists.
  DROP POLICY IF EXISTS launch_trainer_inquiries ON public.messages;
 END IF;
END $inquiry$;

-- Permissive policies combine with OR. Preserve the hosted rule that an already
-- accepted friendship cannot be bypassed to create a redundant request.
DROP POLICY IF EXISTS friend_request_insert_guard ON public.friend_requests;
CREATE POLICY friend_request_insert_guard ON public.friend_requests AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(requester_id=auth.uid() AND recipient_id<>auth.uid()
 AND NOT EXISTS(SELECT 1 FROM public.friendships f WHERE f.user_id=auth.uid() AND f.friend_id=friend_requests.recipient_id));

-- Retain the hosted announcement RPC's input validation and empty search_path,
-- while writing the launch official channel/flag and moderation audit together.
CREATE OR REPLACE FUNCTION public.publish_official_announcement(p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $publish$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 IF length(trim(coalesce(p_body,''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Invalid announcement length'; END IF;
 INSERT INTO public.posts(author_id,author_name,trybe,kind,text,visibility,official)
 VALUES(auth.uid(),'Tryumph Gym','official','Announcement',trim(p_body),'public',true) RETURNING id INTO result;
 INSERT INTO public.moderation_actions(actor_id,target_type,target_id,action)
 VALUES(auth.uid(),'post',result::text,'official_publish');
 RETURN result;
END $publish$;

-- Accommodate both historical announcements and the launch official flag/channel.
-- Preserve the old trigger binding and its function identity for existing clients.
CREATE OR REPLACE FUNCTION public.guard_official_posts()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $official$
BEGIN
 IF NEW.official OR NEW.trybe IN ('official','announcements') OR NEW.author_name='Tryumph Gym' OR NEW.kind='Announcement' THEN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Official announcements require admin access'; END IF;
  NEW.author_id=auth.uid(); NEW.author_name='Tryumph Gym'; NEW.kind='Announcement'; NEW.visibility='public';
  IF NEW.official THEN NEW.trybe='official'; ELSE NEW.trybe='announcements'; END IF;
 END IF;
 RETURN NEW;
END $official$;
CREATE OR REPLACE FUNCTION public.protect_official_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $official$
BEGIN
 IF NEW.official OR NEW.trybe='official' THEN
  IF current_setting('role',true)='authenticated' AND NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Official authorship is reserved'; END IF;
  IF NOT NEW.official OR NEW.trybe<>'official' THEN RAISE EXCEPTION 'Invalid official post'; END IF;
  NEW.author_name='Tryumph Gym';
 ELSIF NEW.trybe='announcements' THEN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Official announcements require admin access'; END IF;
  NEW.author_name='Tryumph Gym';
 END IF;
 RETURN NEW;
END $official$;

-- Add the missing reviewer FK without scanning/deleting historical videos.
-- Separate read-only orphan check and VALIDATE are required in staging.
DO $fk$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.trainer_videos'::regclass AND conname='trainer_videos_reviewed_by_fkey') THEN
  ALTER TABLE public.trainer_videos ADD CONSTRAINT trainer_videos_reviewed_by_fkey FOREIGN KEY(reviewed_by) REFERENCES auth.users(id) NOT VALID;
 END IF;
END $fk$;
INSERT INTO public.launch_schema_versions(version) VALUES('0057_hosted_compatibility') ON CONFLICT DO NOTHING;


DO $after$ DECLARE r record; n bigint; digest text; BEGIN
 FOR r IN SELECT * FROM launch_preservation ORDER BY relation_name LOOP
  EXECUTE format($digest$SELECT count(*),md5(coalesce(string_agg(h,'' ORDER BY h),'')) FROM (SELECT md5((SELECT jsonb_object_agg(k,v) FROM jsonb_each(to_jsonb(t)) j(k,v) WHERE k=ANY($1))::text) h FROM public.%I t) d$digest$,r.relation_name) INTO n,digest USING r.columns;
  IF n<>r.row_count OR digest IS DISTINCT FROM r.checksum THEN RAISE EXCEPTION 'Existing data changed in %. Transaction rolled back.',r.relation_name; END IF;
 END LOOP;
END $after$;
COMMIT;
-- Run 02_validate_staging.sql next; do not deploy or run provider workers yet.
