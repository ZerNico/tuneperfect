import { Match, type Ref, Show, Switch, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
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
}

export default function SongPlayer(props: SongPlayerProps) {
  const [audioElement, setAudioElement] = createSignal<HTMLAudioElement | undefined>();
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [audioGainNode, setAudioGainNode] = createSignal<GainNode>();
  const [videoGainNode, setVideoGainNode] = createSignal<GainNode>();
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

    if (!audio) {
      video?.play();
      return;
    }

    if (!video) {
      audio.play();
      return;
    }

    const videoGap = props.song.videoGap ?? 0;

    const videoCurrentTime = video.currentTime;
    const audioCurrentTime = audio.currentTime;

    const gap = videoCurrentTime - audioCurrentTime - videoGap;

    clearTimeout(syncTimeout);

    if (gap > 0) {
      audio.play();
      syncTimeout = setTimeout(() => {
        video.play();
      }, gap * 1000);
    } else if (gap < 0) {
      video.play();
      syncTimeout = setTimeout(
        () => {
          audio.play();
        },
        gap * 1000 * -1
      );
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
        <Match when={props.song.videoUrl}>
          {(videoUrl) => (
            <video
              muted={!!props.song.audioUrl}
              class="h-full w-full object-cover"
              ref={setVideoElement}
              preload="auto"
              onCanPlayThrough={onCanPlayThrough}
              onEnded={!props.song.audioUrl ? handleEnded : undefined}
              src={videoUrl()}
            />
          )}
        </Match>
        <Match when={props.song.backgroundUrl}>
          {(backgroundUrl) => <img alt="" class="h-full w-full object-contain" src={backgroundUrl()} />}
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
