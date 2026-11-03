# Later

Good ideas deliberately left out of v1.

- **Forward `hello@` to Aaron too.** Change the Email Routing destination, or add a small Email Worker to forward to several inboxes.
- **Site-only extras on Episode pages.** Scripture passages, the history story, books mentioned: content that lives on the site but not in the Show notes.
- **Instant episode updates.** If the podcast host supports a publish webhook, use it to trigger the deploy workflow so new Episodes appear within minutes.
- **Narrow the feed-check schedule.** Once there's a fixed release day, run the 2-hourly check only on that day and the next.
- **Scripture index.** Browse Episodes by the passages they cover (worth it at 15–20 Episodes).
- **The Jester's Library.** Books mentioned on the show and recommended reading.
- **Topics and series.** Browse the Episode archive by subject.
- **A link preview per Fool.** Each Fool is a section of the Gallery page, so a shared Fool shows the Gallery's card. A card of their own (their painting cropped to the focal point, with a placard strip) needs an address of their own, such as a page per Fool at `/gallery/<slug>`. Draw the card in `src/app/cards/[...card]/route.ts`, beside the Episode cards: Next refuses `opengraph-image` files under a catch-all route.
- **Share from a timestamp.** Links that open an Episode playing at a given moment.
- **Hand-corrected Transcripts.** Fix machine-transcription errors on key Episodes.
- **Newsletter and merch.**
