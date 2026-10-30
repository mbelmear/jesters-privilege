import type { Episode, PlayableEpisode } from "./feed";

// How an Episode's label, date, and length read beside its title: "Episode 4",
// "Jan 14, 2027 · 43 min". The player's running clock is formatDuration's job.

const publishDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  // Spreaker dates Episodes in UTC; the day shown is the feed's day, not the
  // build machine's.
  timeZone: "UTC",
});

export function formatPublishDate(date: Date): string {
  return publishDate.format(date);
}

// The same day for a <time> element's datetime: "2027-01-14".
export function publishDateAttribute(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// The unit words come from content, such as { hours: "hr", minutes: "min" }.
export type TimeUnits = { readonly hours: string; readonly minutes: string };

export function formatListeningTime(
  totalSeconds: number,
  units: TimeUnits
): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [
    hours > 0 && `${hours} ${units.hours}`,
    rest > 0 && `${rest} ${units.minutes}`,
  ];
  return parts.filter(Boolean).join(" ");
}

// The words for each kind of Episode, from content.
export type EpisodeLabels = {
  readonly episode: string;
  readonly bonus: string;
  readonly trailer: string;
};

// "Episode 4: Is Humor a Virtue?", for the browser tab and the share sheet.
export function episodeTitle(episode: Episode, labels: EpisodeLabels): string {
  return `${episodeLabel(episode, labels).text}: ${episode.title}`;
}

// A full Episode shows its number; bonus and trailer Episodes a label.
export type EpisodeLabel =
  | { kind: "numbered"; number: number; text: string }
  | { kind: "labelled"; text: string };

export function episodeLabel(
  episode: PlayableEpisode,
  labels: EpisodeLabels
): EpisodeLabel {
  switch (episode.type) {
    case "full":
      return {
        kind: "numbered",
        number: episode.number,
        text: `${labels.episode} ${episode.number}`,
      };
    case "bonus":
      return { kind: "labelled", text: labels.bonus };
    case "trailer":
      return { kind: "labelled", text: labels.trailer };
    default: {
      const unhandled: never = episode;
      return unhandled;
    }
  }
}
