#!/usr/bin/env python3
"""Generate an offline founder guide from reviewed repository text and exact SQL.
No network, database connection, secrets or environment-file reads. PDF requires reportlab.
"""
import argparse, hashlib, html, json, re, subprocess, textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
 ('Inspection: application metadata (read-only)', 'docs/launch/inspect-hosted-schema.sql'),
 ('Inspection: platform bindings (read-only)', 'docs/launch/reconciliation/03_inspect_platform_bindings.sql'),
 ('Original-snapshot preflight (read-only; matching unreconciled staging only)', 'docs/launch/reconciliation/00_readonly_preflight.sql'),
 ('Foundation apply (matching unreconciled staging only)', 'docs/launch/reconciliation/01_stage_apply.sql'),
 ('Foundation validation (includes foreign-key validation)', 'docs/launch/reconciliation/02_validate_staging.sql'),
 ('Foundation confirmation', 'docs/launch/confirmation.sql'),
 ('Programs module: apply once after foundation', 'migrations/0058_workout_program_builder.sql'),
 ('Polls module: apply once after foundation/program review', 'migrations/0059_trybe_polls.sql'),
 ('Optional memberships: 90/10; apply after 0059', 'migrations/0060_creator_memberships.sql'),
 ('Subscriber content and timed releases', 'migrations/0061_creator_content.sql'),
 ('Inclusive discovery and private digital guides', 'migrations/0062_discovery_and_downloads.sql'),
 ('Everyday discovery and private workout feedback', 'migrations/0063_everyday_discovery.sql'),
 ('Gated community photos and feed advertising', 'migrations/0064_community_photos_and_ads.sql'),
 ('Marketplace postchecks (read-only)', 'docs/launch/marketplace-postchecks.sql'),
]
POSTCHECK = '''BEGIN READ ONLY;
SELECT c.relname,c.relrowsecurity FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN (
 'program_drafts','program_editions','program_orders','program_enrollments',
 'program_progress','program_images','program_usage','trybe_polls',
 'trybe_poll_options','trybe_poll_ballots','trybe_poll_choices','trybe_poll_notice_jobs')
ORDER BY c.relname;
SELECT enabled,commission_bps,terms_version,approved_at FROM public.program_commerce;
SELECT
 NOT has_function_privilege('authenticated',
 'public.confirm_program_order(uuid,text,text,integer,integer,integer)','EXECUTE')
 AS program_settlement_server_only,
 NOT has_table_privilege('authenticated','public.trybe_poll_ballots','SELECT')
 AS individual_ballots_private,
 NOT has_table_privilege('authenticated','public.trybe_poll_choices','SELECT')
 AS individual_choices_private,
 NOT has_table_privilege('authenticated','public.trybe_poll_ballots','TRUNCATE')
 AS client_ballot_truncate_denied,
 NOT has_function_privilege('authenticated',
 'public.deliver_trybe_poll_notices(integer)','EXECUTE') AS fanout_server_only;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets
WHERE id IN ('trainer-certificates','program-demonstrations');
SELECT column_name,data_type,column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name='notification_preferences'
AND column_name='poll_updates';
-- These counts are operational queue counts, not private voter identities.
SELECT count(*) AS pending_poll_notice_jobs FROM public.trybe_poll_notice_jobs
WHERE finished_at IS NULL;
ROLLBACK;
'''

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

def inline(text):
    text=html.escape(text)
    text=re.sub(r'`([^`]+)`',r'<code>\1</code>',text)
    text=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',text)
    return text

