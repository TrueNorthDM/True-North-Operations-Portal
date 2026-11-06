# Topic Studio: moving from the Artifact to the portal

For the owner, Jeannette and the SEO and Writing teams. Everything about this tool is written in English.

## What changes for each person

| Who | Before (Artifact) | Now (portal, Tools > SEO Tools > Topic Studio) |
| --- | --- | --- |
| SEO team | One Artifact file, topics saved by "Export for writer" files | Topics live in the portal, shared with writers from the topic header. Claude buttons are built in. |
| Writers | An offline copy fed by exported files | Open the shared topic and write in the Writer workshop. The draft saves itself and keeps version history. |
| Admins | Nothing | Settings (Super Admins): Claude features, limits, prompts, term list rules, clients, usage log. |

Writers never see grades or competitor length and term targets: only guidance in words.

## 1. Last import from the Artifact (the team)

1. In the Artifact, open each topic still in progress and use Export (the `.topic-studio.json` file). Export the ones whose draft is the newest, since an import brings the draft too.
2. In the portal, open Topic Studio and choose Import. The preview says each topic is New, Updated, Same or Older. Updated keeps the replaced copy in the topic's history. A file with no draft keeps the draft already in the portal.
3. After the import, open one topic per client and check: the terms, the questions, the draft and the captured competitors.
4. From the date everyone moves (below), nobody edits in the Artifact any more, or the two copies drift apart.

## 2. Walkthrough with Jeannette and the teams (20 minutes)

1. The list: clients, topics, New topic, Import.
2. Setup: client, task, keyphrases, terms to avoid, the four AI answers, the top 10 and AI-cited addresses. It saves as you type.
3. Competitors: paste a page, use the bookmark button or paste article text. The tool matches the page to its competitor by address.
4. Topic terms: relevance, groups, variants, bulk edits, build rules, removed terms. Click a term to see it in context.
5. Questions, Originality, Citations, Discussions: each fills the SEO brief.
6. Claude buttons: what each one does, that it can be wrong, that the wait is up to a minute, that there is a daily number per person.
7. Share with a writer (topic header), then the Writer workshop: draft, version history, panels, feedback on the term list.
8. The SEO brief: copy for Google Docs, Markdown, term list, terms CSV.
9. Settings (Super Admins): features and limits, prompts, term list rules, clients, usage log.

## 3. Date to use only the portal (the owner)

Pick the date, tell both teams, and after it the Artifact is read-only history. Suggested: after the first full week of real use with the trial topics (plan tasks p1-trial and p2-trial).

## 4. Release to production (the owner says go, then Claude)

Topic Studio runs on staging only until the owner says to release it. Order:

1. Run migrations 155, 156, 157 and 158 on the production database (as `supabase_admin`), each one then `db_protections_check()` must return `{}`.
2. Add the Anthropic key to the production server environment (`ANTHROPIC_API_KEY` in `/opt/tnportal/portal.env`) and restart the portal. Without it every Claude button rests and says it is not connected.
3. Promote the tested commit with "Promote to production". One deploy at a time.
4. Check: sign in, open Topic Studio, import one file, run one Claude button, open a shared topic as a writer.
5. Grant the tool to the teams on Admin > Access levels if their team rows were not carried over (the migration seeds the SEO and Writers team lists).

Rollback: the portal code without migrations 155 to 158 simply has no Topic Studio data. To pull the tool back, remove the team rows for both tools on Access levels; topics stay in the database.

## 5. Retire the offline writer file (the team)

After the date: delete the offline writer copy from the shared drive, and keep the Artifact as an archive (do not delete it). Tell writers where the portal link is.

## Costs and limits

Claude is billed per use. The defaults are 50 runs per person per day (Super Admins exempt), a 15 second wait before the same feature runs again, and the most expensive models blocked. Change them in Settings. The usage log lists every run with who, topic, feature, model and tokens.
