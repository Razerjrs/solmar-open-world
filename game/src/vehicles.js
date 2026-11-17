// Cars: their physics, their damage, getting in and out of them. A car is a
// rectangle with a heading and a speed; steering bites harder the slower it goes.

import { CAR, VEHICLE_TYPES } from './config.js';
import { pick } from './random.js';
import { isOnRoad, resolveCollision } from './world.js';

let nextId = 1;

/** Make a car of the given type at a position, facing an angle. */
export function createCar(random, type, x, y, angle) {
  const spec = VEHICLE_TYPES[type];
  return {
    id: nextId,
    type,
    name: spec.name,
    x, y,
    angle,
    speed: 0,
    length: spec.length,
    width: spec.width,
    maxSpeed: spec.maxSpeed,
    accel: spec.accel,
    grip: spec.grip,
    color: pick(random, spec.colors),
    health: CAR.maxHealth,
    driver: 'none',
    parked: false,
    wrecked: false,
    siren: type === 'police',
    brakeLight: false,
    smoke: 0,
    skid: 0,
  };
}

/** Steer a car toward a target angle, limited by how fast it is going. */
function steerToward(car, targetAngle, dt) {
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const rate = car.grip * (1 - Math.min(0.55, Math.abs(car.speed) / car.maxSpeed));
  car.angle += Math.max(-rate * dt, Math.min(rate * dt, diff));
}

/** Advance one car one step under throttle (-1..1) and steer (-1..1). */
export function driveCar(city, car, throttle, steer, dt, handbrake) {
  if (car.wrecked) {
    car.speed *= Math.max(0, 1 - 4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    resolveCollision(city, car, car.width / 2);
    return;
  }
  const forward = throttle;
  const reversing = throttle < 0 && car.speed > -40;
  const top = reversing ? car.maxSpeed * 0.35 : car.maxSpeed;
  if (forward !== 0) {
    car.speed += forward * car.accel * dt;
    if (car.speed > top) car.speed = top;
    if (car.speed < -car.maxSpeed * 0.35) car.speed = -car.maxSpeed * 0.35;
  } else {
    const drag = 160 * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  if (handbrake) car.speed *= Math.max(0, 1 - 3.5 * dt);
  const steerRate = 2.4 * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.angle += steer * steerRate * dt * Math.sign(car.speed || 1);
  const before = { x: car.x, y: car.y };
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const hit = resolveCollision(city, car, car.width / 2);
  if (hit) {
    car.x = before.x;
    car.y = before.y;
    if (Math.abs(car.speed) > 120) damageCar(car, Math.abs(car.speed) * 0.06);
    car.speed *= -0.25;
  }
  // Off-road drag: grass and sand slow a car down.
  if (!isOnRoad(city, car.x, car.y)) car.speed *= Math.max(0, 1 - 1.2 * dt);
  if (car.health < 40) car.smoke = Math.min(1, car.smoke + dt * 0.5);
  else car.smoke = Math.max(0, car.smoke - dt);
}

/** Drive a car toward a point on the map (police and traffic use this). */
export function driveToward(city, car, targetX, targetY, dt, topSpeed = null) {
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  steerToward(car, want, dt);
  const distance = Math.hypot(targetX - car.x, targetY - car.y);
  const throttle = distance > 30 ? 1 : 0;
  const capped = topSpeed === null ? car.maxSpeed : Math.min(car.maxSpeed, topSpeed);
  const saved = car.maxSpeed;
  car.maxSpeed = capped;
  driveCar(city, car, throttle, 0, dt, false);
  car.maxSpeed = saved;
}

/** Hurt a car; returns true when it just became a wreck. */
export function damageCar(car, amount) {
  if (car.wrecked) return false;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed *= 0.3;
    return true;
  }
  return false;
}

/** Two cars bumping: push apart and trade a little damage. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1;
  const overlap = (a.length + b.length) / 2 - distance;
  if (overlap <= 0) return false;
  const nx = dx / distance;
  const ny = dy / distance;
  a.x -= nx * overlap / 2;
  a.y -= ny * overlap / 2;
  b.x += nx * overlap / 2;
  b.y += ny * overlap / 2;
  const impact = Math.abs(a.speed - b.speed);
  if (impact > 90) {
    damageCar(a, impact * 0.03);
    damageCar(b, impact * 0.03);
    const swap = a.speed;
    a.speed = b.speed * 0.5;
    b.speed = swap * 0.5;
    return true;
  }
  return false;
}

/** The nearest car the player could get into, within reach. */
export function nearestEnterableCar(cars, x, y, maxDistance = 64) {
  let best = null;
  let bestDistance = maxDistance;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDistance) { bestDistance = d; best = car; }
  }
  return best;
}
