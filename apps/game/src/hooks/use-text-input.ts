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

  const writeCharacter = (character: string) => {
    const input = inputRef();
    const cursor = input.selectionStart;
    if (cursor === null) return;
    
    input.value = input.value.slice(0, cursor) + character + input.value.slice(cursor);
    input.setSelectionRange(cursor + 1, cursor + 1);
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
    
    if (input.selectionStart) {
      input.scrollLeft = input.selectionStart * charWidth - input.clientWidth / 2;
    }
  };

  const selectAll = () => {
    const input = inputRef();
    input.select();
  };

  const sendInputEvent = () => {
    const input = inputRef();
    const data = {
      target: input,
      currentTarget: input,
      bubbles: true,
    };
    input.dispatchEvent(new Event("input", data));
  };

  return {
    moveCursor,
    writeCharacter,
    deleteCharacter,
    scrollToSelectionStart,
    sendInputEvent,
    selectAll,
  };
} 