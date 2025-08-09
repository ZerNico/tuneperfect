let webSocket: WebSocket | undefined;

export async function initWebSocket() {
  await new Promise<void>((resolve) => {
    webSocket = new WebSocket("ws://localhost:8080");

    // TO-DO: do we need to handle multiple messages coming in, when people push the button multiple times?
    webSocket.onopen = () => {
      if (!webSocket) {
        return;
      }

      webSocket.onmessage = (message) => {
        console.log("webSocket message");
        console.log(message);
      };

      resolve();
    };
  });
}

export function sendWebsocketMessage(message: string) {
  if (!webSocket) {
    return;
  }

  webSocket.send(message);
  console.log("sent message!");
}
