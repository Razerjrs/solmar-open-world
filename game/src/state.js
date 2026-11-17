// The game state and its step: everything the modules share, created fresh from
// a seed, advanced one fixed step at a time. The live loop and the screenshot
// stager both step through here, so a staged scene is a real game.

import { BEST_KEY, PLAYER, SAVE_KEY, STEP } from './config.js';
import { createRandom, pick, range } from './random.js';
import { createCity, districtAt, nearestRoadPoint, randomRoadPoint } from './world.js';
import { createCar, driveCar } from './vehicles.js';
import { playerPunch, toggleCar, updatePlayerOnFoot } from './player.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { addCrime, updatePolice } from './police.js';
import { carHitsPed, rivalsAttack } from './combat.js';
import { startNextMission, updateMissions } from './missions.js';
import { ACTION_ENTER_CAR, ACTION_PUNCH } from './input.js';
import { createAudio } from './audio.js';

/** Read the saved game, if one exists in this browser. */
export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best then lasts this visit only.
  }
}

/** Spawn the starting pickups: clinics, cash and repair wrenches. */
function spawnPickups(G) {
  const spots = [
    { kind: 'health', x: 1420, y: 1140 },
    { kind: 'health', x: 2400, y: 1000 },
    { kind: 'cash', x: 1000, y: 1800 },
    { kind: 'cash', x: 2200, y: 1400 },
    { kind: 'wrench', x: 1480, y: 1000 },
    { kind: 'wrench', x: 620, y: 620 },
  ];
  G.pickups = spots.map((spot) => ({ ...spot, taken: false, respawnT: 0 }));
}

/** Spawn parked cars along the roads for the player to take. */
function spawnParkedCars(G) {
  const types = ['sedan', 'sedan', 'taxi', 'van', 'sports', 'sedan', 'truck', 'van'];
  for (let i = 0; i < types.length; i += 1) {
    const point = randomRoadPoint(G.rng, G.city);
    const angle = pick(G.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const car = createCar(G.rng, types[i], point.x, point.y, angle);
    car.driver = 'none';
    car.parked = true;
    G.cars.push(car);
  }
}

/** Build a fresh game state from a seed. */
export function createGame(seed) {
  const G = {
    seed,
    rng: createRandom(seed),
    time: 0,
    city: null,
    player: null,
    cars: [],
    peds: [],
    cops: [],
    wanted: 0,
    wantedClock: 0,
    mission: null,
    missionIndex: 0,
    pickups: [],
    particles: [],
    skids: [],
    messages: [],
    dialogue: null,
    camera: { x: 1600, y: 1280 },
    screen: 'title',
    gameOver: null,
    stats: { crimes: 0, carsStolen: 0, missionsDone: 0 },
    best: readBest(),
    hasSave: readSave() !== null,
    district: 'Downtown',
    districtBanner: null,
    muted: false,
    audio: createAudio(),
  };
  G.makeCar = (type, x, y, angle) => createCar(G.rng, type, x, y, angle);
  G.message = (text) => {
    G.messages.push({ text, t: 5 });
    if (G.messages.length > 4) G.messages.shift();
  };
  G.endGame = (kind) => {
    if (G.screen !== 'play') return;
    G.gameOver = kind;
    G.screen = 'over';
    G.audio.busted();
    if (G.player.cash > G.best) {
      G.best = G.player.cash;
      saveBest(G.best);
    }
  };
  G.saveGame = () => {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: G.player.cash,
        missionIndex: G.missionIndex,
        health: G.player.health,
        x: G.player.x,
        y: G.player.y,
      }));
      G.hasSave = true;
    } catch {
      // Storage can be off: the game still plays.
    }
  };
  resetGame(G, seed);
  return G;
}

/** Reset a game state in place, from a seed (new game, restart, or a shot). */
export function resetGame(G, seed) {
  G.seed = seed;
  G.rng = createRandom(seed);
  G.time = 0;
  G.city = createCity(G.rng);
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.wanted = 0;
  G.wantedClock = 0;
  G.mission = null;
  G.missionIndex = 0;
  G.pickups = [];
  G.particles = [];
  G.skids = [];
  G.messages = [];
  G.dialogue = null;
  G.gameOver = null;
  G.stats = { crimes: 0, carsStolen: 0, missionsDone: 0 };
  G.player = {
    x: 1420, y: 1060, angle: -Math.PI / 2,
    health: PLAYER.maxHealth, cash: 0,
    onFoot: true, car: null, moving: false,
    punchT: 0, hurtT: 0,
  };
  G.camera = { x: G.player.x, y: G.player.y };
  G.district = districtAt(G.player.x, G.player.y);
  G.districtBanner = null;
  spawnParkedCars(G);
  spawnTraffic(G);
  spawnPickups(G);
  startNextMission(G);
}

