import SlamText from "~/components/fx/slam-text";
import TagChip from "~/components/fx/tag-chip";
import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";
import { isLocalSong, isUsdbSong, type Song } from "~/lib/ultrastar/song";
import { getColorVar } from "~/lib/utils/color";

// The card leaves with a diagonal wipe to the right.
const CLIP_VISIBLE = "polygon(-20% 0, 120% 0, 120% 100%, 0% 100%)";
const CLIP_HIDDEN = "polygon(100% 0, 120% 0, 120% 100%, 120% 100%)";

/** Long titles step down a size, so most stay on one line and the rest wrap into two even ones. */
const titleSize = (title: string) => (title.length <= 22 ? "text-8xl" : "text-7xl");

interface SongIntroProps {
  song: Song;
  started: boolean;
  /** The mode gradient (e.g. "gradient-sing"), as on the rest of the mode's screens. */
  gradient: string;
  /** Palette name for the darker accents (chip segment, title shadow), e.g. "teal". */
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
      {/* The chip sits above the title on the band, like always. The band keeps its height for a one-line title and
          grows when a long one wraps. The title's bottom padding keeps its drop shadow inside the line clamp. */}
      <div class="relative flex h-full w-full items-center">
        <div class="relative flex min-h-[14cqw] w-full flex-col items-center justify-center gap-[1.2cqw] px-[4cqw] py-[2cqw]">
          <div
            class={`absolute inset-0 origin-left animate-band-in bg-linear-to-r [animation-delay:400ms] ${props.gradient}`}
          />
          <SlamText trigger={props.song.hash} class="relative text-2xl [animation-delay:500ms]">
            <TagChip
              label={t("game.nowSinging")}
              accent={<span class="block max-w-120 truncate">{props.song.artist}</span>}
              accentColor={getColorVar(props.accentColor, 700)}
            />
          </SlamText>
          <SlamText
            trigger={props.song.hash}
            class={`relative line-clamp-2 max-w-320 pb-[0.08em] text-center leading-[1.1] text-display text-balance text-white [animation-delay:650ms] ${titleSize(props.song.title)}`}
            style={{ "--display-shadow": getColorVar(props.accentColor, 900) }}
          >
            {props.song.title}
          </SlamText>
        </div>
      </div>
    </div>
  );
}
