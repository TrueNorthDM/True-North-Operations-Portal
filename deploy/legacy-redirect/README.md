# The old address

`truenorthoperationsportal.vercel.app` was the portal until the move on
5 October 2026. Links to it live on in PDFs already sent to clients, so the
Vercel project `true_north_operations_portal` stays, serving only this folder:
every path and query goes to the same place on `https://truenorthportal.online`
(308). No portal code, no settings, no scheduled jobs.

Deploy it (only needed to change the redirect), from this folder:

    VERCEL_ORG_ID=team_MGtTHRyqww5d9HxsLNDe3tUU VERCEL_PROJECT_ID=prj_2uLEz5NtJpXpO1azEnsiwZYOjr6S \
      npx vercel@53 deploy --prod --yes

**Gone since 20 October 2026.** The Vercel project was deleted and the owner
chose not to recreate it, so the old address answers DEPLOYMENT_NOT_FOUND and
links to it in old PDFs no longer lead to the portal. The uptime check no longer
looks at it. These files stay in case the redirect is ever wanted again.
