# Jester's Privilege Website: v1 Spec

Agreed with the Jesters on 2026-10-28 after a grilling session. Vocabulary follows `GLOSSARY.md`; decisions with lasting consequences are recorded in `docs/adr/`. Ideas deliberately deferred live in `LATER.md`.

## Problem Statement

Jester's Privilege is a new weekly theology-and-humor podcast by three Jesters (Dan Collins, Michael Belmear, and Aaron Canen) of Redeemer Church in Bozeman. Episode 1, on Celebrity Pastors, had been recorded but not yet published (it went out on 2026-11-03). The show has no home on the web: no place to send people from Instagram, nowhere to explain the court-jester idea behind the show, no archive of Episodes, and no way for listeners to send in Questions or Confessions.

Most podcast sites are thin landing pages that rush visitors to "listen on Spotify." The Jesters want more than that: a site that looks and feels like entering a king's court or a cathedral, rooted in real history, substantive enough that people enjoy spending time there, and built well enough that updating it later is easy. It must look great on phones, because most visitors arrive from Instagram. Nobody should ever have to touch the site when an Episode is published.

## Solution

A fast, static, mobile-first website at `jestersprivilegepodcast.com` that is both the show's front door and a place to linger:

- **Home** invites visitors in: the jester story as hero copy, the latest Episode, a glimpse of the Fools' Gallery, and the Jesters.
- **Episodes** is a "hymnal index" archive of every Episode, playable in place.
- **Episode pages** carry the player, Show notes, and an interactive Transcript.
- **The Fools' Gallery** tells the history of court jesters and holy fools as a timeline, each Fool shown with their public-domain painting.
- **About** explains why the show is called "Jester's Privilege", introduces the Jesters, and states what the show believes.
- **Speak Freely** lets listeners send Questions, Confessions, and Topic ideas.
- A **persistent player** docked at the bottom keeps playing while visitors browse.

Episodes come from the Spreaker podcast feed and appear automatically. The visual language follows one principle: **modern construction, deliberate historical callbacks**. The structure is clean and contemporary, and history appears in a few chosen places: decree-style headlines, an illuminated drop cap, fleuron rules, arched portrait frames, heraldic shapes, and museum-placard captions. It never appears as texture or costume.

## User Stories

### First-time visitor

1. As a first-time visitor arriving from Instagram on my phone, I want to understand what the show is within ten seconds, so that I can decide whether it's for me.
2. As a first-time visitor, I want to read the jester story (the hero copy) in a way that feels crafted, so that the show's idea lands with me.
3. As a first-time visitor, I want to start the latest Episode with one tap, so that I can try the show immediately.
4. As a first-time visitor, I want to see who the Jesters are, with faces and short bios, so that I know who I'm listening to.
5. As a first-time visitor, I want Listen links for Apple Podcasts, Spotify, and YouTube, so that I can subscribe in the app I already use, while knowing every Episode also plays here for free.
6. As a visitor who has never used a podcast app, I want a short "New to podcasts?" explanation, so that I can figure out how to subscribe.
7. As a visitor, I want the site to be readable and comfortable on a small phone held in one hand, so that I don't have to pinch or scroll sideways.
8. As a visitor, I want the site to load quickly on mobile data, so that I don't give up before it appears.
9. As a visitor, I want a glimpse of the Fools' Gallery from the home page, so that I discover there is more to explore than the latest Episode.
10. As a visitor, if the feed ever comes back empty, I want a clear (and suitably foolish) message instead of empty boxes or broken links, so that the show still feels real.

### Listener

