import SlamText from "~/components/fx/slam-text";
import TagChip from "~/components/fx/tag-chip";
import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";
import { isLocalSong, isUsdbSong, type Song } from "~/lib/ultrastar/song";

// The card leaves with a diagonal wipe to the right.
const CLIP_VISIBLE = "polygon(-20% 0, 120% 0, 120% 100%, 0% 100%)";
const CLIP_HIDDEN = "polygon(100% 0, 120% 0, 120% 100%, 120% 100%)";

interface SongIntroProps {
  song: Song;
  started: boolean;
  /** Palette name, e.g. "teal". */
  accentColor: string;
}

/**
 * Title card shown while the song loads; wipes away once singing starts.
 * Entrances are delayed until the route's diagonal wipe has revealed the card.
 */
export default function SongIntro(props: SongIntroProps) {
  const coverUrl = () => {
    const song = props.song;
    if (isUsdbSong(song)) return song.coverUrl ?? "";
    if (isLocalSong(song)) return song.coverUrl ?? song.backgroundUrl ?? "";
    return "";
  };

  return (
    <div
      class="absolute inset-0 z-2 overflow-hidden bg-black"
      classList={{
        "pointer-events-none": props.started,
        "transition-[clip-path] duration-700 ease-in": effectsEnabled(),
        "transition-opacity duration-1000": !effectsEnabled(),
        "opacity-0": props.started && !effectsEnabled(),
      }}
      style={{
        "clip-path": effectsEnabled() ? (props.started ? CLIP_HIDDEN : CLIP_VISIBLE) : undefined,
      }}
    >
      <img
        class="absolute inset-0 block h-full w-full scale-110 transform object-cover opacity-60 blur-xl"
        src={coverUrl()}
        alt=""
      />
      <div
        class="absolute inset-0 bg-halftone opacity-20"
        style={{ "--fx-color": "white", "mask-image": "linear-gradient(to top, black, transparent 50%)" }}
      />
      <div class="absolute top-1/2 left-[-10%] h-[14cqw] w-[120%] -translate-y-1/2 -rotate-6">
        <div
          class="h-full w-full origin-left animate-band-in opacity-85 shadow-xl [animation-delay:400ms]"
          style={{ "background-color": `var(--color-${props.accentColor}-500)` }}
        >
          <div class="h-full w-full bg-stripes opacity-15" style={{ "--fx-color": "white" }} />
        </div>
      </div>
      <div class="relative flex h-full w-full flex-col items-center justify-center gap-6">
        <SlamText trigger={props.song.hash} class="text-2xl [animation-delay:500ms]">
          <TagChip
            label={t("game.nowSinging")}
            accent={<span class="block max-w-120 truncate">{props.song.artist}</span>}
            accentColor={`var(--color-${props.accentColor}-700)`}
          />
        </SlamText>
        <div class="max-w-240 px-8 text-center">
          <SlamText
            trigger={props.song.hash}
            class="text-8xl leading-tight text-display text-white [animation-delay:650ms]"
            style={{ "--display-shadow": `var(--color-${props.accentColor}-900)` }}
          >
            {props.song.title}
          </SlamText>
        </div>
      </div>
    </div>
  );
}
