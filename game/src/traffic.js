// Traffic: cars that drive the road grid and stop at red lights, and pedestrians
// who walk the sidewalks and run from trouble.

import { AVENUES, STREETS } from './config.js';
import { chance, pick, range, rangeInt } from './random.js';
import { collideCars, driveCar } from './vehicles.js';
import { lightState, nearestLight, randomRoadPoint, randomSidewalkPoint, resolveCollision } from './world.js';

const TRAFFIC_TYPES = ['sedan', 'taxi', 'van', 'sedan', 'truck'];
const PED_SHIRTS = ['#c94f43', '#4a6fa5', '#3e7d5b', '#e8b10c', '#b03060', '#7d8a99', '#e8e8e8', '#5b4a8a'];
const PED_SKINS = ['#e8c39a', '#c98d5f', '#8a5a3a', '#f2d0a8'];

/** The next intersection a traffic car heads for, from where it is. */
function nextWaypoint(random, car) {
  const onAvenue = AVENUES.some((avenue) => Math.abs(car.x - avenue) < 10);
  const vertical = onAvenue ? chance(random, 0.7) : chance(random, 0.3);
  if (vertical) {
    const avenue = AVENUES.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
    const street = pick(random, STREETS);
    return { x: avenue, y: street };
  }
  const street = STREETS.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
  const avenue = pick(random, AVENUES);
  return { x: avenue, y: street };
}

/** Spawn the starting traffic: cars on the roads, peds on the sidewalks. */
export function spawnTraffic(G) {
  for (let i = 0; i < 14; i += 1) {
    const point = randomRoadPoint(G.rng, G.city);
    const onAvenue = AVENUES.includes(point.x);
    const angle = onAvenue ? (chance(G.rng, 0.5) ? Math.PI / 2 : -Math.PI / 2) : (chance(G.rng, 0.5) ? 0 : Math.PI);
    const car = G.makeCar(pick(G.rng, TRAFFIC_TYPES), point.x, point.y, angle);
    car.driver = 'traffic';
    car.speed = range(G.rng, 60, 140);
    car.target = nextWaypoint(G.rng, car);
    G.cars.push(car);
  }
  for (let i = 0; i < 36; i += 1) {
    const point = randomSidewalkPoint(G.rng, G.city);
    G.peds.push({
      x: point.x, y: point.y,
      angle: range(G.rng, 0, Math.PI * 2),
      speed: range(G.rng, 30, 65),
      shirt: pick(G.rng, PED_SHIRTS),
      skin: pick(G.rng, PED_SKINS),
      state: 'walk',
      health: 100,
      waitT: 0,
      target: null,
      car: null,
      punchT: 0,
      downT: 0,
    });
  }
}

/** Keep the streets busy: replace traffic cars that left the city or got wrecked. */
function topUpTraffic(G) {
  const traffic = G.cars.filter((car) => car.driver === 'traffic' && !car.wrecked);
  if (traffic.length >= 12) return;
  const point = randomRoadPoint(G.rng, G.city);
  const onAvenue = AVENUES.includes(point.x);
  const angle = onAvenue ? (chance(G.rng, 0.5) ? Math.PI / 2 : -Math.PI / 2) : (chance(G.rng, 0.5) ? 0 : Math.PI);
  const car = G.makeCar(pick(G.rng, TRAFFIC_TYPES), point.x, point.y, angle);
  car.driver = 'traffic';
  car.speed = range(G.rng, 60, 140);
  car.target = nextWaypoint(G.rng, car);
  G.cars.push(car);
}

/** One traffic car: drive to its waypoint, stopping at red lights. */
function updateTrafficCar(G, car, dt) {
  if (car.wrecked) {
    driveCar(G.city, car, 0, 0, dt, false);
    return;
  }
  const target = car.target;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 26) {
    car.target = nextWaypoint(G.rng, car);
    return;
  }
  // A red light ahead: stop at the intersection line.
  const light = nearestLight(G.city, car.x, car.y);
  const lightDistance = Math.hypot(light.x - car.x, light.y - car.y);
  const movingVertical = Math.abs(dx) < Math.abs(dy);
  const green = lightState(light, G.time);
  const myTurn = movingVertical ? green === 'ns' : green === 'ew';
  if (!myTurn && lightDistance < 70 && lightDistance > 10) {
    driveCar(G.city, car, 0, 0, dt, false);
    car.brakeLight = true;
    return;
  }
  car.brakeLight = false;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Slow for the car ahead.
  let throttle = 0.75;
  for (const other of G.cars) {
    if (other === car || other.wrecked) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((other.x - car.x) * Math.sin(car.angle) - (other.y - car.y) * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 30) throttle = 0;
  }
  driveCar(G.city, car, throttle, steer, dt, false);
}

/** One pedestrian: walk the sidewalks, flee from danger, get up after a while. */
function updatePed(G, ped, dt) {
  if (ped.state === 'down') {
    ped.downT -= dt;
    if (ped.downT <= 0) {
      ped.state = 'walk';
      ped.health = 100;
    }
    return;
  }
  if (ped.state === 'driver') return;
  if (ped.state === 'wait') return;
  if (ped.state === 'rival') {
    // Rivals walk toward the player and stay in the plaza.
    const dx = G.player.x - ped.x;
    const dy = G.player.y - ped.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 30) {
      ped.angle = Math.atan2(dy, dx);
      ped.x += Math.cos(ped.angle) * 95 * dt;
      ped.y += Math.sin(ped.angle) * 95 * dt;
      resolveCollision(G.city, ped, 12);
    }
    return;
  }
  if (ped.state === 'flee') {
    const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
    ped.angle = away;
    ped.x += Math.cos(away) * 170 * dt;
    ped.y += Math.sin(away) * 170 * dt;
    resolveCollision(G.city, ped, 12);
    ped.waitT += dt;
    if (ped.waitT > 3) {
      ped.state = 'walk';
      ped.waitT = 0;
    }
    return;
  }
  // Walking: keep to the sidewalks, pick a new corner now and then.
  ped.waitT -= dt;
  if (!ped.target || ped.waitT <= 0) {
    ped.target = randomSidewalkPoint(G.rng, G.city);
    ped.waitT = range(G.rng, 4, 9);
  }
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 12) {
    ped.target = null;
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  // A car bearing down scares a pedestrian off the road.
  for (const car of G.cars) {
    if (car.wrecked || Math.abs(car.speed) < 80) continue;
    if (Math.hypot(car.x - ped.x, car.y - ped.y) < 90) {
      ped.state = 'flee';
      ped.fleeX = car.x;
      ped.fleeY = car.y;
      ped.waitT = 0;
      break;
    }
  }
}

/** Advance all traffic and pedestrians one step. */
export function updateTraffic(G, dt) {
  topUpTraffic(G);
  for (const car of G.cars) {
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
  }
  for (const ped of G.peds) updatePed(G, ped, dt);
  // Car-to-car bumps.
  for (let i = 0; i < G.cars.length; i += 1) {
    for (let j = i + 1; j < G.cars.length; j += 1) {
      const a = G.cars[i];
      const b = G.cars[j];
      if (a.wrecked && b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) > 60 || Math.abs(dy) > 60) continue;
      const distance = Math.hypot(dx, dy);
      if (distance < (a.length + b.length) / 2 - 8) {
        if (collideCars(a, b) && (a.driver === 'player' || b.driver === 'player')) G.audio.crash();
      }
    }
  }
}
