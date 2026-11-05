// A press that takes the focus from a field: the field's message waits for it to end. Otherwise the message appears
// on the way down (the focus moves on pointerdown), pushes the button that was pressed from under the pointer, and the
// click lands where the button was: WebKit lays out between the press and the release. Found in setup's Next.

let pressed = false;
let watching = false;

/** Starts following presses, once per page; a field calls it when it mounts, before any press can blur it. */
export function watchPresses(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  // Capture, so the flag is set before the field hears that it lost the focus.
  window.addEventListener('pointerdown', () => (pressed = true), true);
  window.addEventListener('pointerup', () => (pressed = false), true);
  window.addEventListener('pointercancel', () => (pressed = false), true);
}

/** Runs `then` right away, or, while a press is going on, once it has ended and its click has landed. */
export function afterPress(then: () => void): void {
  if (!pressed) return then();
  const done = () => {
    window.removeEventListener('pointerup', done);
    window.removeEventListener('pointercancel', done);
    // The click follows the release in the same turn: a timeout runs after it.
    setTimeout(then);
  };
  window.addEventListener('pointerup', done);
  window.addEventListener('pointercancel', done);
}
