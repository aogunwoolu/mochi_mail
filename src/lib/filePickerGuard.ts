// Windows/Chromium has a long-standing quirk: after the native file-picker
// dialog closes (e.g. double-clicking a file to select it), a stray click
// event is sometimes delivered to whatever sits under the dialog on the page
// underneath — which can land on and toggle unrelated UI (like a header menu
// button) right as the "file selected" change event fires.
//
// Call `markFilePickerOpening()` right before triggering a hidden
// `<input type="file">`'s `.click()`, and have anything that would react to a
// stray/unintended click (closing a panel, toggling a menu) check
// `justOpenedFilePicker()` first and no-op if it's within the guard window.
let openedAt = 0;

export function markFilePickerOpening() {
  openedAt = Date.now();
}

export function justOpenedFilePicker(windowMs = 800): boolean {
  return Date.now() - openedAt < windowMs;
}
