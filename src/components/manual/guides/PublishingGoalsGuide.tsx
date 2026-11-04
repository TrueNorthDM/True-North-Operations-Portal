// The Publishing Goals guide (owner, 4 November 2026). Written from the built
// dashboard (public/boards.html, framed by /ops/publishing). That dashboard is
// a static page outside the React tree, so it has no portal component to
// picture: this guide has no pictures, on purpose.

import { GuideHeader, Step, Tip } from '../GuideParts'

export function PublishingGoalsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Tools" title="Publishing Goals" minutes={4}>
        Publishing Goals shows how many pages the AAAF, HFA and Bessemeters Publishing boards published against their targets, language by language, read from the Publishing column in Monday. It is open to the levels and teams a Super Admin picks for it on Access levels.
      </GuideHeader>

      <Step n={1} title="Open Publishing Goals">
        <p className="m-0">On the left rail, click <strong>Tools</strong>, then <strong>Publishing Goals</strong> under Operations. If it is not in the list, your team does not have it yet: ask a Super Admin.</p>
      </Step>

      <Step n={2} title="Check how fresh the numbers are">
        <p className="m-0">Under the title, <strong>Updated</strong> says how long ago the data was read. The dashboard reads a copy the portal refreshes by itself every four hours, so it opens at once and you never wait for Monday. The small round button beside it explains the schedule.</p>
      </Step>

      <Step n={3} title="Pick the period">
        <p className="m-0">Next to Updated, choose the period: <strong>this week</strong> (where it opens), <strong>last week</strong>, <strong>last 2 weeks</strong>, <strong>this month</strong>, <strong>last quarter</strong>, <strong>all time</strong> or <strong>custom</strong>, which asks for a start and an end date. Every number on the page follows it.</p>
      </Step>

      <Step n={4} title="Narrow it down">
        <p className="m-0">Under the period, <strong>Board</strong> shows one board or all of them, <strong>Publisher</strong> one person, and <strong>Search</strong> finds an item by its name or the person on it.</p>
      </Step>

      <Step n={5} title="Read the three cards at the top">
        <p className="m-0"><strong>Total Items - Not Published</strong> counts what is still in the workflow, <strong>Completed</strong> what was published in the period and <strong>Staged to Publish</strong> what is queued to go out. <strong>Avg time / stage</strong> is how many business days an item spends in each stage. Click one of the first three to see the items behind it; the round &quot;i&quot; on each card says how it is counted.</p>
      </Step>

      <Step n={6} title="Follow the goals, language by language">
        <p className="m-0">In <strong>Goals progress</strong>, three totals come first: <strong>Targeted languages</strong> (pages published in the languages that have a target), <strong>Target</strong> and <strong>Completion</strong>. Below them, each board lists its languages with a bar: how many pages were published out of the target, and the percentage. A board that works in two-week cycles shows which cycle the period covers.</p>
        <p className="m-0">Click a language to see the pages published in it. Pages in languages with no target sit on their own line, <strong>Other languages (no target)</strong>, and do not count toward the goal; you can click that line too.</p>
      </Step>

      <Step n={7} title="Look through the items">
        <p className="m-0">At the bottom, the <strong>Items list</strong> shows every item with its project, language, current stage, the person on it, the time in that stage and the last update. Click an item to see its history, stage by stage.</p>
      </Step>

      <Step n={8} title="Take the numbers with you">
        <p className="m-0">On the Goals progress card, <strong>Export PDF</strong> and <strong>Export CSV</strong> save the period&apos;s goals as a document or a spreadsheet.</p>
      </Step>

      <Tip title="Where do the targets come from?">Targets and publishers are set in Company settings, under Publishing targets, by whoever has that section. A change there shows on the dashboard the next time it loads.</Tip>
    </div>
  )
}
