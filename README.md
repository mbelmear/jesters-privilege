# Transcripts

The site's own Episode Transcripts, one WebVTT file per Episode, named
after its feed GUID (encoded). The Transcribe workflow writes them
(.github/workflows/transcribe.yml on main, ADR 0003) and builds read
them. An Episode with a file here is never transcribed again, so a
hand fix to its file sticks.
