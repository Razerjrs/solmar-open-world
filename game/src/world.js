// The city of Solmar: a grid of avenues and streets, blocks with buildings and
// parks, a beach and open water along the south edge. Everything is generated from
// the seeded generator, so the same seed always builds the same city.

import { AVENUES, BEACH, DISTRICTS, ROAD_WIDTH, STREETS, WORLD } from './config.js';
import { chance, pick, range, rangeInt } from './random.js';

const BLOCK_MARGIN = 34;
const PARK_CHANCE = 0.16;

/** The district a point sits in. */
export function districtAt(x, y) {
  for (const district of DISTRICTS) {
    if (district.test(x, y)) return district.name;
  }
  return 'Downtown';
}

/** True when a point is on a road (asphalt, not sidewalk). */
export function isOnRoad(city, x, y) {
  const half = ROAD_WIDTH / 2;
  for (const avenue of AVENUES) {
    if (Math.abs(x - avenue) <= half && y >= STREETS[0] - half && y <= STREETS[STREETS.length - 1] + half) return true;
  }
  for (const street of STREETS) {
    if (Math.abs(y - street) <= half && x >= AVENUES[0] - half && x <= AVENUES[AVENUES.length - 1] + half) return true;
  }
  return false;
}

/** True when a point is on a sidewalk band beside a road. */
export function isOnSidewalk(city, x, y) {
  const road = ROAD_WIDTH / 2;
  const walk = road + 26;
  for (const avenue of AVENUES) {
    if (Math.abs(x - avenue) > road && Math.abs(x - avenue) <= walk) return true;
  }
  for (const street of STREETS) {
    if (Math.abs(y - street) > road && Math.abs(y - street) <= walk) return true;
  }
  return false;
}

/** The nearest road centreline point to a position. */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const avenue of AVENUES) {
    const point = { x: avenue, y: Math.max(STREETS[0], Math.min(STREETS[STREETS.length - 1], y)) };
    const d = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (d < bestDistance) { bestDistance = d; best = point; }
  }
  for (const street of STREETS) {
    const point = { x: Math.max(AVENUES[0], Math.min(AVENUES[AVENUES.length - 1], x)), y: street };
    const d = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (d < bestDistance) { bestDistance = d; best = point; }
  }
  return best;
}

/** A random point on a road, for spawning cars and pickups. */
export function randomRoadPoint(random, city) {
  if (chance(random, 0.5)) {
    return { x: pick(random, AVENUES), y: range(random, STREETS[0], STREETS[STREETS.length - 1]) };
  }
  return { x: range(random, AVENUES[0], AVENUES[AVENUES.length - 1]), y: pick(random, STREETS) };
}

/** A random point on a sidewalk, for spawning pedestrians. */
export function randomSidewalkPoint(random, city) {
  const point = randomRoadPoint(random, city);
  const onAvenue = AVENUES.includes(point.x);
  const offset = ROAD_WIDTH / 2 + 13;
  if (onAvenue) point.x += chance(random, 0.5) ? offset : -offset;
  else point.y += chance(random, 0.5) ? offset : -offset;
  return point;
}

/** True when a circle of radius r at (x, y) touches a building. */
export function hitsBuilding(city, x, y, r) {
  for (const building of city.buildings) {
    if (x + r > building.x && x - r < building.x + building.w && y + r > building.y && y - r < building.y + building.h) return building;
  }
  return null;
}

/** True when a point is in the water (impassable) or outside the world. */
export function isBlockedWater(city, x, y) {
  return y >= BEACH.waterTop || x < 0 || y < 0 || x > WORLD.width || y > WORLD.height;
}

/** Push a circle out of buildings and water; returns the building hit, if any. */
export function resolveCollision(city, body, r) {
  let hit = null;
  for (let pass = 0; pass < 2; pass += 1) {
    const building = hitsBuilding(city, body.x, body.y, r);
    if (!building) break;
    hit = building;
    const left = body.x + r - building.x;
    const right = building.x + building.w - (body.x - r);
    const top = body.y + r - building.y;
    const bottom = building.y + building.h - (body.y - r);
    const min = Math.min(left, right, top, bottom);
    if (min === left) body.x = building.x - r;
    else if (min === right) body.x = building.x + building.w + r;
    else if (min === top) body.y = building.y - r;
    else body.y = building.y + building.h + r;
  }
  if (body.y + r > BEACH.waterTop) body.y = BEACH.waterTop - r;
  if (body.x - r < 0) body.x = r;
  if (body.y - r < 0) body.y = r;
  if (body.x + r > WORLD.width) body.x = WORLD.width - r;
  if (body.y + r > WORLD.height) body.y = WORLD.height - r;
  return hit;
}

