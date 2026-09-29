/** Edits a text input like typing would (for the virtual keyboard), firing `input` events. */
export function useTextInput(inputRef: () => HTMLInputElement) {
  const moveCursor = (direction: "left" | "right") => {
    const input = inputRef();
    const selectionStart = input.selectionStart;
    if (selectionStart === null) return;

    const newSelectionStart = selectionStart + (direction === "left" ? -1 : 1);
    if (newSelectionStart < 0) {
      return;
    }

    input.setSelectionRange(newSelectionStart, newSelectionStart);
    scrollToSelectionStart();
  };

  /** Replaces the selection (or inserts at the caret), unless that would exceed the input's maxLength. */
  const writeCharacter = (character: string) => {
    if (!character) return;

    const input = inputRef();
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start === null || end === null) return;

    const value = input.value.slice(0, start) + character + input.value.slice(end);
    // maxLength is -1 when not set.
    if (input.maxLength >= 0 && value.length > input.maxLength) return;

    input.value = value;
    input.setSelectionRange(start + character.length, start + character.length);
    sendInputEvent();
    scrollToSelectionStart();
  };

  const deleteCharacter = () => {
    const input = inputRef();
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;

    if (selectionStart === null || selectionEnd === null) return;

    if (selectionStart !== selectionEnd) {
      input.value = input.value.slice(0, selectionStart) + input.value.slice(selectionEnd);
      input.setSelectionRange(selectionStart, selectionStart);
    } else {
      if (selectionStart === 0) return;
      input.value = input.value.slice(0, selectionStart - 1) + input.value.slice(selectionStart);
      input.setSelectionRange(selectionStart - 1, selectionStart - 1);
    }

    scrollToSelectionStart();
    sendInputEvent();
  };

  const scrollToSelectionStart = () => {
    const input = inputRef();
    const fontSize = window.getComputedStyle(input).fontSize;
    const fontSizeNumber = Number.parseFloat(fontSize);
    const charWidth = fontSizeNumber * 0.55;

    if (input.selectionStart !== null) {
      input.scrollLeft = input.selectionStart * charWidth - input.clientWidth / 2;
    }
  };

  const sendInputEvent = () => {
    inputRef().dispatchEvent(new Event("input", { bubbles: true }));
  };

  return { moveCursor, writeCharacter, deleteCharacter };
}
