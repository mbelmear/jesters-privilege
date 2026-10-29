# Jester's Privilege Website: Claude Code Kickoff Brief

Paste this into Claude Code at the start of the project, or save it as `docs/brief.md` in the repo and point Claude at it.

---

## What we're building

A website for **Jester's Privilege**, a weekly theology-and-humor podcast hosted by Michael Belmear (deacon), Dan Collins (discipleship pastor), and Aaron (producer). The show uses the court jester as its metaphor: the one man in the king's court who dared tell the truth, while everyone laughed. The hosts are the jesters, Christ is the King, and the show laughs at church culture (and at themselves first) to call the church back to Scripture.

The site is the show's front door. It should make a first-time visitor understand the show in 10 seconds and get them listening in one click.

**About me:** I'm a professional software engineer, but this is my first website. I want to learn how a real site is built, not just get code dumped on me. Explain the decisions that are web-specific (rendering, SEO, deployment, DNS) as we go. Keep explanations short.

**Goal:** ship a polished, fully working v1 fast. Prefer simple, boring choices. Avoid anything we don't need yet.

---

## Decisions already made

- **Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS.
- **Domain:** `jestersprivilege.com` (primary). `jesterspriviledge.com` (common misspelling) redirects to it.
- **Hosting:** see "Hosting" below. Confirm with me before setting it up.
- **Episodes come from the podcast RSS feed.** No one should ever update the site by hand when an episode drops.
- **No CMS, no database, no auth, no accounts** in v1.

## Hosting

The podcast may be monetized, and Vercel's free Hobby plan is for non-commercial use only. Options, in order of preference:

1. **Cloudflare (free, commercial use OK):** domain via Cloudflare Registrar, site deployed to Cloudflare with Next.js static export (`output: 'export'`). Everything in one dashboard.
2. **Vercel Pro ($20/month):** the smoothest Next.js experience if we later need server features.

Default to option 1 unless something in v1 truly needs a server. Rebuild the site automatically on a schedule (e.g., a daily GitHub Actions cron that hits a deploy hook) so new episodes show up without me doing anything.

---

## v1 pages

1. **Home**
   - Logo and tagline: "Theology in the Motley."
   - The show intro as the hero copy (below).
   - "Listen on" buttons: Apple Podcasts, Spotify, YouTube, RSS.
   - Latest episode with an embedded player.
   - A short "Meet the hosts" strip.
2. **Episodes**: a list of every episode from the RSS feed (title, date, length, short description), newest first.
3. **Episode page** (one per episode, generated from RSS): title, date, player, show notes from the feed description. Leave room to add hand-written notes later (Scripture passages, history story, books mentioned).
4. **About**: what the show is, the hosts (photo, two-line bio each), and why a jester.
5. **Submit**: a form for listener "fool confessions" and topic ideas (name optional, email optional, message, a type dropdown: Confession / Topic idea / Other). Use a hosted form service or a tiny serverless function. Include basic spam protection.
6. **Footer**: socials, contact email, RSS link, copyright.

### Hero copy (the show intro)

> Long ago, in the great halls of Europe, kings were surrounded by flattering courtiers too afraid to tell them the truth. But in every court, one man dared: the jester. With a jest, he showed the crown its folly, and while the court laughed, the king listened.
>
> The King of kings and Lord of lords needs no jester. But to his church, he gave the keys of the kingdom. She is dearly loved, yet she can wander, and she has courtiers of her own.
>
> Paul says we are fools for Christ. So, as servants of the true King, we've put on the motley to laugh at ourselves, speak the truth in love, and call the church to listen to her King.
>
> This is Jester's Privilege.

Consider revealing it paragraph by paragraph on scroll, or keep it simple. Show me options.

---

## Design direction

- **It needs to look really good.** Not a template. A visitor should feel "this is a real show."
- **Palette:** pull exact colors from the logo file: deep teal and bright orange on an off-white or parchment background. Sample the hex values from the image; don't guess.
- **Type:** a chunky, characterful serif for headings (to echo "Jester's" in the logo), a clean readable sans or serif for body text. Use `next/font`.
- **Mood:** medieval court meets modern podcast. Winsome, playful, confident. Subtle heraldic touches (a shield shape, a banner, a thin rule) are fine. No clip-art castles, no Renaissance-fair kitsch, no fake parchment textures everywhere.
- **Mobile first.** Most visitors arrive from Instagram on a phone.
- **Accessible:** real contrast, keyboard navigation, alt text, respects reduced motion.
- **Light mode first.** Dark mode only if it's cheap.

## SEO and sharing (do these in v1, they're cheap)

- Per-page titles and descriptions via Next.js metadata.
- An Open Graph image for the site and one per episode (generated from the title + logo), so links look good in texts and on social.
- `sitemap.xml`, `robots.txt`, favicon and app icons from the logo.
- Podcast-specific: link the RSS feed in the page head.

## Out of scope for v1

Merch, newsletter, blog, transcripts, comments, search, analytics beyond the host's free option, a CMS. Note good ideas in a `LATER.md` instead of building them.

---

## How I want to work

1. **Grill me first.** Ask me one question at a time until the spec is clear (use the grill-me skill if it's installed). Don't start coding until we agree.
2. **Write a short spec / PRD,** then break it into small, shippable tickets.
3. **Build in vertical slices.** Get a bare home page deployed to the real domain on day one, then improve it. Something live beats something perfect.
4. **Show me the design early.** Before building every page, mock up the home page and let me react.
5. **Explain web-specific concepts briefly** when they come up (static vs. server rendering, caching, DNS records, Open Graph).

## Things I'll provide (ask me if missing)

- [ ] Podcast host name and RSS feed URL
- [ ] Apple Podcasts, Spotify, and YouTube show links
- [ ] Instagram and other social handles
- [ ] Contact email for the form and footer
- [ ] Logo files (SVG preferred; horizontal and square versions)
- [ ] Host photos and two-line bios for Michael, Dan, and Aaron
- [ ] Confirmation that `jestersprivilege.com` is registered
