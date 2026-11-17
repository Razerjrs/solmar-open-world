// Combat: punches, knockback, and what happens when a car meets a pedestrian.
// This module only resolves hits and damage; the crime that follows a hit is the
// caller's job (see police.addCrime).

import { PLAYER } from './config.js';

/** Is a target inside the attacker's arc? */
function inArc(x, y, angle, range, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < 1.1;
}

/**
 * A punch from (x, y) facing `angle`. Hits pedestrians and foot cops in range,
 * knocks them back and puts them down. Returns what it hit.
 */
export function punchAttack(G, x, y, angle, range, damage, attackerKind) {
  const hits = [];
  for (const ped of G.peds) {
    if (ped.state === 'down' || ped.state === 'driver') continue;
    if (!inArc(x, y, angle, range, ped.x, ped.y)) continue;
    const wasDown = ped.health <= 0;
    ped.health -= damage;
    const away = Math.atan2(ped.y - y, ped.x - x);
    ped.x += Math.cos(away) * 18;
    ped.y += Math.sin(away) * 18;
    if (ped.health <= 0) {
      ped.health = 0;
      ped.state = 'down';
      ped.downT = 6;
    } else if (ped.state !== 'rival') {
      ped.state = 'flee';
      ped.fleeX = x;
      ped.fleeY = y;
    }
    hits.push({ kind: 'ped', ped, wasDown });
  }
  for (const cop of G.cops) {
    if (!inArc(x, y, angle, range, cop.x, cop.y)) continue;
    cop.health -= damage;
    const away = Math.atan2(cop.y - y, cop.x - x);
    cop.x += Math.cos(away) * 16;
    cop.y += Math.sin(away) * 16;
    if (cop.health <= 0) {
      cop.health = 0;
      cop.down = true;
      cop.downT = 8;
    }
    hits.push({ kind: 'cop', cop, wasDown: false });
  }
  return hits;
}

/** Hurt the player; returns true when the player just went down. */
export function hurtPlayer(G, amount) {
  const player = G.player;
  if (player.hurtT > 0 || player.health <= 0) return false;
  player.health -= amount;
  player.hurtT = 0.6;
  G.audio.hit();
  if (player.health <= 0) {
    player.health = 0;
    return true;
  }
  return false;
}

/** A car running a pedestrian over: the pedestrian goes down. */
export function carHitsPed(G, car, ped) {
  if (ped.state === 'down' || ped.state === 'driver') return false;
  if (Math.abs(car.speed) < 120) return false;
  ped.health = 0;
  ped.state = 'down';
  ped.downT = 8;
  const away = Math.atan2(ped.y - car.y, ped.x - car.x);
  ped.x += Math.cos(away) * 24;
  ped.y += Math.sin(away) * 24;
  return true;
}

/** Rival pedestrians (mission 4) punch back when close to the player. */
export function rivalsAttack(G, dt) {
  const player = G.player;
  if (!player.onFoot || player.health <= 0) return;
  for (const ped of G.peds) {
    if (ped.state !== 'rival') continue;
    const distance = Math.hypot(player.x - ped.x, player.y - ped.y);
    if (distance > 40) continue;
    ped.punchT = (ped.punchT ?? 0) - dt;
    if (ped.punchT <= 0) {
      ped.punchT = 1.1;
      if (hurtPlayer(G, 10)) G.endGame('wasted');
    }
  }
}
