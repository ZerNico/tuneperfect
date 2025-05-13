import { Match, type Ref, Show, Switch, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { beatToMs } from "~/lib/ultrastar/bpm";
import type { LocalSong } from "~/lib/ultrastar/parser/local";
import { createRefContent } from "~/lib/utils/ref";

export interface SongPlayerRef {
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface SongPlayerProps {
  ref?: Ref<SongPlayerRef>;
  song: LocalSong;
  volume?: number;
  playing?: boolean;
  class?: string;
  onCanPlayThrough?: () => void;
  onEnded?: () => void;
  isPreview?: boolean;
}

export default function SongPlayer(props: SongPlayerProps) {
  const [audioElement, setAudioElement] = createSignal<HTMLAudioElement | undefined>();
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [audioGainNode, setAudioGainNode] = createSignal<GainNode>();
  const [videoGainNode, setVideoGainNode] = createSignal<GainNode>();
  const [videoError, setVideoError] = createSignal(false);

  let syncTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
  const audioContext = new AudioContext();

  createEffect(
    on(audioElement, (audio) => {
      let source: MediaElementAudioSourceNode | undefined = undefined;
      let gainNode: GainNode | undefined = undefined;

      if (audio) {
        source = audioContext.createMediaElementSource(audio);
        gainNode = audioContext.createGain();
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        const replayGainAdjustment = props.song.replayGainTrackGain ? 10 ** (props.song.replayGainTrackGain / 20) : 1;
        gainNode.gain.value = (props.volume ?? 1) * replayGainAdjustment;
        setAudioGainNode(gainNode);
      }

      onCleanup(() => {
        gainNode?.disconnect();
        source?.disconnect();
      });
    })
  );

  createEffect(
    on(videoElement, (video) => {
      let source: MediaElementAudioSourceNode | undefined = undefined;
      let gainNode: GainNode | undefined = undefined;

      if (video) {
        source = audioContext.createMediaElementSource(video);
        gainNode = audioContext.createGain();
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        const replayGainAdjustment = props.song.replayGainTrackGain ? 10 ** (props.song.replayGainTrackGain / 20) : 1;
        gainNode.gain.value = (props.volume ?? 1) * replayGainAdjustment;
        setVideoGainNode(gainNode);
      }

      onCleanup(() => {
        gainNode?.disconnect();
        source?.disconnect();
      });
    })
  );

  createEffect(() => {
    const volume = props.volume ?? 1;
    const replayGainAdjustment = props.song.replayGainTrackGain ? 10 ** (props.song.replayGainTrackGain / 20) : 1;
    const adjustedVolume = volume * replayGainAdjustment;

    audioGainNode()?.gain.setValueAtTime(adjustedVolume, audioContext.currentTime);
    videoGainNode()?.gain.setValueAtTime(adjustedVolume, audioContext.currentTime);
  });

  const canPlayThrough = () => {
    const audio = audioElement();
    const video = videoElement();

    if (!audio && !video) {
      return false;
    }

    if (audio && audio.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      return false;
    }

    if (video && video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      return false;
    }

    return true;
  };

  const onCanPlayThrough = () => {
    if (!canPlayThrough()) {
      return;
    }

    props.onCanPlayThrough?.();

    if (props.playing) {
      startPlayback();
    }
  };

  const startPlayback = () => {
    const audio = audioElement();
    const video = videoElement();

    if ((audio && !document.body.contains(audio)) || (video && !document.body.contains(video))) {
      return;
    }

    console.log(video);

    if (!audio) {
      video?.play();
      return;
    }

    if (!video) {
      audio.play();
      return;
    }

    const videoGap = props.song.videoGap ?? 0;

    if (props.isPreview) {
      const firstNote = props.song.voices[0]?.phrases[0]?.notes[0];
      const previewStart = props.song.previewStart ?? (firstNote ? beatToMs(props.song, firstNote.startBeat) / 1000 - 2 + videoGap : 0);

      if (video.currentTime === 0) {
        video.currentTime = previewStart;
      }
      if (audio.currentTime === 0) {
        audio.currentTime = previewStart;
      }
    }

    const gap = video.currentTime - audio.currentTime - videoGap;

    if (gap > 0) {
      if (audio.currentTime + gap <= audio.duration) {
        audio.currentTime += gap;
        audio.play();
        video.play();
      } else {
        audio.play();
        syncTimeout = setTimeout(() => {
          video.play();
        }, gap * 1000);
      }
    } else if (gap < 0) {
      const absoluteGap = Math.abs(gap);
      if (video.currentTime + absoluteGap <= video.duration) {
        video.currentTime += absoluteGap;
        audio.play();
        video.play();
      } else {
        video.play();
        syncTimeout = setTimeout(() => {
          audio.play();
        }, absoluteGap * 1000);
      }
    } else {
      audio.play();
      video.play();
    }
  };

  const stopPlayback = () => {
    audioElement()?.pause();
    videoElement()?.pause();
    clearTimeout(syncTimeout);
  };

  createEffect(
    on(
      () => props.playing,
      (playing) => {
        if (playing && canPlayThrough()) {
          startPlayback();
        } else if (!playing) {
          stopPlayback();
        }
      }
    )
  );

  createEffect(
    on(
      () => props.song,
      () => {
        clearTimeout(syncTimeout);
        stopPlayback();
        setVideoError(false);

        if (canPlayThrough()) {
          startPlayback();
        }
      }
    )
  );

  const handleEnded = () => {
    props.onEnded?.();
  };

  createRefContent(
    () => props.ref,
    () => ({
      getCurrentTime: () => {
        const audio = audioElement();
        const video = videoElement();
        if (audio) {
          return audio.currentTime;
        }
        if (video) {
          return video.currentTime;
        }
        return 0;
      },
      getDuration: () => {
        const audio = audioElement();
        const video = videoElement();
        if (audio) {
          return audio.duration;
        }
        if (video) {
          return video.duration;
        }
        return 0;
      },
    })
  );

  onMount(() => {
    if (canPlayThrough()) {
      startPlayback();
    }
  });

  onCleanup(() => {
    clearTimeout(syncTimeout);
    stopPlayback();
  });

  return (
    <div
      class="relative h-full w-full bg-black"
      classList={{
        [props.class || ""]: true,
      }}
    >
      <Switch>
        <Match when={!videoError() && props.song.videoUrl}>
          {(videoUrl) => (
            <video
              muted={!!props.song.audioUrl}
              class="h-full w-full object-cover"
              ref={setVideoElement}
              preload="auto"
              onCanPlayThrough={onCanPlayThrough}
              onEnded={!props.song.audioUrl ? handleEnded : undefined}
              src={videoUrl()}
              onError={() => {
                setVideoError(true);
                setVideoElement(undefined);
                startPlayback();
              }}
            />
          )}
        </Match>
        <Match when={props.song.backgroundUrl}>
          {(backgroundUrl) => <img alt="" class="h-full w-full object-contain" src={backgroundUrl()} />}
        </Match>
        <Match when={props.song.coverUrl}>
          {(coverUrl) => (
            <div class="relative h-full w-full">
              <img src={coverUrl()} alt="" class="absolute inset-0 h-full w-full object-cover blur-2xl" />
              <img src={coverUrl()} alt="" class="relative h-full w-full object-contain" />
            </div>
          )}
        </Match>
      </Switch>

      <Show when={props.song.audioUrl}>
        {(audioUrl) => (
          <audio ref={setAudioElement} preload="auto" onCanPlayThrough={onCanPlayThrough} onEnded={handleEnded} src={audioUrl()} />
        )}
      </Show>
    </div>
  );
}
