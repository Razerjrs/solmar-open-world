// SOLMAR — every tuning number, colour and name in one place.
// The world is a fixed-size city; the renderer shows a 1280x720 window of it.

export const WORLD = { width: 3200, height: 2560 };
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Street centrelines: 8 north-south avenues, 6 east-west streets. */
export const AVENUES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const STREETS = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_WIDTH = 96;
export const SIDEWALK = 26;

/** The beach: sand, then open water the player cannot enter. */
export const BEACH = { sandTop: 2320, waterTop: 2440 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 170,
  runSpeed: 285,
  punchRange: 46,
  punchDamage: 25,
  punchTime: 0.28,
  maxHealth: 100,
};

export const CAR = {
  radius: 20,
  maxHealth: 100,
};

/** Vehicle types: what they look like and how they drive. */
export const VEHICLE_TYPES = {
  sedan:   { name: 'Sedan',   length: 46, width: 22, maxSpeed: 330, accel: 210, grip: 2.6, colors: ['#c94f43', '#4a6fa5', '#7d8a99', '#3e7d5b'] },
  taxi:    { name: 'Taxi',    length: 46, width: 22, maxSpeed: 320, accel: 200, grip: 2.6, colors: ['#f2b705'] },
  truck:   { name: 'Truck',   length: 62, width: 26, maxSpeed: 260, accel: 150, grip: 2.2, colors: ['#8a6d4b', '#5b7a8a', '#9aa0a6'] },
  sports:  { name: 'Sports',  length: 48, width: 22, maxSpeed: 430, accel: 300, grip: 3.4, colors: ['#e8b10c', '#1f9d8a', '#b03060', '#e8e8e8'] },
  police:  { name: 'Interceptor', length: 48, width: 22, maxSpeed: 400, accel: 290, grip: 3.2, colors: ['#20242c'] },
  van:     { name: 'Van',     length: 54, width: 24, maxSpeed: 290, accel: 170, grip: 2.4, colors: ['#d8d3c3', '#7a8a99'] },
};

export const WANTED = {
  max: 5,
  /** Seconds of quiet before one star fades, plus this per star already held. */
  decayBase: 10,
  decayPerStar: 4,
  /** How close a cop must be to keep the heat on. */
  sightRange: 520,
};

export const MISSION_REWARDS = [300, 800, 1500, 1200, 2500, 5000];

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  water: '#2f7fb8',
  waterDeep: '#1f5f94',
  road: '#3a3f47',
  roadLine: '#e8d44d',
  sidewalk: '#b9bcc2',
  crosswalk: '#d8dadd',
  buildingRoof: '#8a7f72',
  park: '#5d9b4a',
  tree: '#2f6b33',
  treeLight: '#4a8a3f',
  player: '#e8b10c',
  playerShirt: '#2f6fb8',
  cop: '#20242c',
  copShirt: '#1c3f94',
  text: '#f5f2e8',
  muted: '#b8b2a4',
  panel: 'rgba(12, 16, 22, 0.78)',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4a90d9',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save and the best cash are kept between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';
export const BEST_KEY = 'solmar.best';

/** District names, shown when the player crosses into one. */
export const DISTRICTS = [
  { name: 'Hillside', test: (x, y) => y < 640 },
  { name: 'Beachfront', test: (x, y) => y > 2240 },
  { name: 'Old Port', test: (x, y) => x < 1100 },
  { name: 'Marina', test: (x, y) => x >= 2100 },
  { name: 'Downtown', test: () => true },
];