11. As a listener, I want audio to keep playing while I move between pages, so that I can browse the archive or the Gallery while I listen.
12. As a listener, I want play/pause, a scrub bar, a 15-second rewind, and a 30-second skip, so that I can control playback the way I do in podcast apps.
13. As a listener, I want to change playback speed (1×, 1.25×, 1.5×, 2×), so that I can listen at my preferred pace.
14. As a listener, I want to see elapsed and remaining time, so that I know how far in I am.
15. As a listener on a phone, I want a compact player bar that doesn't cover content and can expand into full controls, so that it stays out of my way.
16. As a listener on a phone, I want lock-screen and Control Center controls with the Episode title and artwork, so that I can control playback without unlocking.
17. As a returning listener, I want the site to offer to resume an Episode where I left off, so that I don't hunt for my place.
18. As a returning listener, I want finished Episodes marked in the archive, so that I can see what I've heard.
19. As a listener, I want to start any Episode from the archive without leaving the page, so that browsing and listening don't interrupt each other.
20. As a keyboard or screen-reader user, I want every player control to be reachable and announced properly, so that I can listen without a mouse.
21. As a listener, I want to close the player when I'm done, so that it gets out of my way without losing my place.

### Episode archive and Episode pages

22. As a visitor, I want every Episode listed newest first with its number, title, date, length, and a short excerpt, so that I can choose what to hear.
23. As a visitor, I want the latest Episode featured at the top of the archive, so that the newest one stands out.
24. As a visitor scrolling a long archive, I want Episodes grouped under year headings, so that I have landmarks.
25. As a visitor, I want bonus and trailer Episodes clearly labeled and kept out of the numbering, so that the numbering stays clear.
26. As a listener, I want each Episode to have a short, permanent address like `/episodes/1`, so that the Jesters can say it on the show and links never break.
27. As a visitor on an Episode page, I want the title, date, length, player, and Show notes, so that I know what the Episode covers.
28. As a visitor, I want Show notes displayed cleanly with their links and line breaks intact, so that they read well.
29. As a visitor, I want to read the Transcript of an Episode, so that I can skim, quote, or follow along.
30. As a visitor, I want the Transcript collapsed to a preview at first, so that the page isn't overwhelming.
31. As a listener, I want to tap a Transcript timestamp and have the player jump there, so that I can find a moment.
32. As a listener, I want the paragraph currently playing to be highlighted, so that I can read along.
33. As a reader, I want to know the Transcript is machine-generated, so that I forgive odd spellings.
34. As a visitor, I want next and previous Episode links, so that I can keep exploring.
35. As a visitor on my phone, I want a Share button that opens my phone's share sheet, so that I can send an Episode to a friend.
36. As a visitor on a desktop, I want Share to copy the link and confirm it, so that I can paste it anywhere.
37. As someone receiving a shared Episode link, I want a rich preview showing the Episode number and title, so that I'm tempted to tap.
38. As a listener on an Episode, I want its Listen links to open that Episode in my app, not just the show, so that I land where I meant to.

### Fools' Gallery

