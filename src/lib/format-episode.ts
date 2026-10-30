// How an Episode's date and length read beside its title: "Jan 14, 2027 ·
// 43 min". The player's running clock is formatDuration's job.

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