def md_html(text):
    out=[]; paragraph=[]; table=[]
    def flush():
        if paragraph:out.append('<p>'+inline(' '.join(paragraph))+'</p>');paragraph.clear()
        if table:
            rows=[]
            for i,line in enumerate(table):
                if re.match(r'^\|[\s:|\-]+\|$',line):continue
                tag='th' if i==0 else 'td'
                rows.append('<tr>'+''.join(f'<{tag}>{inline(c.strip())}</{tag}>' for c in line.strip('|').split('|'))+'</tr>')
            out.append('<div class="table-scroll"><table>'+''.join(rows)+'</table></div>');table.clear()
    for line in text.splitlines():
        match=re.match(r'^(#{1,4}) (.*)',line)
        if match:
            flush();level=len(match[1]);out.append(f'<h{level}>{inline(match[2])}</h{level}>')
        elif line.startswith('|'):
            if paragraph:flush()
            table.append(line)
        elif not line.strip():flush()
        elif re.match(r'^(- |\d+\. )',line):
            flush();out.append('<p class="step">'+inline(line)+'</p>')
        else:paragraph.append(line)
    flush();return '\n'.join(out)

def pdf(path, narrative, scripts):
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    mono=Path('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf')
    if mono.exists():pdfmetrics.registerFont(TTFont('GuideMono',str(mono)))
    regular=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    bold=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
    body_font='Helvetica'
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont('GuideText',str(regular)))
        pdfmetrics.registerFont(TTFont('GuideTextBold',str(bold)))
        pdfmetrics.registerFontFamily('GuideText',normal='GuideText',bold='GuideTextBold',italic='GuideText',boldItalic='GuideTextBold')
        body_font='GuideText'
    styles=getSampleStyleSheet()
    if body_font=='GuideText':
        for name in ['Normal','BodyText']:styles[name].fontName='GuideText'
        for name in ['Title','Heading1','Heading2','Heading3']:styles[name].fontName='GuideTextBold'
    styles.add(ParagraphStyle(name='GuideBody',fontName=body_font,fontSize=9,leading=13,spaceAfter=7))
    styles.add(ParagraphStyle(name='GuideCode',fontName='GuideMono' if mono.exists() else 'Courier',fontSize=7,leading=8.5,spaceAfter=0))
    styles['Heading1'].textColor=HexColor('#123b54');styles['Heading2'].textColor=HexColor('#123b54')
    story=[]; block=[]
    def para(value):
        # ReportLab's Paragraph supports <b>, not semantic HTML <strong>.
        value=inline(value).replace('<strong>','<b>').replace('</strong>','</b>').replace('<code>','<font name="Courier">').replace('</code>','</font>')
        return Paragraph(value,styles['GuideBody'])
    def flush():
        if block:story.append(para(' '.join(block)));block.clear()
    for line in narrative.splitlines():
        match=re.match(r'^(#{1,4}) (.*)',line)
        if match:
            flush();story.append(Paragraph(html.escape(match[2]),styles['Heading'+str(min(len(match[1]),3))]))
        elif not line.strip():flush()
        elif line.startswith('|'):
            flush()
            if not re.match(r'^\|[\s:|\-]+\|$',line):story.append(para(line.strip('|').replace('|','  —  ')))
        elif re.match(r'^(- |\d+\. )',line):flush();story.append(para(line))
        else:block.append(line)
    flush()
    for title, source, code, digest in scripts:
        story.extend([PageBreak(),Paragraph(html.escape(title),styles['Heading1']),para('Source: '+source),para('SHA256: '+digest),para('Staging-only reference. Copy executable SQL from the HTML or Markdown guide, not these visually wrapped PDF lines. Use only the case and sequence described in section 5.')])
        lines=[]
        for line in code.expandtabs(2).splitlines():
            lines.extend(textwrap.wrap(line,width=113,replace_whitespace=False,drop_whitespace=False,break_long_words=True,break_on_hyphens=False) or [''])
        # Chunk the flowable so long functions and catalog snapshots split across pages.
        for start in range(0,len(lines),55):story.append(Preformatted('\n'.join(lines[start:start+55]),styles['GuideCode']))
    def footer(canvas, doc):
        canvas.setFont('Helvetica',7);canvas.setFillColor(HexColor('#53606b'))
        canvas.setFont('GuideText' if body_font=='GuideText' else 'Helvetica',6)
        canvas.drawString(36,22,'Tryumph Gym · November 2, 2026 · Development / staging guide · No production execution authorized')
        canvas.drawRightString(576,22,str(doc.page))
    SimpleDocTemplate(str(path),pagesize=(612,792),rightMargin=36,leftMargin=36,topMargin=36,bottomMargin=36,title='Tryumph Gym — Complete Founder Guide',author='Tryumph Gym').build(story,onFirstPage=footer,onLaterPages=footer)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output-dir',type=Path,required=True);ap.add_argument('--verification',type=Path);ap.add_argument('--no-pdf',action='store_true');args=ap.parse_args()
    args.output_dir.mkdir(parents=True,exist_ok=True)
    sha=git('rev-parse','HEAD');dirty=git('status','--porcelain')
    narrative=(ROOT/'docs/launch/FOUNDER_GUIDE.md').read_text()
    for source in ['FOUNDER_HANDOFF.md','MARKETPLACE_IMPLEMENTATION.md','MARKETPLACE_VALIDATION.md']:
        narrative+='\n\n## Current source: '+source+'\n\n'+(ROOT/'docs/launch'/source).read_text()
    narrative+='\n\n## Download provenance and actual validation\n\n'
    narrative+=f'Generated from branch `{git("branch","--show-current")}`, HEAD `{sha}`. Working tree '+('contained changes at generation time; inspect the changed-file inventory below.' if dirty else 'was clean at generation time.')+'\n\n'
    if args.verification:
        verification=json.loads(args.verification.read_text())
        narrative+='| Check | Actual recorded result |\n| --- | --- |\n'
        for k,v in verification.items():narrative+=f'| {k} | {str(v).replace(chr(124),"/")} |\n'
    else:narrative+='No new verification record supplied to the generator. Consult section 7 and the dated source evidence; generation itself does not run tests.\n'
    narrative+='\n## Changed-file inventory\n\nProgram builder baseline: `f4dd4ea`; program commits: `e03148d`, `2a8e1d2`. The inventory below includes all changed paths since that baseline, including the guide and polls. Earlier launch work is summarized in sections 2–3 and the source references.\n\n'
    changed=git('diff','--name-only','f4dd4ea','HEAD').splitlines()
    changed+=git('diff','--name-only','HEAD').splitlines()
    changed+=git('ls-files','--others','--exclude-standard').splitlines()
    for name in sorted(set(changed)):
        if not name.startswith(('artifacts/','attachments/')):narrative+='- `'+name+'`\n'
    narrative+='\n## Historical reconciliation and provider references\n\nThe following authoritative references retain their original dates. Their old test counts are historical. Current checks are in the validation table above. No raw accounts, messages, payments or private environment files are included.\n\n'
    for name in ['docs/launch/reconciliation/findings.md','docs/launch/reconciliation/validation.md','docs/launch/RESEND_SETUP.md','docs/launch/CONFIGURATION.md']:
        narrative+='\n### Source reference: '+name+'\n\n'+(ROOT/name).read_text()+'\n'
    scripts=[]
    for i,(title,name) in enumerate(FILES,1):
        code=(ROOT/name).read_text();digest=hashlib.sha256(code.encode()).hexdigest();scripts.append((f'SQL {i}: {title}',name,code,digest))
    scripts.append((f'SQL {len(FILES)+1}: Program/poll postchecks (read-only)','Guide postcheck query',POSTCHECK,hashlib.sha256(POSTCHECK.encode()).hexdigest()))
    base='Tryumph-Founder-Guide-2026-11-02'
    markdown=narrative+'\n\n## Complete active SQL appendices\n\nThese are conditional staging steps, not a command to execute every script on any database. Review section 5 first.\n'
    for title,name,code,digest in scripts:markdown+=f'\n### {title}\n\nSource: `{name}`\n\nSHA256: `{digest}`\n\n````sql\n{code.rstrip()}\n````\n'
    (args.output_dir/(base+'.md')).write_text(markdown)
    cards=[]
    for i,(title,name,code,digest) in enumerate(scripts,1):
        cards.append(f'<details id="sql-{i}"><summary>{html.escape(title)}</summary><p><code>{html.escape(name)}</code><br>SHA256: <code>{digest}</code></p><button type="button" onclick="copySQL(\'code-{i}\',this)">Copy complete SQL</button><pre><code id="code-{i}">{html.escape(code)}</code></pre></details>')
    document='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tryumph Gym — Complete Founder Guide</title><style>
