# Trimming the early script or the font subsets further

#94 cut the body face's weight axis to 400 to 700, which took most pages'
early fonts from 78,871 to 65,903 bytes, and a page that loads the italic,
such as About, from 127,936 to 100,796. It measured three more trims and
left them alone.

## Why this is out of scope

- **The framework.** Most of the script every page fetches before its first
  paint is React and Next.js, a floor no app change moves (docs/testing.md,
  Performance, gives the figure).
- **`cn`'s merge tables.** `cn` is the largest package in the early script
  after the framework: 10.7 KB gzipped by `next analyze`'s count (10.6 KB
  in its chunk). `cn build` fits its tables to the class groups the project
  uses (113 of 384, by its own summary), but the engine stays, so early
  script fell only from 160.3 KB to 158.3 KB. That's 2 KB for a generated
  file that has to be rebuilt whenever a component uses a new class group,
  and that merges wrongly, without failing, when it's stale.
- **Narrower latin subsets.** Each face's first file holds Google's latin
  subset, accented letters (U+A0 to U+FF) included. Dropping those would
  make any Feed title with an é fetch the rest of the face: 71 KB for the
  body face.

Revisit if a page's early bytes approach its budget again. Start with
`npm run lighthouse:compare` and `next analyze`.

## Prior requests

- #94: "Trim the early bytes every page shares"
