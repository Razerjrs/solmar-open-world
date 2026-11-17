// The player on foot: walking and running, punching, and getting in and out of
// cars. While driving, the car module owns the movement instead.

import { PLAYER } from './config.js';
import { punchAttack } from './combat.js';
import { addCrime } from './police.js';
import { nearestEnterableCar } from './vehicles.js';
import { resolveCollision } from './world.js';

/** Move the player on foot one step, from the held keys. */
export function updatePlayerOnFoot(G, dir, dt) {
  const player = G.player;
  if (player.punchT > 0) player.punchT -= dt;
  if (player.hurtT > 0) player.hurtT -= dt;
  const speed = dir.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let x = dir.x;
  let y = dir.y;
  const length = Math.hypot(x, y);
  if (length > 0) {
    x /= length;
    y /= length;
    player.angle = Math.atan2(y, x);
    player.moving = true;
  } else {
    player.moving = false;
  }
  player.x += x * speed * dt;
  player.y += y * speed * dt;
  resolveCollision(G.city, player, PLAYER.radius);
}

/** Throw a punch toward the mouse (or the facing direction when the mouse is still). */
export function playerPunch(G, mouseWorld) {
  const player = G.player;
  if (player.punchT > 0 || !player.onFoot) return;
  player.punchT = PLAYER.punchTime;
  const dx = mouseWorld.x - player.x;
  const dy = mouseWorld.y - player.y;
  if (Math.hypot(dx, dy) > 10) player.angle = Math.atan2(dy, dx);
  const hits = punchAttack(G, player.x, player.y, player.angle, PLAYER.punchRange, PLAYER.punchDamage, 'player');
  if (hits.length > 0) {
    G.audio.punch();
    for (const hit of hits) {
      if (hit.kind === 'cop') addCrime(G, 2, 'Attacked a cop');
      else if (hit.kind === 'ped' && !hit.wasDown) addCrime(G, 1, 'Assaulted a pedestrian');
    }
  }
}

/** Get into the nearest car, or out of the one being driven. */
export function toggleCar(G) {
  const player = G.player;
  if (player.onFoot) {
    const car = nearestEnterableCar(G.cars, player.x, player.y);
    if (!car) {
      G.message('No car nearby — walk up to one and press E.');
      return;
    }
    if (car.driver === 'traffic') {
      // The driver bails and runs: that is a carjacking.
      G.peds.push({
        x: car.x + 30, y: car.y + 30, angle: Math.atan2(player.y - car.y, player.x - car.x),
        speed: 170, shirt: '#7d8a99', skin: '#e8c39a', state: 'flee',
        health: 100, waitT: 0, target: null, car: null, punchT: 0, downT: 0,
        fleeX: player.x, fleeY: player.y,
      });
      addCrime(G, 1, 'Stole a car');
      G.stats.carsStolen += 1;
      G.message(`Jacked a ${car.name}!`);
    } else {
      G.message(`Driving a ${car.name}.`);
    }
    car.driver = 'player';
    car.parked = false;
    player.onFoot = false;
    player.car = car;
    player.punchT = 0;
    G.audio.click();
  } else {
    const car = player.car;
    if (!car) return;
    const side = { x: player.x + Math.cos(car.angle + Math.PI / 2) * 30, y: player.y + Math.sin(car.angle + Math.PI / 2) * 30 };
    player.x = side.x;
    player.y = side.y;
    resolveCollision(G.city, player, PLAYER.radius);
    car.driver = 'none';
    car.parked = true;
    car.speed = 0;
    player.onFoot = true;
    player.car = null;
    G.audio.click();
  }
}
