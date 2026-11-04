// The Href Links guide (owner, 4 November 2026). Written from the built pages
// (app/(app)/seo/href-links, components/PageList and PageDetail) and the
// Monday handlers (lib/monday/handlers.ts); the pictures are the site list and
// a page with made-up pages. The overview's site cards are drawn by the page
// itself, not by a component, so they are not pictured.

import { GuideHeader, Picture, Step, Tip } from '../GuideParts'
import { HrefPageDetailPicture, HrefPageListPicture } from './HrefLinksPictures'

export function HrefLinksGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideHeader eyebrow="Tools" title="Href Links" minutes={5}>
        Href Links manages the hreflang tags of the Ask An Adventist Friend (AAAF) and Hope For Africa (HFA) WordPress sites: the tags that tell Google which pages are the same article in another language. Monday sends the links in, the portal writes the tags, and SEO 2 pastes them in WordPress. It is open to the levels and teams a Super Admin picks for it on Access levels.
      </GuideHeader>

      <Step n={1} title="Open Href Links">
        <p className="m-0">On the left rail, click <strong>Tools</strong>, then <strong>Href Links</strong> under SEO Tools. The overview has a card for each site with three numbers: <strong>Last 2 weeks</strong>, <strong>Total done</strong> and <strong>Remaining</strong>. When pages are waiting for their tags, a yellow line says how many <strong>are ready to apply</strong>, with a shortcut to each site.</p>
        <p className="m-0">Further down, <strong>How to do this</strong> lists the whole workflow step by step, each step tagged Auto or Manual and Monday, System or WordPress.</p>
      </Step>

      <Step n={2} title="What happens by itself">
        <p className="m-0">When a publishing item moves to Done, Monday sets its Href Links column to <strong>Run Link</strong>. The portal then creates the page if it is new and saves that language&apos;s link. Once every language of the page has a link, the portal writes the tags and sets the items in Monday to <strong>Apply Link</strong>, and Monday assigns SEO 2.</p>
      </Step>

      <Step n={3} title="Find the pages ready for you" picture={<Picture caption="The AAAF page list." height={620}><HrefPageListPicture /></Picture>}>
        <p className="m-0">Click a site&apos;s card. <strong>Overall progress</strong> counts the pages complete, and the list groups them: <strong>Ready to be worked on</strong> (every language has a link), <strong>On-going</strong>, <strong>Completed</strong> and <strong>Not relevant</strong>. Search by name, or filter by <strong>Status</strong> and <strong>Has language</strong>.</p>
        <p className="m-0"><strong>WP Dev</strong> and <strong>WP Live</strong>, at the top, open the site&apos;s WordPress.</p>
      </Step>

      <Step n={4} title="Copy the tags" picture={<Picture caption="One page: its links, its tags and its confirmations." height={760}><HrefPageDetailPicture /></Picture>}>
        <p className="m-0">Open a page from the list. <strong>Language URLs</strong> holds one link per language; you can correct one and click <strong>Save URLs</strong> (a link must be https and a page on the site). Under <strong>Generated hreflang tags</strong>, click <strong>Copy code</strong>.</p>
      </Step>

      <Step n={5} title="Paste them in WordPress">
        <p className="m-0">Log in to WordPress, open each language&apos;s page and click Edit. In the custom fields, choose <strong>custom_hreflang</strong> as the name, paste the tags as the value, then click <strong>Add Custom Field</strong>, or it will not save. Save the page. On AAAF, also remove any canonical tag and allow indexing in Yoast&apos;s Advanced settings.</p>
      </Step>

      <Step n={6} title="Mark each language live">
        <p className="m-0">In Monday, set the page&apos;s item for each language to Done. Monday tells the portal, which ticks that language under <strong>Confirmations</strong>; when all of them are ticked, the page shows <strong>Live on all languages</strong> and moves to Completed.</p>
        <p className="m-0">You can also tick <strong>Confirmed live</strong> on the page itself. That box only changes the portal: it does not change Monday, so mark the items Done there as well.</p>
      </Step>

      <Step n={7} title="Set a page aside, or remove it">
        <p className="m-0"><strong>Not relevant</strong> sets aside a page that should not have tags; it counts as done. <strong>Delete page</strong> removes it from the portal with its links and confirmations. Monday keeps its items, and setting Run Link on them creates the page again.</p>
      </Step>

      <Tip title="A page says it needs its tags pasted again?">A language was added or a live link changed after the tags were pasted. Copy the new tags, paste them in WordPress again, and confirm each language live.</Tip>
    </div>
  )
}
