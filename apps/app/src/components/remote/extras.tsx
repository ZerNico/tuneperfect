import type { Extras } from "@tuneperfect/webrtc/contracts/game";
import { createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import IconMusicNotes from "~icons/ph/music-notes-fill";
import IconSliders from "~icons/ph/sliders-horizontal-bold";
import IconX from "~icons/ph/x-bold";

import SongCover from "~/components/song-cover";
import Sheet from "~/components/ui/sheet";
import { useGameConnection } from "~/contexts/game-client";
import { t } from "~/lib/i18n";
import { useRemote } from "~/lib/remote";

type TextExtra = NonNullable<Extras["text"]>;
type SongsExtra = NonNullable<Extras["songs"]>;

/** Typing goes to the TV after this pause, so it isn't sent letter by letter. */
const TEXT_DEBOUNCE_MS = 200;

/**
 * What the TV wants typed (a search, a name), typed with the phone's keyboard. While it has focus
 * it shows what's typed, not the TV's echo.
 */
export function TextExtraField(props: { text: TextExtra }) {
  const remote = useRemote();
  const [focused, setFocused] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const send = (value: string) => {
    clearTimeout(timer);
    void remote.act({ type: "text", surface: props.text.surface, value });
  };
  const value = () => (focused() ? draft() : props.text.value);

  return (
    <label class="flex flex-col gap-1.5">
      <span class="text-sm font-bold text-white/60">{props.text.label}</span>
      <span class="flex h-12 items-center gap-2 rounded-[12px] bg-white/8 px-3 focus-within:ring-2 focus-within:ring-white/40">
        <input
          type={props.text.secret ? "password" : "text"}
          class="min-w-0 grow bg-transparent text-white outline-none"
          value={value()}
          maxLength={props.text.maxLength}
          autocomplete="off"
          enterkeyhint="done"
          onFocus={() => {
            setDraft(props.text.value);
            setFocused(true);
          }}
          onBlur={() => {
            if (draft() !== props.text.value) send(draft());
            setFocused(false);
          }}
          onInput={(event) => {
            const next = event.currentTarget.value;
            setDraft(next);
            clearTimeout(timer);
            timer = setTimeout(() => send(next), TEXT_DEBOUNCE_MS);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <Show when={value() && !props.text.secret}>
          <button
            type="button"
            aria-label={t("remote.clearText")}
            class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-white/60 hover:bg-white/10"
            // Before the field loses focus, so the cleared draft is what's sent.
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              setDraft("");
              send("");
            }}
          >
            <IconX />
          </button>
        </Show>
      </span>
    </label>
  );
}

/**
 * The song select: the song on the TV, and one button for its sort and filters. Active filters
 * stay visible next to it and come off with a tap.
 */
export function SongsStrip(props: { songs: SongsExtra }) {
  const remote = useRemote();
  const client = useGameConnection();
  const [open, setOpen] = createSignal(false);
  const active = () => props.songs.filters.filter((candidate) => candidate.value !== null);
  const sortLabel = () => props.songs.sorts.find((sort) => sort.value === props.songs.sort)?.label ?? "";
  const setFilter = (id: string, value: string | null) =>
    void remote.act({ type: "songs.filter", surface: props.songs.surface, filter: id, value });
  const optionLabel = (item: SongsExtra["filters"][number]) =>
    item.options.find((option) => option.value === item.value)?.label ?? item.value;

  return (
    <div class="flex flex-col gap-3">
      <div class="flex min-h-14 items-center gap-3 rounded-[14px] bg-white/7 p-2">
        <Show
          when={props.songs.song}
          fallback={
            <span class="flex items-center gap-2 px-2 text-white/50">
              <IconMusicNotes />
              {t("songs.noResults")}
            </span>
          }
        >
          {(song) => (
            <>
              <SongCover hash={song().hash} client={client()} class="size-11 rounded-[8px]" />
              <span class="flex min-w-0 grow flex-col">
                <span class="truncate font-bold">{song().title}</span>
                <span class="truncate text-sm text-white/60">{song().artist}</span>
              </span>
            </>
          )}
        </Show>
      </div>

      <div class="flex flex-wrap gap-2">
        <Chip onClick={() => setOpen(true)}>
          <IconSliders />
          {sortLabel()}
          <Show when={active().length > 0}>
            <span class="flex size-5 items-center justify-center rounded-full bg-white text-xs text-slate-900">
              {active().length}
            </span>
          </Show>
        </Chip>
        <For each={active()}>
          {(item) => (
            <Chip active onClick={() => setFilter(item.id, null)}>
              {optionLabel(item)}
              <IconX class="text-sm opacity-70" />
            </Chip>
          )}
        </For>
      </div>

      <Show when={open()}>
        <SortFilterSheet songs={props.songs} onClose={() => setOpen(false)} onFilter={setFilter} />
      </Show>
    </div>
  );
}

/** Sort and every filter in one sheet, each as a row of options: a tap applies it on the TV. */
function SortFilterSheet(props: {
  songs: SongsExtra;
  onClose: () => void;
  onFilter: (id: string, value: string | null) => void;
}) {
  const remote = useRemote();
  const anyActive = () => props.songs.filters.some((item) => item.value !== null);

  return (
    <Sheet open onOpenChange={(open) => !open && props.onClose()} title={t("remote.songs.title")}>
      <div class="flex flex-col gap-5">
        <Section label={t("remote.songs.sort")}>
          <For each={props.songs.sorts}>
            {(sort) => (
              <Chip
                active={props.songs.sort === sort.value}
                onClick={() => void remote.act({ type: "songs.sort", surface: props.songs.surface, sort: sort.value })}
              >
                {sort.label}
              </Chip>
            )}
          </For>
        </Section>
        <For each={props.songs.filters}>
          {(item) => (
            <Section label={item.label}>
              <Chip active={item.value === null} onClick={() => props.onFilter(item.id, null)}>
                {t("remote.songs.any")}
              </Chip>
              <For each={item.options}>
                {(option) => (
                  <Chip active={item.value === option.value} onClick={() => props.onFilter(item.id, option.value)}>
                    {option.label}
                  </Chip>
                )}
              </For>
            </Section>
          )}
        </For>
        <Show when={anyActive()}>
          <button
            type="button"
            class="flex h-12 shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-white/8 font-bold text-red-300 transition-colors hover:bg-white/12"
            onClick={() => {
              for (const item of props.songs.filters) if (item.value !== null) props.onFilter(item.id, null);
            }}
          >
            {t("remote.songs.clearFilters")}
          </button>
        </Show>
      </div>
    </Sheet>
  );
}

/** A heading with its options in one row; long lists (genres) scroll sideways. */
function Section(props: { label: string; children: JSX.Element }) {
  return (
    <section class="flex flex-col gap-2">
      <h3 class="text-xs font-bold tracking-[0.12em] text-white/50 uppercase">{props.label}</h3>
      {/* One row to swipe on phones; wrapped where a mouse can't scroll sideways. */}
      <div class="-mx-6 flex [scrollbar-width:none] gap-2 overflow-x-auto px-6 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {props.children}
      </div>
    </section>
  );
}

function Chip(props: { active?: boolean; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      type="button"
      class="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-sm font-bold transition-colors"
      classList={{ "bg-white text-slate-900": props.active, "bg-white/8 hover:bg-white/12": !props.active }}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}