39. As a curious visitor, I want a history of court jesters and holy fools told as a timeline, so that I understand the tradition the show draws on.
40. As a visitor, I want each era (Holy Fools, the Medieval Court, the Renaissance, the Reformation) to open with a large painting, so that the page feels like walking through a gallery.
41. As a visitor, I want each Fool's story told alongside their painting in a frame, so that the history feels tangible.
42. As a visitor, I want a museum-placard caption on every painting (artist, title, year, medium, collection), so that I know what I'm looking at.
43. As a visitor on a phone, I want paintings cropped so the important figure stays in view, so that I see Stańczyk's face and not an empty corner.
44. As a visitor, I want the Gallery to end by explaining why this show wears the motley, so that the history connects back to the podcast.
45. As a visitor, I want to share a specific Fool, with a preview showing their painting, so that I can pass along a story I enjoyed. _(Deferred: in v1 a Fool link shows the Gallery's card; see `LATER.md`.)_
46. As a visitor who prefers less motion, I want painting animations turned off, so that the page doesn't make me uncomfortable.
47. As a visitor, I want a respelling under each hard name (Stańczyk: STAHN-chik), so that I can say it out loud.
48. As a visitor, I want to read what each jester actually said, briefly, so that I see why kings kept them.

### About

49. As a visitor, I want an explanation of why the show uses a jester (the court, the King, 1 Corinthians 4:10), so that I understand the metaphor.
50. As a visitor, I want full bios of all three Jesters with equal billing, so that I know each of them.
51. As a visitor, I want to know what the show believes, so that I can trust its theology.
52. As a visitor, I want to know the Jesters serve at Redeemer Church in Bozeman, so that I know where they come from.

### Speak Freely

53. As a listener, I want to send the Jesters a Question, Confession, Topic idea, or something else, so that I can take part in the show.
54. As a listener, I want my name to be optional and labeled as how it would be said on the show, so that I can stay anonymous if I want.
55. As a listener, I want my email to be optional and used only for follow-up, so that I'm not signed up for anything.
56. As a listener, I want to explicitly agree that my Submission may be mentioned on the show, so that nothing I send surprises me later.
57. As a listener, I want clear confirmation after sending, and a clear explanation if sending fails, so that I know whether it worked.
58. As a listener, I want a short privacy note saying where my Submission goes, so that I feel safe sharing.
59. As a Jester, I want each Submission delivered to the show's inbox with its type, name, email, consent, and message, so that we can use it on the show.
60. As a Jester, I want spam blocked without making listeners solve puzzles, so that the inbox stays useful.

### Everywhere

61. As a visitor, I want a header with the main sections that stays out of the way of the paintings and becomes solid as I scroll, so that I can always navigate.
62. As a phone visitor, I want a simple menu that opens and closes smoothly and traps focus correctly, so that navigation works one-handed and with assistive technology.
63. As a visitor, I want dark mode that follows my phone's setting, plus a toggle that remembers my choice, so that the site is comfortable at night.
64. As a visitor, I want no flash of the wrong theme when a page loads, so that the site feels polished.
65. As a visitor, I want a footer that maps the site (its sections, the show's apps, its social accounts) and carries the contact email, the privacy note, and copyright, so that I can find my way and reach the show from any page.
66. As a visitor who follows a broken link, I want a themed "a fool's errand" page with a way back, so that I'm not stuck.
67. As a visitor relying on assistive technology, I want real contrast, alt text, visible focus, and keyboard access everywhere, so that the site works for me.
68. As someone searching Google for the show or an Episode topic, I want to find the site with accurate titles and descriptions, so that I land in the right place.

### The Jesters (site owners)

69. As a Jester, I want a new Episode to appear on the site automatically after we publish it on Spreaker, so that we never edit the site by hand.
70. As a Jester on release day, I want a button I can tap from my phone to update the site immediately, so that I don't wait for the next scheduled check.
71. As a Jester, I want a publishing mistake (a missing or duplicate Episode number) to stop the update and alert us, without breaking the live site, so that errors never reach visitors.
72. As a Jester, I want the site to stay up with the last good version if the feed is unreachable, so that a Spreaker outage doesn't empty the site.
73. As a Jester, I want Listen links, social links, photos, and bios to appear as soon as each one is added, without waiting for all of them, so that we can launch before every input is ready.
74. As a Jester, I want a missing photo to show an on-brand monogram shield, so that the site looks intentional while we gather headshots.
75. As a Jester, I want draft copy clearly marked on preview links and blocked from launch, so that we know what still needs our words.
76. As a Jester, I want to change a bio, a link, or a Fool's story by editing one content file, without touching components, so that updates are easy.
77. As a Jester, I want to preview every visual change on my phone before it goes live, so that mobile quality stays high.
78. As a Jester, I want to see basic visitor numbers (page views, top pages, referrers) without cookie banners, so that I know whether Instagram sends people.
79. As a Jester, I want a style guide page showing every color, typeface, and component in light and dark, so that a palette or font change can be checked in one place.

## Implementation Decisions

### Platform and hosting

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, built as a **static export** (ADR 0001). The default Cache Components and Partial Prefetching features are disabled because they need a server.
- Hosted on **Cloudflare Workers with static assets**: one Worker serves the exported site and handles the Submit endpoint.
- Domain **`jestersprivilegepodcast.com`**, registered on Cloudflare Registrar, with DNS on Cloudflare. No misspelling domain. (`jestersprivilege.com` belongs to an unrelated party.)
- Email: Cloudflare Email Routing forwards `hello@jestersprivilegepodcast.com` to the show's Gmail, `thejestersprivilegepodcast@gmail.com`, a verified destination address.
- Analytics: Cloudflare Web Analytics, which is cookieless and needs no banner.

### Build and deploy

- One GitHub Actions workflow builds and deploys with `wrangler`. It has three triggers:
  - every push to `main`
  - a feed check **every 2 hours**, which rebuilds when the newest Episode differs from what's deployed, or when an Episode has gained a Transcript or an Episode Listen link since (ADR 0003)
  - a manual **Run workflow** button
- The site publishes a small build manifest (the identity of the newest Episode it was built with, and which Episodes it had Transcripts and Episode Listen links for), which the feed check compares against.
- If the feed can't be reached or fails validation, the build fails and the last good deploy stays live. A failed workflow emails the repo owner.
- Every pull request gets a Cloudflare **preview URL**, posted on the pull request.
- Review and merge policy:
  - **Logic and infrastructure** pull requests are merged by the agent only when CI is fully green and an automated `code-review` pass finds nothing serious.
  - **Visual** pull requests wait for a Jester's approval of the preview URL.
  - The repo is private on GitHub Free, so branch protection isn't enforced. The green-CI rule is enforced by a scripted check before merging, documented in `AGENTS.md`. Upgrade to GitHub Pro if it ever slips.

### Feed and Episodes

- Source: the Spreaker RSS feed, shaped exactly like the feed of _Polemical with Dan Collins_, which the same producer publishes.
- Deploys (production and pull request previews) read the real feed, `https://www.spreaker.com/show/7523831/episodes/feed`. Every other build, CI's tests included, reads a **fixture** with the same structure, so tests never depend on Spreaker. Episode 1 in it is "Celebrity Pastors". It also includes multiple years, a bonus Episode, HTML Show notes, and Transcript links.
- Which feed a build reads is one environment value, `FEED` (docs/deploy.md); the real feed's address is one value, `LIVE_FEED_URL` in `src/content/site.ts`. A production build that isn't reading the real feed fails.
- **Feed module** (a deep module with a small interface): takes the raw feed text and returns a validated, ordered list of Episodes or throws a descriptive error. An Episode carries:
  - number (absent for bonus and trailer Episodes) and type (full, bonus, trailer)
  - title, slug (for bonus Episodes), publish date and duration
  - audio URL, kept unchanged so Podtrac download counting still works
  - sanitized Show notes HTML and a plain-text excerpt
  - artwork URL
  - Transcript URL, if any
- Validation fails the build when:
  - two full Episodes share a number
  - a full Episode lacks a number
  - required fields are missing
- Show notes are sanitized to a small allowlist (paragraphs, line breaks, links, emphasis, lists). Links open safely.
- **Episode URLs** are `/episodes/<number>`, and unnumbered Episodes use `/episodes/bonus/<title-slug>` (ADR 0002).
- Zero Episodes is a normal state. It hides the Episodes nav item and any Episode-dependent sections, and the home page says the Episodes have wandered off (written for a feed that comes back empty, now that Episode 1 is out).
- **Episode Listen links** (GLOSSARY: Listen link): on an Episode, a Listen link opens that Episode in the app. The build looks them up:
  - **Apple Podcasts**: Apple's public lookup (`itunes.apple.com/lookup?id=<show>&entity=podcastEpisode`), matched exactly on the Episode's feed GUID (`episodeGuid`). No key.
  - **Spotify**: the Spotify Web API with a client-credentials key stored as GitHub secrets, matched on title and release date.
  - **YouTube**: once the show is on YouTube; how to match is decided then.
  - Until an app lists an Episode, or when a lookup fails, its Listen link opens the show instead. A lookup never fails the build; the build log names the Episode and the app.

### Transcripts

- Spreaker makes no Transcripts, so the site makes its own (ADR 0003). The podcast host's WebVTT Transcript is used when the feed links one; otherwise the site's own.
- **Making one**: when an Episode has neither, a workflow transcribes its audio once with Whisper (whisper.cpp) on GitHub's runners, free for this public repo, with a prompt of the show's hard names (Stańczyk, Triboulet, Redeemer, Bozeman, the Jesters' names). It writes WebVTT.
- **Keeping them**: each one is saved as `<episode-guid>.vtt` on a `transcripts` branch that only the workflow writes to, outside `main`'s protection. Builds read from it. An Episode with a saved Transcript is never transcribed again, so a hand fix to its file sticks (ADR 0003).
- **Timing**: a new Episode deploys first; its Transcript follows. The feed check also rebuilds when an Episode has gained a Transcript or an Episode Listen link since the last deploy.
- A **Transcript module** turns the caption cues into readable paragraphs, each with a start timestamp. It groups cues on pauses and sentence ends, within a target paragraph length.
- A missing, unreachable, or unreadable Transcript leaves that Episode without one and doesn't fail the build. The build log names the Episode and why.
- On the page, the Transcript is a secondary section below the Show notes:
  - It's collapsed to a faded preview with "Read the full transcript". The full text is always in the HTML so search engines can index it.
  - Each paragraph has a timestamp in the margin, like verse numbers.
  - Tapping a timestamp seeks the player.
  - The paragraph currently playing is highlighted.
  - A note says a machine wrote it and invites corrections through Speak Freely.

### Persistent player

- The player lives in the root layout, so it survives client-side navigation. A full page reload stops audio, and the resume feature covers that.
- A **player store** is the single source of truth: current Episode, playing or paused, position, duration, speed, and finished Episodes. It drives the audio element through a thin adapter, so the store can be tested without real audio. Archive rows, Episode pages, the Transcript, and the player UI all talk to the store.
- Controls:
  - play/pause, scrub bar, −15s, +30s
  - a close button (×) on the collapsed bar and in the expanded view: it stops the audio, hides the player, and keeps the Episode's saved position, so Play on that Episode later resumes
  - speed: 1×, 1.25×, 1.5×, 2×
  - elapsed and remaining time
- Layout:
  - a collapsed bar showing the title, play/pause, and a slim progress line
  - an expanded view with the full controls, the Episode number, and a link to the Episode page
- Media Session integration: title, artwork, and play/pause/seek/skip handlers for the lock screen, Control Center, and car controls.
- Resume and finished marks: the position for each Episode is saved on the device (browser storage, so each device and browser keeps its own; nothing syncs between them). A return visit offers to resume. Episodes heard to the end are marked finished.
- Out of v1: queue, autoplay next, sleep timer, downloads, chapters.

### Pages

- Section addresses are the `nav` entries in `src/content/shell.ts`; each page is built at its address there.

- **Home**
  - the hero copy, with the reveal style chosen at the mockup gate: paragraph-by-paragraph on scroll, or simple
  - the latest Episode, straight after the hero copy, with Play first and its Episode Listen links ("or listen on") as small icons under it; or the zero-Episodes message
  - a Fools' Gallery teaser
  - a "Meet the Jesters" strip linking to About
- **Episodes**: the hymnal index.
  - The latest Episode is featured as the only large card.
  - Each other Episode is a row: a large Episode number in the display face, then the title, date and length, a two-line excerpt, and play-in-place.
  - Rows are grouped by year. Bonus and trailer Episodes get an orange label and no number. Finished Episodes show a check.
  - The archive stays a single page; search and filters are in `LATER.md`.
- **Episode**: title, number, date and length; play, with its Episode Listen links as small icons under the player; Show notes; Transcript; previous/next; Share.
- Episode Listen links appear only on the home page's latest Episode and on Episode pages: not on the Episodes page's featured card or archive rows.
- **Fools' Gallery**
  - A timeline in eras: Holy Fools, the Medieval Court, the Renaissance, the Reformation.
  - Each era opens with a painting band and one short paragraph (about 40–60 words) that sets the scene.
  - Each Fool gets a framed painting and their story. A hard name has a plain-English respelling under it, stressed syllable in capitals (Stańczyk: STAHN-chik), checked against a pronunciation source.
  - A court-jester Fool's story is who they were and what they did, in one short paragraph, then two or three of their lines, each with a short setup. Every line is attested in the sources, and anything that's only legend says so ("the story goes"). The painting gets a sentence only where it matters (Stańczyk's, which helped name the show). The Fools with jests: Stańczyk, Triboulet, Will Somers, Richard Tarlton, Archibald Armstrong, Erasmus (Folly's lines), and the yurodivy (Nikola's rebuke to Ivan).
  - Fools with no recorded jests (Paul, Francis, Pablo de Valladolid, Calabacillas) keep their stories as written, apart from quoting Scripture in the ESV.
  - v1 Fools, each depending on finding a suitable public-domain painting: Paul's "fools for Christ" and the holy fools (St. Francis's _jongleurs de Dieu_, the Russian _yurodivy_), Stańczyk (Matejko, 1862), Triboulet, Will Somers, Archibald Armstrong, Richard Tarlton, the Spanish court fools painted by Velázquez, and Erasmus's _In Praise of Folly_ with Holbein's marginal drawings.
  - It ends with why this show wears the motley.
- **About**: why the show is called "Jester's Privilege"; the three Jesters with equal billing, each under the label they chose (Co-host; Aaron is Producer & Co-host) and with their full bio; what we believe; Redeemer Church (the show is ours, not the church's); how to listen, with the show's Listen links and "New to podcasts?".
- **Speak Freely** (`/speak-freely`; renamed from Submit in #85)
  - Type: Question (the default), Confession, Topic idea, or Other.
  - Message: required.
  - Name: optional, labeled "How should we say your name on the show? (Leave blank to stay anonymous.)"
  - Email: optional, labeled "Only if you're OK with us following up."
  - A required checkbox: "You can mention this on the show."
  - A privacy note, then success and failure states.
- **404**: themed "A fool's errand," with a way back to the great hall.
- **Style guide**: every token, typeface, and component in light and dark. It's excluded from the sitemap and search indexing.

### Submit endpoint

- The Worker handles `POST /api/submit`:
  - It validates the fields (type allowlist, message length limits, optional email format, consent required).
  - It rejects honeypot hits silently.
  - It verifies the Cloudflare **Turnstile** token server-side.
  - It sends one email to the show's Gmail through Cloudflare's email-sending binding, which delivers only to verified destination addresses, so not to the `hello@` alias.
  - It returns a small JSON result the page uses for success and error states.
- The email sender and the Turnstile verifier are injected, so the handler can be tested without Cloudflare.
- Submissions are not stored anywhere else.

### Design system

- **Principle**: modern construction, deliberate historical callbacks.
- **Palette**, sampled from the logo:
  - orange `#ED6913` and teal `#054F51` on parchment
  - teal-black backgrounds in dark mode, parchment text, and stronger orange accents
- **Contrast rule**: brand orange is for large text, accents, and ornament only. Teal or ink carries body text and links. A darker orange variant is used where orange small text is unavoidable. Buttons with an orange fill use dark text.
- **Type**:
  - **Gloock**: display, headlines, and the drop cap
  - **Source Serif 4**: body
  - **Barlow Semi Condensed**: UI (navigation, buttons, labels, metadata)
  - All three are self-hosted through Next's font loader.
- **Tokens**: every color, font, radius, shadow, and motion preset is defined once with semantic names. Dark mode redefines the same names. A rebrand is a one-file change.
- **Theming**: follows the system setting, with a header toggle that remembers the visitor's choice. The theme is applied before first paint, so there's no flash of the wrong theme.
- **Components**, in three layers:
  - restyled **shadcn/ui** primitives, owned in the repo (menu, dialog, select, checkbox, toggle)
  - site components (banner, shield and monogram frame, illuminated paragraph, painting band, framed painting with placard, Episode row, fleuron rule)
  - pages that only arrange those components
- **Icons**: Lucide for the interface, Simple Icons for app and social logos. A Listen link or social link is its icon with a hidden text label, never a bare text link.
- **Footer**, stacked on phones:
  1. the logo and the site's one-line description
  2. Explore: the nav sections (Episodes, Fools' Gallery, About, Speak Freely)
  3. Listen: the show's Listen links as icons
  4. Follow: the social links as icons
  5. a bottom strip: the contact email, the privacy note, © year, and the ESV notice
- **Motion**: the Motion library, loaded lightweight. Shared presets: a slow "processional" ease for reveals and a quicker "courtly" one for menus. Reduced motion is respected site-wide.
- **Navigation**:
  - a slim top header, transparent over hero paintings and solid and compact on scroll
  - a mobile menu
  - the docked player at the bottom
- **Logo**: the draft PNG for now. In dark mode, and wherever its baked-in white background would show, it sits on a parchment shield-cut plate. Final SVG, transparent, square-mark, and dark-background versions are pending inputs.
- **Jesters**: headshots in arched (cathedral-window) frames. A missing photo shows a teal shield with an orange initial, and a missing bio shows the name and role only.

### Paintings

- **Painting bands**: full-width paintings between calm reading sections. Only short titles sit on a painting, over a gradient scrim. Body text never sits on a painting.
- **Framed paintings**: shown inline for individual Fools.
- Each painting's content record has:
  - a source, with verified public-domain status (Wikimedia Commons)
  - placard data: artist, title, year, medium, collection
  - alt text
  - a **focal point**, used for cropping on phones
- Responsive sizes in modern formats are generated at build time. Paintings below the first screen load lazily. A subtle slow zoom on bands is desktop-only and turned off under reduced motion.

### Content

- All copy and data live in typed content files: site links (each Listen link and social link optional), Jesters, Fools and eras, hero copy, About sections, microcopy.
- Components never hard-code copy.
- Content still awaiting the Jesters' words is marked `draft: true` and written at realistic length:
  - Previews show a **DRAFT** ribbon on pages that use draft content.
  - The live site never shows it.
  - A launch check fails if draft content would go live.
- **Copy principle: the landing page is the thesis.** The landing page says what the show is, why it exists (the metaphor), and what visitors can find on the site. Every other page expands one part of it in more detail:
  - **About:** who we are, and why the show is called "Jester's Privilege"
  - **Fools' Gallery:** the history behind the metaphor
  - **Episodes:** the show itself
  - **Speak Freely:** how visitors talk back

  The pages don't need to match the landing page word for word, but each one should use its metaphor and vocabulary (the King who needs no jester, the church who is dearly loved yet can wander, her courtiers, fools for Christ, the motley), never contradict it, and point back to it where that comes naturally. The landing-page text itself is final and doesn't change. Before approving any draft copy, check it against this principle. (Set by the Jesters on #6, 2026-11-02.)

- **Voice: witty, always.** The Jesters are silver-tongued fools using the gift for the church's good, so every piece of copy carries their wit: jokes strewn about, the working messages included. Clear first, funny second: an error still says exactly what happened and what to do. Never invent facts about real people or the church for a joke. (Set by Michael, 2026-11-03.)
- **Scripture is quoted from the ESV**, with Crossway's notice in the footer (check its current wording at crossway.org/permissions).

- Jester bios: the Jesters supplied their full bios (on #6), used word for word on About, in the order Michael, Dan, Aaron. The home page shows a two-line summary of each, condensed from them.

### SEO and sharing

- Per-page titles and descriptions, a canonical URL on every page, and a sitemap and robots file.
- A favicon and app icons from the logo mark.
- The RSS feed linked in the page head.
- JSON-LD structured data for the podcast series and each Episode.
- Open Graph images generated at build time (a link to a Fool, `/gallery#<slug>`, shows the Gallery's card; a card per Fool is in `LATER.md`):
  - **Episode**: a parchment card with a large "Episode N" in Gloock, the title, the logo mark, and a teal band
  - **Site-wide**: the logo, tagline, and a painting detail
- A Share button on Episodes and Fools: the native share sheet where available, otherwise copy the link with a confirmation.

## Testing Decisions

- **What a good test is**: it exercises external behavior through a module's public interface (inputs to outputs, or what a user sees and does), never internal details. Tests are written first, using the `tdd` skill's red-green-refactor loop.
- **Seams**, chosen as high as possible:
  1. **Feed**: raw feed text in, validated Episodes or a descriptive error out. Fixture-driven, covering every validation rule, sanitizing, and ordering.
  2. **Transcript**: WebVTT text in, timestamped paragraphs out. Making one sits behind an injected transcriber, so the workflow's logic is tested without Whisper.
  3. **Submit handler**: a request (plus an injected sender and Turnstile verifier) in, a response and the sent email out.
  4. **Player store**: commands in, state out, against a fake audio adapter. Covers resume, finished marks, speed, and seeking from the Transcript.
  5. **Components**: rendered with React Testing Library, asserting what a user sees, including every missing-input and empty state, with jest-axe accessibility assertions.
  6. **Built site**: Playwright drives the exported site.
- **Layers in CI on every pull request**:
  - **Jest** with React Testing Library and jest-axe. Coverage thresholds (about 90% of lines) on logic modules.
  - **Playwright** on Chromium and WebKit at phone and desktop sizes, with axe scans of every page. Firefox runs nightly.
  - **Lighthouse CI** with a mobile performance budget, so oversized images or scripts fail the pull request.
- **Key browser journeys**:
  - every page loads with no horizontal scroll at phone width
  - audio keeps playing across navigation
  - archive play-in-place
  - Transcript timestamps seek the player
  - the theme toggle persists, with no flash
  - the mobile menu's focus handling
  - the Speak Freely form succeeds and fails gracefully, using Turnstile's test keys
  - the 404 page
  - the zero-Episodes state with an empty-feed fixture
  - closing the player stops audio, and Play afterwards resumes
- **Prior art**: none yet; this is a new repo. The first tests of each layer set the patterns.

## Out of Scope

- Site-only Episode extras (Scripture passages, books mentioned), the Scripture index, the Jester's Library, topic and series browsing, site search.
- Player queue, autoplay, sleep timer, downloads, chapters, and share-from-timestamp.
- Proofreading every Transcript.
- Newsletter, merch, blog, comments, accounts, a CMS, and a database.
- Forwarding `hello@` to several inboxes: everything goes to the show's Gmail.
- Instant updates through a Spreaker publish webhook, and narrowing the feed-check schedule to a fixed release day.
- Analytics beyond Cloudflare Web Analytics.
- The final writing of major pages. The Jesters write it; agents build with marked drafts.

## Further Notes

- **Pending inputs** (none block starting):
  - the YouTube link
  - a Spotify Web API key (client ID and secret) as GitHub secrets
  - the Jesters' approval of the rewritten Fools' Gallery copy and the light wit pass on working messages
  - headshots for all three Jesters
  - final logo files (SVG, transparent background, square mark, dark-background version)
- **Human-only setup**: a Cloudflare account and domain purchase, Email Routing, a Cloudflare API token and account ID as GitHub secrets, and Turnstile keys.
- **Build phases**:

  0. Human setup.
  1. Foundation, built serially: tooling and CI, tokens and theming, the shell, the content model, feed ingestion, the image pipeline, and deploy.
  2. The home page mockup gate. Logic work continues in parallel.
  3. Fan-out: pages built in parallel.
  4. Hardening and launch.

- **Next 16 note**: this version of Next.js differs from older training data. Agents read the bundled docs inside the installed `next` package before writing framework code, as `AGENTS.md` instructs.
