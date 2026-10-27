-- READ ONLY: one SELECT; no DDL/DML, application-function calls, or business rows.
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
ORDER BY section,object_name;
