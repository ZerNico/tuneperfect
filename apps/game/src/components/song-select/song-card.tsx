import type { LocalSong } from "~/lib/ultrastar/song";

interface SongCardProps {
  song: LocalSong;
}

export function SongCard(props: SongCardProps) {
  return (
    <button
      type="button"
      class="relative mx-4 aspect-square w-40 cursor-pointer overflow-hidden rounded-lg shadow-md transition-transform duration-250 active:scale-95"
    >
      <img class="relative z-1 h-full w-full object-cover" src={props.song.coverUrl ?? ""} alt={props.song.title} />
      <div class="absolute inset-0 bg-black" />
    </button>
  );
}
