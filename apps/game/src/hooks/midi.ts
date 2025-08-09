import { createEffect, onCleanup } from "solid-js";

let _midiInputDevices: MIDIInput[] = [];
let _midiOutputDevices: MIDIOutput[] = [];

export async function registerMidiInputs() {
  const access = await window.navigator.requestMIDIAccess();
  console.log(access);

  _midiInputDevices = Array.from(access.inputs.values());
  _midiOutputDevices = Array.from(access.outputs.values());

  access.onstatechange = (e) => {
    // Print information about the (dis)connected MIDI controller

    if (!e.port) {
      return;
    }

    console.log(e.port.name, e.port.manufacturer, e.port.state);
  };
}

export function sendMidiNote(channel: number, note: number, value?: number) {
  const loopbackMidiDevice = _midiOutputDevices.find((device) => device.name === "loopMIDI Port");
  if (!loopbackMidiDevice) {
    return;
  }

  loopbackMidiDevice.send([0x90 | (channel - 1), note, value ?? 127]);
}

/**
 * A SolidJS hook that listens for MIDI note-on messages on all available MIDI input devices.
 * The callback is fired when a MIDI note with the specified note number is received.
 *
 * @param {Accessor<number>} noteNumber - A SolidJS accessor (signal) representing the MIDI note number to listen for.
 * @param {(message: MIDIMessageEvent) => void} callback - The function to call when the specified MIDI note-on message is received.
 * @param {MIDIAccess} midiAccess - The MIDIAccess object obtained from navigator.requestMIDIAccess().
 */
export function createMidiNoteListener(
  channel: number,
  noteNumber: number | undefined,
  callback: (event: MIDIMessageEvent) => void,
) {
  createEffect(() => {
    // Store references to the listeners so we can remove them later
    const activeListeners = new Map();

    // Define the event handler function
    const handleMidiMessage: (this: MIDIInput, ev: MIDIMessageEvent) => void = (event) => {
      console.log("midi event!");
      console.log(event);

      const statusByte = 0x90 | (channel - 1);
      if (event.data && event.data[0] === statusByte) {
        if (!noteNumber || event.data[1] === noteNumber) {
          callback(event);
        }
      }
    };

    // Add listeners to all available MIDI input devices
    _midiInputDevices.forEach((input) => {
      input.addEventListener("midimessage", handleMidiMessage);
      activeListeners.set(input, handleMidiMessage);
      console.log(`Listening for note ${noteNumber} on MIDI input: ${input.name}`);
    });

    // Cleanup function: remove event listeners when the effect re-runs or component unmounts
    onCleanup(() => {
      activeListeners.forEach((handler, input) => {
        input.removeEventListener("midimessage", handler);
        console.log(`Stopped listening for note ${noteNumber} on MIDI input: ${input.name}`);
      });
      activeListeners.clear();
    });
  });
}
