// The wanted level and the police who answer it: patrol cars that chase and ram,
// foot cops who close in and make an arrest, and the heat fading when the player
// stays out of sight.

import { WANTED } from './config.js';
import { chance, range } from './random.js';
import { damageCar, driveToward } from './vehicles.js';
import { nearestRoadPoint, randomRoadPoint } from './world.js';
import { hurtPlayer } from './combat.js';

/** Raise the wanted level and say why. */
export function addCrime(G, stars, reason) {
  if (G.wanted >= WANTED.max) {
    G.wantedClock = 0;
    return;
  }
  G.wanted = Math.min(WANTED.max, G.wanted + stars);
  G.wantedClock = 0;
  G.stats.crimes += 1;
  G.message(`${reason} — wanted level ${G.wanted}.`);
  if (G.wanted >= 2) G.audio.sirenBlip();
}

/** How many cop cars and foot cops the current wanted level calls for. */
function desiredForce(wanted) {
  if (wanted <= 0) return { cars: 0, foot: 0 };
  if (wanted === 1) return { cars: 0, foot: 2 };
  return { cars: Math.min(4, wanted - 1), foot: Math.min(2, wanted - 1) };
}

/** Spawn a cop car on a road some distance from the player. */
function spawnCopCar(G) {
  let point = randomRoadPoint(G.rng, G.city);
  let tries = 0;
  while (Math.hypot(point.x - G.player.x, point.y - G.player.y) < 450 && tries < 12) {
    point = randomRoadPoint(G.rng, G.city);
    tries += 1;
  }
  const car = G.makeCar('police', point.x, point.y, Math.atan2(G.player.y - point.y, G.player.x - point.x));
  car.driver = 'police';
  G.cars.push(car);
  return car;
}

/** Spawn a foot cop near the player. */
function spawnFootCop(G) {
  const point = nearestRoadPoint(G.city, G.player.x + range(G.rng, -260, 260), G.player.y + range(G.rng, -260, 260));
  G.cops.push({ x: point.x, y: point.y, angle: 0, speed: 175, health: 100, arrest: 0, down: false, downT: 0 });
}

/** One cop car: chase the player, ram them, back off when the heat is gone. */
function updateCopCar(G, car, dt) {
  if (car.wrecked) {
    driveToward(G.city, car, car.x, car.y, dt, 0);
    return;
  }
  if (G.wanted === 0) {
    // The heat is off: drive away and despawn far from the player.
    driveToward(G.city, car, car.x + (car.x - G.player.x), car.y + (car.y - G.player.y), dt, 200);
    if (Math.hypot(car.x - G.player.x, car.y - G.player.y) > 1100) {
      G.cars = G.cars.filter((other) => other !== car);
    }
    return;
  }
  const distance = Math.hypot(G.player.x - car.x, G.player.y - car.y);
  const top = 300 + G.wanted * 22;
  driveToward(G.city, car, G.player.x, G.player.y, dt, top);
  // A ram: close and fast, against the player or their car.
  if (distance < 46 && Math.abs(car.speed) > 90) {
    if (G.player.onFoot) {
      if (hurtPlayer(G, 18)) G.endGame('wasted');
      const away = Math.atan2(G.player.y - car.y, G.player.x - car.x);
      G.player.x += Math.cos(away) * 30;
      G.player.y += Math.sin(away) * 30;
    } else if (G.player.car) {
      if (damageCar(G.player.car, 12)) {
        G.message('Your car is wrecked — get out!');
        G.audio.crash();
      }
    }
    car.speed *= 0.4;
  }
}

/** One foot cop: run the player down, then hold them for an arrest. */
function updateFootCop(G, cop, dt) {
  if (cop.down) {
    cop.downT -= dt;
    if (cop.downT <= 0) {
      cop.down = false;
      cop.health = 100;
    }
    return;
  }
  if (G.wanted === 0) {
    if (Math.hypot(cop.x - G.player.x, cop.y - G.player.y) > 800) {
      G.cops = G.cops.filter((other) => other !== cop);
    }
    return;
  }
  const dx = G.player.x - cop.x;
  const dy = G.player.y - cop.y;
  const distance = Math.hypot(dx, dy);
  cop.angle = Math.atan2(dy, dx);
  const speed = cop.speed + G.wanted * 6;
  if (distance > 26) {
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    cop.arrest = Math.max(0, cop.arrest - dt * 0.5);
  } else {
    cop.arrest += dt;
    if (cop.arrest > 1.2) {
      G.endGame('busted');
      return;
    }
  }
  // A cop on foot who is run over goes down.
  for (const car of G.cars) {
    if (car.wrecked || Math.abs(car.speed) < 120) continue;
    if (Math.hypot(car.x - cop.x, car.y - cop.y) < 30) {
      cop.health = 0;
      cop.down = true;
      cop.downT = 8;
      if (car.driver === 'player') addCrime(G, 1, 'Ran over a cop');
    }
  }
}

/** Advance the wanted level and the whole police force one step. */
export function updatePolice(G, dt) {
  // The heat fades after a quiet spell with no cop in sight.
  if (G.wanted > 0) {
    G.wantedClock += dt;
    let nearest = Infinity;
    for (const car of G.cars) {
      if (car.driver !== 'police') continue;
      nearest = Math.min(nearest, Math.hypot(car.x - G.player.x, car.y - G.player.y));
    }
    for (const cop of G.cops) {
      nearest = Math.min(nearest, Math.hypot(cop.x - G.player.x, cop.y - G.player.y));
    }
    const quiet = WANTED.decayBase + G.wanted * WANTED.decayPerStar;
    if (G.wantedClock > quiet && nearest > WANTED.sightRange) {
      G.wanted -= 1;
      G.wantedClock = 0;
      if (G.wanted === 0) G.message('You lost the cops.');
      else G.message(`Wanted level ${G.wanted}.`);
    }
  }
  const force = desiredForce(G.wanted);
  const copCars = G.cars.filter((car) => car.driver === 'police' && !car.wrecked);
  const footCops = G.cops.filter((cop) => !cop.down);
  if (G.wanted > 0) {
    if (copCars.length < force.cars && chance(G.rng, 0.02)) spawnCopCar(G);
    if (footCops.length < force.foot && chance(G.rng, 0.03)) spawnFootCop(G);
  }
  for (const car of [...G.cars]) {
    if (car.driver === 'police') updateCopCar(G, car, dt);
  }
  for (const cop of [...G.cops]) updateFootCop(G, cop, dt);
}
