import { iceServers } from "./ice-servers";
import type { DataChannelMessage, SongSummary } from "./types";

export interface GuestConnectionCallbacks {
  onIceCandidate: (candidate: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onSongs: (songs: SongSummary[]) => void;
}

export interface GuestConnection {
  pc: RTCPeerConnection;
  createOffer: () => Promise<string>;
  setAnswer: (answerSdp: string) => Promise<void>;
  addIceCandidate: (candidate: string) => Promise<void>;
  close: () => void;
}

/**
 * Creates a WebRTC connection for the guest (mobile app) to connect to the host (game client).
 * The guest creates a data channel to receive song data from the host.
 *
 * Note: The guest creates the data channel as part of the offer, and the host will
 * receive it via ondatachannel and use it to send songs.
 */
export function createGuestConnection(callbacks: GuestConnectionCallbacks): GuestConnection {
  const pc = new RTCPeerConnection({ iceServers });

  // Buffer for ICE candidates received before remote description is set
  let pendingIceCandidates: string[] = [];
  let remoteDescriptionSet = false;

  // Create data channel for receiving songs from host
  // The guest creates this so it's included in the offer
  const dataChannel = pc.createDataChannel("songs", {
    ordered: true,
  });

  dataChannel.onopen = () => {
    console.log("[WebRTC] Data channel opened");
  };

  dataChannel.onclose = () => {
    console.log("[WebRTC] Data channel closed");
  };

  dataChannel.onerror = (error) => {
    console.error("[WebRTC] Data channel error:", error);
  };

  dataChannel.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as DataChannelMessage;

      if (message.type === "songs") {
        console.log(`[WebRTC] Received ${message.data.length} songs`);
        callbacks.onSongs(message.data);
      }
    } catch (error) {
      console.error("[WebRTC] Failed to parse data channel message:", error);
    }
  };

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      callbacks.onIceCandidate(JSON.stringify(event.candidate));
    }
  };

  // Track connection state
  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
    callbacks.onConnectionStateChange(pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`[WebRTC] ICE connection state: ${pc.iceConnectionState}`);
  };

  /**
   * Create an offer to send to the host
   */
  const createOffer = async (): Promise<string> => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (!offer.sdp) {
      throw new Error("Failed to create offer SDP");
    }

    return offer.sdp;
  };

  /**
   * Set the answer from the host
   */
  const setAnswer = async (answerSdp: string) => {
    await pc.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });

    remoteDescriptionSet = true;

    // Process any buffered ICE candidates
    if (pendingIceCandidates.length > 0) {
      console.log(`[WebRTC] Processing ${pendingIceCandidates.length} buffered ICE candidates`);
      for (const candidate of pendingIceCandidates) {
        try {
          const iceCandidate = JSON.parse(candidate) as RTCIceCandidateInit;
          await pc.addIceCandidate(iceCandidate);
        } catch (error) {
          console.error("[WebRTC] Failed to add buffered ICE candidate:", error);
        }
      }
      pendingIceCandidates = [];
    }
  };

  /**
   * Add an ICE candidate from the host
   */
  const addIceCandidate = async (candidate: string) => {
    if (!remoteDescriptionSet) {
      // Buffer the candidate until remote description is set
      console.log("[WebRTC] Buffering ICE candidate (remote description not set yet)");
      pendingIceCandidates.push(candidate);
      return;
    }

    try {
      const iceCandidate = JSON.parse(candidate) as RTCIceCandidateInit;
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      console.error("[WebRTC] Failed to add ICE candidate:", error);
    }
  };

  /**
   * Close the connection
   */
  const close = () => {
    dataChannel.close();
    pc.close();
    console.log("[WebRTC] Connection closed");
  };

  return {
    pc,
    createOffer,
    setAnswer,
    addIceCandidate,
    close,
  };
}
