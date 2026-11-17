// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play,
// paused and game over.
//
// ?seed=N fixes the city. ?shot=cover|onfoot|driving|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createGame, loadSaveInto, readSave, resetGame, stepGame } from './state.js';
import {
  ACTION_CONFIRM,
  ACTION_CONTINUE,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  ACTION_SAVE,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
const renderer = createRenderer(canvas);

/** The mouse position in world coordinates, for punching toward the cursor. */
function mouseWorld(input) {
  const mouse = input.mouse();
  return renderer.toWorld(mouse.x, mouse.y, game);
}

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startFresh() {
    resetGame(game, Math.floor(Math.random() * 4294967296));
    game.screen = SCREEN_PLAY;
    announce('Playing. Steal a car — Mara is waiting.');
  }

  function startContinued() {
    const save = readSave();
    resetGame(game, Math.floor(Math.random() * 4294967296));
    if (save) loadSaveInto(game, save);
    game.screen = SCREEN_PLAY;
    announce('Continued. Mara is waiting.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      game.audio.setMuted(!game.audio.isMuted());
      game.message(game.audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_SAVE && game.screen === SCREEN_PLAY) {
      game.saveGame();
      game.message('Progress saved.');
    }
    if (game.screen === SCREEN_TITLE) {
      if (actions & ACTION_CONTINUE && game.hasSave) startContinued();
      else if (actions & ACTION_CONFIRM) startFresh();
      return;
    }
    if (game.screen === SCREEN_PLAY) {
      if (actions & ACTION_CONFIRM && game.dialogue) {
        game.dialogue.index += 1;
        game.dialogue.timer = 0;
        if (game.dialogue.index >= game.dialogue.lines.length) game.dialogue = null;
        return;
      }
      if (actions & ACTION_PAUSE) {
        game.screen = SCREEN_PAUSED;
        game.saveGame();
        announce('Paused.');
      }
      return;
    }
    if (game.screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        game.screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) {
        startFresh();
      }
      return;
    }
    if (game.screen === SCREEN_OVER) {
      if (actions & ACTION_RESTART) startFresh();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (input.takeAnyKey()) game.audio.ensure();
    // Actions are edge-triggered: take them once a frame, hand them to the
    // screen logic and to the first simulation step.
    const actions = input.takeActions();
    handleActions(actions);
    const dir = input.direction();
    const stepInput = {
      dir,
      actions,
      mouseWorld: mouseWorld(input),
      handbrake: dir.handbrake,
    };
    while (accumulator >= STEP) {
      stepGame(game, stepInput, STEP);
      accumulator -= STEP;
      stepInput.actions = 0;
      if (game.screen === SCREEN_OVER) accumulator = 0;
    }
    renderer.draw(game, game.screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === SCREEN_PLAY) {
      game.screen = SCREEN_PAUSED;
      game.saveGame();
      announce('Paused.');
    }
  });

  announce('Solmar. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
