// ICE candidates may arrive before the remote description is set.
// This utility buffers them until ready.

export function createIceCandidateBuffer() {
  let pendingCandidates: string[] = [];
  let remoteDescriptionSet = false;

  return {
    get isRemoteDescriptionSet() {
      return remoteDescriptionSet;
    },

    setRemoteDescriptionReady() {
      remoteDescriptionSet = true;
    },

    // Returns the candidate if it should be processed immediately, null if buffered
    addCandidate(candidate: string) {
      if (!remoteDescriptionSet) {
        pendingCandidates.push(candidate);
        return null;
      }
      return candidate;
    },

    flushCandidates() {
      const candidates = pendingCandidates;
      pendingCandidates = [];
      return candidates;
    },

    clear() {
      pendingCandidates = [];
      remoteDescriptionSet = false;
    },

    get bufferedCount() {
      return pendingCandidates.length;
    },
  };
}

export type IceCandidateBuffer = ReturnType<typeof createIceCandidateBuffer>;

export function parseIceCandidate(candidate: string) {
  return JSON.parse(candidate) as RTCIceCandidateInit;
}

export function serializeIceCandidate(candidate: RTCIceCandidate) {
  return JSON.stringify(candidate);
}

export async function processBufferedCandidates(
  pc: RTCPeerConnection,
  buffer: IceCandidateBuffer,
  onError?: (candidate: string, error: unknown) => void,
) {
  const candidates = buffer.flushCandidates();

  for (const candidate of candidates) {
    try {
      const iceCandidate = parseIceCandidate(candidate);
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      onError?.(candidate, error);
    }
  }
}

export async function addIceCandidateWithBuffer(
  pc: RTCPeerConnection,
  buffer: IceCandidateBuffer,
  candidate: string,
  onError?: (error: unknown) => void,
) {
  const immediateCandidate = buffer.addCandidate(candidate);

  if (immediateCandidate !== null) {
    try {
      const iceCandidate = parseIceCandidate(immediateCandidate);
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      onError?.(error);
    }
  }
}