const ROOF_COLORS = {
  Downtown: ['#5b6b7d', '#6b7a8a', '#4a5a6e', '#7d8a99'],
  'Old Port': ['#9a6a4f', '#8a5a44', '#a5714f', '#7a5a3a'],
  Marina: ['#d8d3c3', '#c9c2ae', '#e8e2d0', '#b8b2a0'],
  Hillside: ['#b0714f', '#8a5a44', '#a5714f', '#7d6a4f'],
  Beachfront: ['#e8e2d0', '#d8c9a3', '#c9b896'],
};

/** Build the whole city from the seeded generator. */
export function createCity(random) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const lights = [];
  // One light per intersection, with a phase offset so the grid does not flip at once.
  for (let i = 0; i < AVENUES.length; i += 1) {
    for (let j = 0; j < STREETS.length; j += 1) {
      lights.push({ x: AVENUES[i], y: STREETS[j], phase: (i + j) % 2 });
    }
  }
  // Blocks sit between neighbouring roads.
  for (let i = 0; i < AVENUES.length - 1; i += 1) {
    for (let j = 0; j < STREETS.length - 1; j += 1) {
      const x0 = AVENUES[i] + ROAD_WIDTH / 2 + BLOCK_MARGIN;
      const y0 = STREETS[j] + ROAD_WIDTH / 2 + BLOCK_MARGIN;
      const x1 = AVENUES[i + 1] - ROAD_WIDTH / 2 - BLOCK_MARGIN;
      const y1 = STREETS[j + 1] - ROAD_WIDTH / 2 - BLOCK_MARGIN;
      const district = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      const isBeachRow = y1 > BEACH.sandTop - 80;
      if (isBeachRow) continue;
      // The plaza in the middle of Downtown is a park, never buildings.
      const isPlaza = i === 3 && j === 2;
      if (isPlaza || chance(random, PARK_CHANCE)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const treeCount = rangeInt(random, 5, 9);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({ x: range(random, x0 + 14, x1 - 14), y: range(random, y0 + 14, y1 - 14), r: range(random, 9, 15) });
        }
        continue;
      }
      const count = district === 'Downtown' ? rangeInt(random, 1, 2) : rangeInt(random, 2, 4);
      const gap = 14;
      for (let b = 0; b < count; b += 1) {
        const w = range(random, 90, (x1 - x0 - gap * (count - 1)) / count);
        const h = range(random, 80, y1 - y0 - 10);
        const bx = x0 + b * ((x1 - x0) / count) + range(random, 0, 10);
        const by = y0 + range(random, 0, Math.max(1, y1 - y0 - h));
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(random, ROOF_COLORS[district] ?? ROOF_COLORS.Downtown),
          tall: district === 'Downtown' && chance(random, 0.6),
          seed: rangeInt(random, 0, 9999),
        });
      }
    }
  }
  // Palms along the beachfront road and the sand.
  for (let x = 260; x < WORLD.width - 100; x += 130) {
    trees.push({ x: x + range(random, -20, 20), y: BEACH.sandTop + range(random, 30, 90), r: 12, palm: true });
    if (chance(random, 0.5)) trees.push({ x: x + 60, y: STREETS[STREETS.length - 1] - ROAD_WIDTH / 2 - 14, r: 11, palm: true });
  }
  return { buildings, parks, trees, lights, avenues: AVENUES, streets: STREETS };
}

/** The traffic light state at an intersection at a given time: 'ns' or 'ew' green. */
export function lightState(light, time) {
  const cycle = Math.floor(time / 5) + light.phase;
  return cycle % 2 === 0 ? 'ns' : 'ew';
}

/** The nearest intersection to a point. */
export function nearestLight(city, x, y) {
  let best = city.lights[0];
  let bestDistance = Infinity;
  for (const light of city.lights) {
    const d = (light.x - x) ** 2 + (light.y - y) ** 2;
    if (d < bestDistance) { bestDistance = d; best = light; }
  }
  return best;
}