body{font:16px/1.65 system-ui,sans-serif;background:#f4f7f8;color:#172d3b;margin:0}main{max-width:1000px;margin:auto;background:white;padding:32px}h1,h2,h3{line-height:1.2;color:#123b54;scroll-margin-top:80px}h2{margin-top:40px;border-top:1px solid #dce5e9;padding-top:24px}a{color:#075d8b}.top{background:#123b54;color:white;padding:12px;position:sticky;top:0;z-index:1;text-align:center}.top a{color:white;margin:0 10px}code{font:0.86em ui-monospace,monospace;overflow-wrap:anywhere}pre{background:#102c3e;color:#f0f6fa;padding:18px;overflow:auto;max-height:36rem;font:12px/1.6 ui-monospace,monospace}pre code{font:inherit;overflow-wrap:normal}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.9em}td,th{border:1px solid #dce5e9;padding:10px;text-align:left;vertical-align:top}th{background:#edf4f8}.step{padding-left:14px;border-left:3px solid #75a5bc}details{border:1px solid #c7d5df;border-radius:8px;padding:16px;margin:18px 0}summary{font-weight:700;cursor:pointer}button{background:#123b54;color:white;border:0;border-radius:6px;padding:10px 16px;cursor:pointer}.notice{border:2px solid #b88227;background:#fff7e7;padding:16px} @media(max-width:600px){main{padding:18px}h1{font-size:1.8rem}.top{position:static}.top a{display:inline-block}}@media print{.top,button{display:none}main{max-width:none;padding:0}pre{color:black;background:white;max-height:none;white-space:pre-wrap;overflow-wrap:anywhere}details{break-before:page}h2,h3,summary{break-after:avoid}}
</style></head><body><nav class="top"><strong>TRYUMPH GYM</strong><a href="#guide">Founder guide</a><a href="#sql">Complete SQL</a><a href="#sql-7">Programs</a><a href="#sql-8">Polls</a></nav><main id="guide"><div class="notice">Development and staging only. No production SQL, deployment, main merge, DNS changes or live payments are authorized by this guide. Choose the correct schema path before copying SQL.</div>'''
    document+=md_html(narrative)+'<h2 id="sql">Complete active SQL appendices</h2><p>These are conditional staging steps. Do not execute every script indiscriminately. See section 5. Copy buttons only copy text; they do not execute SQL or access Supabase.</p>'+''.join(cards)
    document+='''</main><script>async function copySQL(id,button){const text=document.getElementById(id).textContent;try{await navigator.clipboard.writeText(text);button.textContent='Copied complete SQL';}catch(e){const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(document.getElementById(id));selection.removeAllRanges();selection.addRange(range);button.textContent='SQL selected — copy with Ctrl/Cmd+C';}setTimeout(()=>button.textContent='Copy complete SQL',4000);}</script></body></html>'''
    (args.output_dir/(base+'.html')).write_text(document)
    if not args.no_pdf:pdf(args.output_dir/(base+'.pdf'),narrative,scripts)
    for suffix in ['html','md']+([] if args.no_pdf else ['pdf']):
        p=args.output_dir/(base+'.'+suffix);print(f'{p}: {p.stat().st_size:,} bytes')

if __name__=='__main__':main()
