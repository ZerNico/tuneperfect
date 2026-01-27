import { iceServers } from "./ice-servers";
import type { DataChannelMessage, SongSummary } from "./types";

export interface HostConnectionCallbacks {
  onIceCandidate: (candidate: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onDataChannelOpen: () => void;
}

export interface HostConnection {
  pc: RTCPeerConnection;
  userId: string;
  sendSongs: (songs: SongSummary[]) => void;
  createAnswer: (offerSdp: string) => Promise<string>;
  addIceCandidate: (candidate: string) => Promise<void>;
  close: () => void;
  isDataChannelOpen: () => boolean;
}

/**
 * Creates a WebRTC connection for the host (game client) to a specific guest (mobile app user).
 * The host receives a data channel from the guest and uses it to send song data.
 *
 * Note: The guest creates the data channel as part of their offer. The host receives it
 * via the ondatachannel event after setting the remote description.
 */
export function createHostConnection(userId: string, callbacks: HostConnectionCallbacks): HostConnection {
  const pc = new RTCPeerConnection({ iceServers });

  // Data channel will be received from the guest via ondatachannel
  let dataChannel: RTCDataChannel | null = null;

  // Handle incoming data channel from guest
  pc.ondatachannel = (event) => {
    dataChannel = event.channel;
    console.log(`[WebRTC] Data channel received from user ${userId}: ${dataChannel.label}`);

    dataChannel.onopen = () => {
      console.log(`[WebRTC] Data channel opened for user ${userId}`);
      callbacks.onDataChannelOpen();
    };

    dataChannel.onclose = () => {
      console.log(`[WebRTC] Data channel closed for user ${userId}`);
    };

    dataChannel.onerror = (event) => {
      console.error(`[WebRTC] Data channel error for user ${userId}:`, event);
    };
  };

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      callbacks.onIceCandidate(JSON.stringify(event.candidate));
    }
  };

  // Track connection state
  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection state for user ${userId}: ${pc.connectionState}`);
    callbacks.onConnectionStateChange(pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`[WebRTC] ICE connection state for user ${userId}: ${pc.iceConnectionState}`);
  };

  /**
   * Check if data channel is open
   */
  const isDataChannelOpen = (): boolean => {
    return dataChannel !== null && dataChannel.readyState === "open";
  };

  /**
   * Send the song list to the connected guest
   */
  const sendSongs = (songs: SongSummary[]) => {
    if (dataChannel !== null && dataChannel.readyState === "open") {
      const message: DataChannelMessage = {
        type: "songs",
        data: songs,
      };
      dataChannel.send(JSON.stringify(message));
      console.log(`[WebRTC] Sent ${songs.length} songs to user ${userId}`);
    } else {
      console.warn(
        `[WebRTC] Cannot send songs - data channel not open for user ${userId} (state: ${dataChannel?.readyState ?? "null"})`,
      );
    }
  };

  /**
   * Process an offer from the guest and create an answer.
   */
  const createAnswer = async (offerSdp: string): Promise<string> => {
    // Set the remote description (the offer from guest)
    await pc.setRemoteDescription({
      type: "offer",
      sdp: offerSdp,
    });

    // Create and set the answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (!answer.sdp) {
      throw new Error("Failed to create answer SDP");
    }

    return answer.sdp;
  };

  /**
   * Add an ICE candidate from the guest
   */
  const addIceCandidate = async (candidate: string) => {
    try {
      const iceCandidate = JSON.parse(candidate) as RTCIceCandidateInit;
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      console.error(`[WebRTC] Failed to add ICE candidate for user ${userId}:`, error);
    }
  };

  /**
   * Close the connection
   */
  const close = () => {
    if (dataChannel) {
      dataChannel.close();
    }
    pc.close();
    console.log(`[WebRTC] Connection closed for user ${userId}`);
  };

  return {
    pc,
    userId,
    sendSongs,
    createAnswer,
    addIceCandidate,
    close,
    isDataChannelOpen,
  };
}
