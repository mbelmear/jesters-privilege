"use client";

import {
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerCopy } from "@/lib/content";
import { episodePath } from "@/lib/feed";
import { formatDuration } from "@/lib/format-duration";
import { episodeLabel, type EpisodeLabels } from "@/lib/format-episode";
import {
  SKIP_BACK_SECONDS,
  SKIP_FORWARD_SECONDS,
  SPEEDS,
  type Player,
  type PlayerState,
  type Speed,
} from "@/lib/player";
import { cn } from "@/lib/utils";
import {
  reportPlayerError,
  usePlayer,
  usePlayerState,
} from "./player-provider";

type Props = {
  copy: PlayerCopy;
  labels: EpisodeLabels;
};

type Loaded = Exclude<PlayerState, { mode: "empty" }>;

/**
 * The persistent player, docked at the foot of every page once an Episode is
 * played: a compact bar with the title, play and pause, and a slim progress
 * line, which expands into the full controls.
 */
export function PlayerBar({ copy, labels }: Props) {
  const player = usePlayer();
  const state = usePlayerState(player);
  const [expanded, setExpanded] = useState(false);
  const controlsId = useId();
  if (!player || !state || state.mode === "empty") return null;

  // The feed's length is an estimate until the audio reports its own.
  const length = Math.max(state.duration, state.position);
  const progress = length > 0 ? state.position / length : 0;
  const buffering = state.mode === "playing" && state.buffering;
  const label = episodeLabel(state.episode, labels).text;
  return (
    <section
      aria-label={copy.label}
      className="relative border-t border-border bg-card pb-[env(safe-area-inset-bottom)] text-card-foreground shadow-dock"
    >
      {!expanded && (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1">
          <div
            className="h-full bg-brand"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
      <div className="relative mx-auto w-full max-w-3xl px-4 sm:px-6">
        {expanded ? (
          <div id={controlsId} className="flex flex-col gap-2 pt-3 pb-2">
            <p className="flex min-w-0 flex-col pr-14">
              <span className="font-ui text-xs font-semibold tracking-widest text-brand-ink uppercase">
                {label}
              </span>
              <Link
                href={episodePath(state.episode)}
                className="truncate font-display text-xl text-primary hover:underline hover:underline-offset-4"
              >
                {state.episode.title}
              </Link>
            </p>
            <Scrub player={player} state={state} length={length} copy={copy} />
            <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-3 sm:gap-6">
              <SpeedButton player={player} speed={state.speed} copy={copy} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={player.skipBack}
              >
                <SkipIcon icon={RotateCcw} seconds={SKIP_BACK_SECONDS} />
                <span className="sr-only">{copy.skipBack}</span>
              </Button>
              <PlayPause player={player} state={state} copy={copy} large />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={player.skipForward}
              >
                <SkipIcon icon={RotateCw} seconds={SKIP_FORWARD_SECONDS} />
                <span className="sr-only">{copy.skipForward}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-2 pr-14">
            <PlayPause player={player} state={state} copy={copy} />
            <p className="flex min-w-0 flex-col">
              <span className="font-ui text-xs font-semibold tracking-widest text-brand-ink uppercase">
                {label}
              </span>
              <span className="truncate font-display text-lg leading-snug">
                {state.episode.title}
              </span>
            </p>
          </div>
        )}
        {/* One button in one place for both layouts, so it keeps focus. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 sm:right-4"
          aria-expanded={expanded}
          aria-controls={expanded ? controlsId : undefined}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown aria-hidden="true" className="size-6" />
          ) : (
            <ChevronUp aria-hidden="true" className="size-6" />
          )}
          <span className="sr-only">
            {expanded ? copy.collapse : copy.expand}
          </span>
        </Button>
        <p role="status" className="sr-only">
          {buffering ? copy.loading : ""}
        </p>
        {state.mode === "failed" && (
          <p role="alert" className="pb-3 text-sm text-destructive">
            {copy.failed.text}
          </p>
        )}
      </div>
    </section>
  );
}

function PlayPause({
  player,
  state,
  copy,
  large = false,
}: {
  player: Player;
  state: Loaded;
  copy: PlayerCopy;
  large?: boolean;
}) {
  const buffering = state.mode === "playing" && state.buffering;
  const icon = large ? "size-7" : "size-5";
  return (
    <Button
      type="button"
      variant="brand"
      size="icon"
      className={cn("rounded-full", large && "size-14")}
      onClick={() => player.toggle().catch(reportPlayerError)}
    >
      {buffering ? (
        <LoaderCircle
          aria-hidden="true"
          className={cn(icon, "motion-safe:animate-spin")}
        />
      ) : state.mode === "playing" ? (
        <Pause aria-hidden="true" className={cn(icon, "fill-current")} />
      ) : (
        <Play aria-hidden="true" className={cn(icon, "fill-current")} />
      )}
      <span className="sr-only">
        {state.mode === "playing" ? copy.pause : copy.play}
      </span>
    </Button>
  );
}

function Scrub({
  player,
  state,
  length,
  copy,
}: {
  player: Player;
  state: Loaded;
  length: number;
  copy: PlayerCopy;
}) {
  const elapsed = formatDuration(state.position);
  return (
    <div className="flex flex-col">
      <input
        type="range"
        aria-label={copy.position}
        aria-valuetext={`${elapsed} ${copy.of} ${formatDuration(length)}`}
        min={0}
        max={length}
        step={1}
        value={state.position}
        onChange={(event) => player.seek(event.target.valueAsNumber)}
        className="h-11 w-full cursor-pointer accent-brand"
      />
      <p className="flex justify-between font-ui text-sm font-semibold text-muted-foreground tabular-nums">
        <span>
          <span className="sr-only">{copy.elapsed}</span>
          {elapsed}
        </span>
        <span>
          <span className="sr-only">{copy.remaining}</span>
          {`\u2212${formatDuration(length - state.position)}`}
        </span>
      </p>
    </div>
  );
}

// Steps through the speeds, from 2× back to 1×.
function SpeedButton({
  player,
  speed,
  copy,
}: {
  player: Player;
  speed: Speed;
  copy: PlayerCopy;
}) {
  const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-w-16 justify-self-start px-2 tabular-nums normal-case"
      onClick={() => player.setSpeed(next)}
    >
      <span className="sr-only">{copy.speed} </span>
      {`${speed}\u00d7`}
    </Button>
  );
}

// A circling arrow with the seconds it skips set inside it.
function SkipIcon({
  icon: Icon,
  seconds,
}: {
  icon: typeof RotateCcw;
  seconds: number;
}) {
  return (
    <span aria-hidden="true" className="relative inline-flex">
      <Icon className="size-8" strokeWidth={1.5} />
      <span className="absolute inset-0 flex items-center justify-center font-ui text-[0.625rem] font-semibold">
        {seconds}
      </span>
    </span>
  );
}
