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

export function formatListeningTime(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
