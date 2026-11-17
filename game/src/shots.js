// The screenshot scenes behind ?shot=cover|onfoot|driving|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of steps,
// steered by a scripted driver, so the frame is what a short game really looks
// like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { resetGame, stepGame } from './state.js';
import { missionDef } from './missions.js';
import { SCREEN_PLAY } from './render.js';

/** Steer a car toward a point: throttle on, steer by the angle to it. */
function driveInput(G, tx, ty) {
  const car = G.player.car;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    dir: { x: Math.max(-1, Math.min(1, diff * 2)), y: -1, run: false },
    actions: 0,
    mouseWorld: { x: G.player.x, y: G.player.y },
    handbrake: false,
  };
}

/** Walk toward a point on foot. */
function walkInput(G, tx, ty) {
  const dx = tx - G.player.x;
  const dy = ty - G.player.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    dir: { x: dx / length, y: dy / length, run: false },
    actions: 0,
    mouseWorld: { x: tx, y: ty },
    handbrake: false,
  };
}

/** Run the game forward for `seconds` with a scripted input function. */
function simulate(G, seconds, inputFor) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepGame(G, inputFor(G), STEP);
    if (G.screen !== 'play') break;
  }
}

/** Put the player in a car at a spot, facing an angle. */
function putPlayerInCar(G, type, x, y, angle) {
  const car = G.makeCar(type, x, y, angle);
  car.driver = 'player';
  G.cars.push(car);
  G.player.onFoot = false;
  G.player.car = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

/** Spawn a police car already chasing the player. */
function spawnChaser(G, x, y) {
  const car = G.makeCar('police', x, y, Math.atan2(G.player.y - y, G.player.x - x));
  car.driver = 'police';
  car.speed = 200;
  G.cars.push(car);
  return car;
}

/**
 * Set `G` to the named scene (cover, onfoot, driving or mission; any other name
 * is the cover) and return the screen to draw over it.
 */
export function stageShot(name, G) {
  resetGame(G, G.seed);
  G.screen = 'play';
  if (name === 'onfoot') {
    // On foot down a busy Downtown sidewalk, pedestrians around.
    G.player.x = 1340;
    G.player.y = 1100;
    G.player.angle = -Math.PI / 2;
    G.camera.x = 1340;
    G.camera.y = 1100;
    for (const spot of [{ x: 1340, y: 900 }, { x: 1460, y: 980 }, { x: 1340, y: 760 }]) {
      G.peds.push({
        x: spot.x, y: spot.y, angle: -Math.PI / 2, speed: 50,
        shirt: '#c94f43', skin: '#e8c39a', state: 'walk',
        health: 100, waitT: 6, target: { x: spot.x, y: spot.y - 300 }, car: null, punchT: 0, downT: 0,
      });
    }
    simulate(G, 4, (game) => walkInput(game, 1340, 640));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'driving') {
    // Already rolling at speed on the beachfront road, traffic around but
    // clear of the player's lane, so the frame reads as a fast drive — the
    // old staging started the car from a stop behind two sedans and the
    // three ended nose-to-tail at 4 mph. Lanes matter here: the road is
    // 96 wide, so the player runs the south lane (y 2235) and the oncoming
    // sedan the north lane (y 2175) — 60 apart, past the 47 collision
    // distance — so even a sedan stopped at a red light can't block the run.
    const car = putPlayerInCar(G, 'sports', 700, 2235, 0);
    car.speed = 320;
    // Clear ambient traffic off the beachfront road so nothing random blocks
    // the run (same treatment as the cover scene).
    G.cars = G.cars.filter((c) => !(c.driver === 'traffic' && Math.abs(c.y - 2200) < 120 && c.x > 500 && c.x < 3000));
    // Traffic around the player at the end of the run: one sedan ahead in
    // the south lane, one coming the other way in the north lane.
    for (const spot of [{ x: 2100, y: 2235, angle: 0, speed: 100, tx: 3000, ty: 2235 }, { x: 1860, y: 2175, angle: Math.PI, speed: 120, tx: 200, ty: 2175 }]) {
      const traffic = G.makeCar('sedan', spot.x, spot.y, spot.angle);
      traffic.driver = 'traffic';
      traffic.speed = spot.speed;
      traffic.target = { x: spot.tx, y: spot.ty };
      G.cars.push(traffic);
    }
    G.camera.x = 700;
    G.camera.y = 2235;
    simulate(G, 3, (game) => driveInput(game, 2900, 2235));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // The Hot Cargo job: the player is in the truck, the police are on them,
    // and Mara's briefing is on screen.
    G.missionIndex = 4;
    G.mission = null;
    const truck = G.makeCar('truck', 420, 620, 0);
    truck.driver = 'player';
    truck.color = '#e8b10c';
    truck.speed = 120;
    G.cars.push(truck);
    G.player.onFoot = false;
    G.player.car = truck;
    G.player.x = 420;
    G.player.y = 620;
    G.player.angle = 0;
    G.wanted = 3;
    G.wantedClock = 0;
    spawnChaser(G, 260, 620);
    spawnChaser(G, 300, 680);
    // Keep the truck's route clear of pickups so no stray toast pops up.
    G.pickups = G.pickups.filter((pickup) => !(Math.abs(pickup.y - 620) < 100 && pickup.x > 300 && pickup.x < 2700));
    G.mission = {
      def: missionDef('cargo'),
      stage: 1,
      timer: 0,
      objective: 'Deliver the truck to the Marina warehouse',
      target: { x: 2620, y: 620, label: 'Warehouse' },
      data: { truck },
    };
    G.dialogue = {
      who: 'Mara Voss',
      lines: ['Hot Cargo — $2500', 'Drive it to the Marina warehouse. The port police will notice. They always do.'],
      index: 1,
      timer: 0,
    };
    G.messages = [];
    G.camera.x = 420;
    G.camera.y = 620;
    simulate(G, 4, (game) => driveInput(game, 2620, 620));
    return { screen: SCREEN_PLAY };
  }
  // Cover: a three-star chase on the beachfront road, courier job live.
  const coverCar = putPlayerInCar(G, 'sports', 1400, 2200, 0);
  coverCar.speed = 220;
  G.wanted = 3;
  G.wantedClock = 0;
  G.missionIndex = 1;
  spawnChaser(G, 1180, 2200);
  spawnChaser(G, 1240, 2150);
  // Clear traffic off the beachfront road so the chase reads clean.
  G.cars = G.cars.filter((car) => !(car.driver === 'traffic' && Math.abs(car.y - 2200) < 120 && car.x > 1000 && car.x < 3000));
  G.mission = {
    def: missionDef('courier'),
    stage: 1,
    timer: 60,
    objective: 'Deliver the package to the Beachfront',
    target: { x: 2950, y: 2200, label: 'Drop-off' },
    data: {},
  };
  G.dialogue = {
    who: 'Mara Voss',
    lines: ['Courier Run — $800', 'Package picked up — deliver it to the Beachfront. Fast.'],
    index: 1,
    timer: 0,
  };
  G.messages = [];
  G.camera.x = 1400;
  G.camera.y = 2200;
  simulate(G, 3, (game) => driveInput(game, 2950, 2200));
  return { screen: SCREEN_PLAY };
}
