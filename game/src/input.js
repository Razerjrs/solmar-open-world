// Keyboard and mouse input: a held-key set plus edge-triggered actions, so the
// game reads "pressed this frame" without missing a tap between frames.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;
export const ACTION_RESTART = 64;
export const ACTION_CONTINUE = 128;

/** Keys that steer: WASD and the arrow keys. */
const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let mouse = { x: 0, y: 0, clicked: false };
  let anyKey = false;

  function press(action) {
    queued |= action;
    anyKey = true;
  }

  function onKeyDown(event) {
    const move = MOVE_KEYS[event.code];
    if (move) {
      held.add(move);
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.add('run');
    if (event.code === 'Space') held.add('handbrake');
    if (event.code === 'Enter' || event.code === 'Space') press(ACTION_CONFIRM);
    if (event.code === 'Escape' || event.code === 'KeyP') press(ACTION_PAUSE);
    if (event.code === 'KeyE') press(ACTION_ENTER_CAR);
    if (event.code === 'KeyF') press(ACTION_PUNCH);
    if (event.code === 'KeyM') press(ACTION_MUTE);
    if (event.code === 'KeyK') press(ACTION_SAVE);
    if (event.code === 'KeyR') press(ACTION_RESTART);
    if (event.code === 'KeyC') press(ACTION_CONTINUE);
    if (event.code === 'Space') event.preventDefault();
  }

  function onKeyUp(event) {
    const move = MOVE_KEYS[event.code];
    if (move) held.delete(move);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.delete('run');
    if (event.code === 'Space') held.delete('handbrake');
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouse.clicked = true;
    press(ACTION_PUNCH);
    press(ACTION_CONFIRM);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** The steering vector from the held keys: x and y in [-1, 1]. */
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('left')) x -= 1;
      if (held.has('right')) x += 1;
      if (held.has('up')) y -= 1;
      if (held.has('down')) y += 1;
      return { x, y, run: held.has('run'), handbrake: held.has('handbrake') };
    },
    /** The mouse position in canvas pixels, and whether it was clicked this frame. */
    mouse() {
      return mouse;
    },
    /** Take and clear the actions queued since the last call. */
    takeActions() {
      const actions = queued;
      queued = 0;
      mouse.clicked = false;
      return actions;
    },
    /** True when any key or click happened since the last call. */
    takeAnyKey() {
      const value = anyKey;
      anyKey = false;
      return value;
    },
  };
}