/** Load a save into a fresh game state. */
export function loadSaveInto(G, save) {
  G.player.cash = save.cash ?? 0;
  G.player.health = save.health ?? PLAYER.maxHealth;
  G.player.x = save.x ?? 1420;
  G.player.y = save.y ?? 1060;
  G.missionIndex = save.missionIndex ?? 0;
  G.mission = null;
  startNextMission(G);
}

/** A burst of particles at a point. */
export function spawnParticles(G, x, y, color, count = 8) {
  for (let i = 0; i < count; i += 1) {
    G.particles.push({
      x: x + range(G.rng, -8, 8),
      y: y + range(G.rng, -8, 8),
      vx: range(G.rng, -60, 60),
      vy: range(G.rng, -60, 60),
      t: range(G.rng, 0.3, 0.7),
      life: 0.7,
      color,
    });
  }
  if (G.particles.length > 120) G.particles.splice(0, G.particles.length - 120);
}

/** Check the player against pickups and apply any they touch. */
function updatePickups(G, dt) {
  for (const pickup of G.pickups) {
    if (pickup.taken) {
      pickup.respawnT -= dt;
      if (pickup.respawnT <= 0) pickup.taken = false;
      continue;
    }
    if (Math.hypot(G.player.x - pickup.x, G.player.y - pickup.y) > 34) continue;
    pickup.taken = true;
    pickup.respawnT = 45;
    if (pickup.kind === 'health') {
      G.player.health = Math.min(PLAYER.maxHealth, G.player.health + 50);
      G.message('Health +50');
    } else if (pickup.kind === 'cash') {
      const amount = 150;
      G.player.cash += amount;
      G.message(`Found $${amount} on the street.`);
    } else {
      if (G.player.car) {
        G.player.car.health = 100;
        G.player.car.smoke = 0;
        G.message('Car repaired.');
      } else {
        G.message('Wrench — get in a car to use it.');
        pickup.taken = false;
        pickup.respawnT = 0;
        continue;
      }
    }
    G.audio.pickup();
    spawnParticles(G, pickup.x, pickup.y, '#f2c94c', 6);
  }
}

/** The player's car running pedestrians over. */
function updateCarPedHits(G) {
  const car = G.player.car;
  if (!car || G.player.onFoot) return;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 120) {
      if (carHitsPed(G, car, ped)) {
        addCrime(G, 1, 'Hit a pedestrian');
        G.audio.crash();
        spawnParticles(G, ped.x, ped.y, '#e5534b', 8);
      }
    }
  }
}

/** Advance the whole game one fixed step. */
export function stepGame(G, input, dt = STEP) {
  G.time += dt;
  for (const message of G.messages) message.t -= dt;
  G.messages = G.messages.filter((message) => message.t > 0);
  if (G.dialogue) {
    G.dialogue.timer += dt;
    if (G.dialogue.timer > 6) {
      G.dialogue.index += 1;
      G.dialogue.timer = 0;
      if (G.dialogue.index >= G.dialogue.lines.length) G.dialogue = null;
    }
  }
  if (G.districtBanner) {
    G.districtBanner.t -= dt;
    if (G.districtBanner.t <= 0) G.districtBanner = null;
  }
  // The title screen keeps the city alive behind the menu.
  if (G.screen === 'title') {
    updateTraffic(G, dt);
    return;
  }
  if (G.screen !== 'play') return;

  const player = G.player;
  const dir = input.dir;
  if (player.onFoot) {
    updatePlayerOnFoot(G, dir, dt);
  } else if (player.car) {
    const car = player.car;
    const throttle = dir.y < 0 ? 1 : dir.y > 0 ? -0.7 : 0;
    const steer = dir.x;
    const handbrake = dir.handbrake;
    const prev = { x: car.x, y: car.y };
    driveCar(G.city, car, throttle, steer, dt, handbrake);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (handbrake && Math.abs(car.speed) > 150) {
      G.skids.push({ x1: prev.x, y1: prev.y, x2: car.x, y2: car.y });
      if (G.skids.length > 80) G.skids.shift();
      spawnParticles(G, car.x, car.y, '#c9c2ae', 1);
    }
    if (car.wrecked) {
      G.message('Your car is wrecked — get out!');
      player.onFoot = true;
      player.car = null;
      player.x = car.x + 40;
      player.y = car.y + 40;
      car.driver = 'none';
    }
  }
  if (input.actions) {
    if (input.actions & ACTION_ENTER_CAR) toggleCar(G);
    if (input.actions & ACTION_PUNCH) playerPunch(G, input.mouseWorld);
  }
  updateCarPedHits(G);
  updateTraffic(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  rivalsAttack(G, dt);
  updatePickups(G, dt);
  for (const particle of G.particles) {
    particle.t -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  G.particles = G.particles.filter((particle) => particle.t > 0);
  G.audio.update(!player.onFoot && !!player.car, player.car ? Math.abs(player.car.speed) / player.car.maxSpeed : 0, G.wanted);
}
