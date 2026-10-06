import type { Extras } from "@tuneperfect/webrtc/contracts/game";
import { createSignal, For, onCleanup, Show } from "solid-js";
import IconCheck from "~icons/ph/check-bold";
import IconMusicNotes from "~icons/ph/music-notes-fill";
import IconSliders from "~icons/ph/sliders-horizontal-bold";
import IconX from "~icons/ph/x-bold";

import SongCover from "~/components/song-cover";
import Dialog from "~/components/ui/dialog";
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

/** The song select: the song on the TV, its sort as chips and its filters to pick from a list. */
export function SongsStrip(props: { songs: SongsExtra }) {
  const remote = useRemote();
  const client = useGameConnection();
  const [filtersOpen, setFiltersOpen] = createSignal(false);
  const [editing, setEditing] = createSignal<string | null>(null);
  const filter = () => props.songs.filters.find((candidate) => candidate.id === editing());
  const active = () => props.songs.filters.filter((candidate) => candidate.value !== null);
  const setFilter = (id: string, value: string | null) =>
    void remote.act({ type: "songs.filter", surface: props.songs.surface, filter: id, value });
  const optionLabel = (item: SongsExtra["filters"][number]) =>
    item.options.find((option) => option.value === item.value)?.label ?? t("remote.songs.any");

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

      <div class="-mx-6 flex [scrollbar-width:none] gap-2 overflow-x-auto px-6">
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
      </div>

      <Show when={props.songs.filters.length > 0}>
        <div class="flex flex-wrap gap-2">
          <Chip onClick={() => setFiltersOpen(true)}>
            <IconSliders />
            {t("remote.songs.filters")}
          </Chip>
          <For each={active()}>
            {(item) => (
              <Chip active onClick={() => setFilter(item.id, null)}>
                {optionLabel(item)}
                <IconX class="text-sm opacity-80" />
              </Chip>
            )}
          </For>
        </div>
      </Show>

      <Show when={filtersOpen() && !filter()}>
        <Dialog title={t("remote.songs.filters")} onClose={() => setFiltersOpen(false)}>
          <div class="-mx-2 flex flex-col gap-1">
            <For each={props.songs.filters}>
              {(item) => (
                <button
                  type="button"
                  class="flex min-h-12 cursor-pointer items-center gap-3 rounded-[12px] px-3 text-start font-bold transition-colors hover:bg-white/8"
                  onClick={() => setEditing(item.id)}
                >
                  <span class="min-w-0 grow truncate">{item.label}</span>
                  <span class="max-w-[50%] truncate text-white/60">{optionLabel(item)}</span>
                </button>
              )}
            </For>
          </div>
        </Dialog>
      </Show>
      <Show when={filter()}>
        {(current) => (
          <Dialog title={current().label} onClose={() => setEditing(null)}>
            <div class="-mx-2 flex max-h-[60dvh] flex-col gap-1 overflow-y-auto">
              <For each={[{ value: null, label: t("remote.songs.any") }, ...current().options]}>
                {(option) => (
                  <button
                    type="button"
                    class="flex min-h-12 shrink-0 cursor-pointer items-center gap-3 rounded-[12px] px-3 text-start font-bold transition-colors hover:bg-white/8"
                    classList={{ "bg-white/10": option.value === current().value }}
                    onClick={() => {
                      setFilter(current().id, option.value);
                      setEditing(null);
                    }}
                  >
                    <span class="min-w-0 grow truncate">{option.label}</span>
                    <Show when={option.value === current().value}>
                      <IconCheck class="shrink-0" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </Dialog>
        )}
      </Show>
    </div>
  );
}

function Chip(props: { active?: boolean; onClick: () => void; children: import("solid-js").JSX.Element }) {
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
