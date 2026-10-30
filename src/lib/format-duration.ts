import type { PlayerCopy } from "./content";

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDuration(totalSeconds: number): string {
  const whole = Math.floor(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

// "Resume from 12:34", offered for an Episode left partly heard.
export function resumeLabel(
  copy: Pick<PlayerCopy, "resume" | "resumeFrom">,
  seconds: number
): string {
  return `${copy.resume} ${copy.resumeFrom} ${formatDuration(seconds)}`;
}
