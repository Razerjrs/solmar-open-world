// Missions and the story: six jobs for Mara Voss, the fixer who runs Solmar
// from a garage in Downtown. Each mission sets an objective, watches for it,
// and pays cash on completion. Finishing all six closes the story.

import { MISSION_REWARDS } from './config.js';
import { addCrime } from './police.js';
import { nearestEnterableCar } from './vehicles.js';
import { nearestRoadPoint, randomRoadPoint } from './world.js';

const GIVER = 'Mara Voss';
const SAFEHOUSE = { x: 1420, y: 1060 };

function setObjective(G, text, x, y, label) {
  G.mission.objective = text;
  G.mission.target = { x, y, label: label ?? text };
}

function atTarget(G, radius = 46) {
  const target = G.mission.target;
  if (!target) return false;
  return Math.hypot(G.player.x - target.x, G.player.y - target.y) < radius;
}

function say(G, who, lines) {
  G.dialogue = { who, lines, index: 0, timer: 0 };
}

const MISSIONS = [
  {
    id: 'wheels',
    title: 'First Wheels',
    brief: [
      'New in Solmar? Everyone walks until they don\'t.',
      'Steal a car — any car — and bring it to my garage. Parked ones are free. Driven ones... less so.',
    ],
    setup(G) {
      const car = nearestEnterableCar(G.cars, G.player.x, G.player.y, 900) ?? G.cars[0];
      setObjective(G, 'Steal a car and drive to the garage', SAFEHOUSE.x, SAFEHOUSE.y, 'Garage');
      G.mission.data.car = car;
    },
    update(G) {
      if (!G.player.onFoot) {
        if (atTarget(G, 90)) return 'done';
        G.mission.objective = 'Drive to the garage';
      }
    },
  },
  {
    id: 'courier',
    title: 'Courier Run',
    brief: [
      'A package downtown needs to reach the Beachfront. Fast.',
      'Pick it up, then deliver it before the timer runs out. Cops hate couriers. Don\'t ask why.',
    ],
    setup(G) {
      G.mission.stage = 0;
      setObjective(G, 'Pick up the package downtown', 1400, 600, 'Pickup');
    },
    update(G, dt) {
      if (G.mission.stage === 0) {
        if (atTarget(G)) {
          G.mission.stage = 1;
          G.mission.timer = 90;
          setObjective(G, 'Deliver the package to the Beachfront', 2600, 2200, 'Drop-off');
          G.message('Package picked up — 90 seconds!');
          G.audio.pickup();
        }
      } else {
        G.mission.timer -= dt;
        if (G.mission.timer <= 0) {
          G.message('Too slow — the buyer walked. Mara is not pleased.');
          G.mission.stage = 0;
          setObjective(G, 'Pick up the package downtown', 1400, 600, 'Pickup');
          return;
        }
        if (atTarget(G)) return 'done';
      }
    },
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    brief: [
      'My associate Rook is waiting at the plaza, and the cops are already on him.',
      'Pick him up, lose the heat, then bring him to the safehouse. In that order.',
    ],
    setup(G) {
      G.mission.stage = 0;
      const rook = {
        x: 1400, y: 1400, angle: 0, speed: 0,
        shirt: '#e8b10c', skin: '#e8c39a', state: 'wait',
        health: 100, waitT: 0, target: null, car: null, punchT: 0, downT: 0, rook: true,
      };
      G.peds.push(rook);
      G.mission.data.rook = rook;
      setObjective(G, 'Pick up Rook at the plaza', 1400, 1400, 'Rook');
    },
    update(G) {
      const rook = G.mission.data.rook;
      if (G.mission.stage === 0) {
        if (Math.hypot(G.player.x - rook.x, G.player.y - rook.y) < 50) {
          G.mission.stage = 1;
          rook.state = 'walk';
          rook.target = { x: SAFEHOUSE.x, y: SAFEHOUSE.y };
          addCrime(G, 2, 'The cops spotted Rook with you');
          G.message('Rook is with you — lose the cops, then reach the safehouse.');
          setObjective(G, 'Lose the wanted level', G.player.x, G.player.y, 'Hide');
        }
      } else if (G.mission.stage === 1) {
        if (G.wanted === 0) {
          G.mission.stage = 2;
          setObjective(G, 'Drive Rook to the safehouse', SAFEHOUSE.x, SAFEHOUSE.y, 'Safehouse');
        }
      } else if (atTarget(G, 90)) {
        return 'done';
      }
    },
  },
  {
    id: 'turf',
    title: 'Turf Sweep',
    brief: [
      'The Dune Crew thinks the plaza is theirs. It is not.',
      'Three of them are waiting there. Settle it with your fists — and don\'t bring the cops.',
    ],
    setup(G) {
      G.mission.stage = 0;
      const spots = [{ x: 1360, y: 1360 }, { x: 1440, y: 1400 }, { x: 1400, y: 1460 }];
      G.mission.data.rivals = spots.map((spot, i) => {
        const rival = {
          x: spot.x, y: spot.y, angle: 0, speed: 95,
          shirt: i === 1 ? '#c94f43' : '#5b4a8a', skin: '#c98d5f', state: 'rival',
          health: 60, waitT: 0, target: null, car: null, punchT: 0, downT: 0,
        };
        G.peds.push(rival);
        return rival;
      });
      setObjective(G, 'Defeat the 3 rivals at the plaza', 1400, 1400, 'Rivals');
    },
    update(G) {
      const left = G.mission.data.rivals.filter((rival) => rival.state !== 'down').length;
      G.mission.objective = `Defeat the rivals at the plaza — ${left} left`;
      if (left === 0) return 'done';
    },
  },
  {
    id: 'cargo',
    title: 'Hot Cargo',
    brief: [
      'A truck full of "imported" goods is sitting at the Old Port.',
      'Drive it to the warehouse in the Marina. The port police will notice. They always do.',
    ],
    setup(G) {
      G.mission.stage = 0;
      const point = nearestRoadPoint(G.city, 420, 620);
      const truck = G.makeCar('truck', point.x, point.y, 0);
      truck.driver = 'none';
      truck.parked = true;
      G.cars.push(truck);
      G.mission.data.truck = truck;
      setObjective(G, 'Get in the truck at the Old Port', point.x, point.y, 'Truck');
    },
    update(G) {
      const truck = G.mission.data.truck;
      if (G.mission.stage === 0) {
        if (G.player.car === truck) {
          G.mission.stage = 1;
          addCrime(G, 3, 'The port police spotted the truck');
          setObjective(G, 'Deliver the truck to the Marina warehouse', 2620, 620, 'Warehouse');
        }
      } else if (Math.hypot(G.player.x - 2620, G.player.y - 620) < 90 && G.player.car === truck) {
        return 'done';
      }
    },
  },
  {
    id: 'score',
    title: 'The Big Score',
    brief: [
      'Last one. A yellow sports car, parked by the Marina. Worth more than everything we\'ve done.',
      'Steal it, outrun the whole city, and bring it to the docks. Two minutes. No mistakes.',
    ],
    setup(G) {
      G.mission.stage = 0;
      const point = nearestRoadPoint(G.city, 2780, 1820);
      const car = G.makeCar('sports', point.x, point.y, Math.PI / 2);
      car.driver = 'none';
      car.parked = true;
      G.cars.push(car);
      G.mission.data.car = car;
      setObjective(G, 'Steal the yellow sports car', point.x, point.y, 'Sports car');
    },
    update(G, dt) {
      const car = G.mission.data.car;
      if (G.mission.stage === 0) {
        if (G.player.car === car) {
          G.mission.stage = 1;
          G.mission.timer = 120;
          addCrime(G, 3, 'The whole city saw you take it');
          setObjective(G, 'Deliver the car to the docks', 420, 2200, 'Docks');
        }
      } else {
        G.mission.timer -= dt;
        if (G.mission.timer <= 0) {
          G.message('Out of time — the buyer found another driver.');
          G.mission.stage = 0;
          setObjective(G, 'Steal the yellow sports car', car.x, car.y, 'Sports car');
          return;
        }
        if (Math.hypot(G.player.x - 420, G.player.y - 2200) < 90 && G.player.car === car) return 'done';
      }
    },
  },
];

/** Look up a mission definition by id. */
export function missionDef(id) {
  return MISSIONS.find((def) => def.id === id);
}

/** Start the next mission in the chain, or announce the story is finished. */
export function startNextMission(G) {
  if (G.missionIndex >= MISSIONS.length) {
    G.mission = null;
    return;
  }
  const def = MISSIONS[G.missionIndex];
  G.mission = { def, stage: 0, timer: 0, target: null, objective: '', data: {} };
  def.setup(G);
  say(G, GIVER, [`${def.title} — $${MISSION_REWARDS[G.missionIndex]}`, ...def.brief]);
  G.message(`New mission: ${def.title}`);
}

/** Complete the active mission: pay, save, and queue the next one. */
function completeMission(G) {
  const index = G.missionIndex;
  const reward = MISSION_REWARDS[index];
  G.player.cash += reward;
  G.stats.missionsDone += 1;
  G.audio.missionDone();
  say(G, GIVER, [`${MISSIONS[index].title} — done. $${reward} is yours.`, index === MISSIONS.length - 1 ? 'That was the last job. Solmar is yours now.' : 'Come back when you are ready for the next one.']);
  G.mission = null;
  G.missionIndex += 1;
  G.saveGame();
  if (G.missionIndex >= MISSIONS.length) {
    G.player.cash += 1000;
    G.message('STORY COMPLETE — bonus $1000. Free roam Solmar!');
  }
}

/** Advance the mission system one step. */
export function updateMissions(G, dt) {
  if (!G.mission) {
    if (G.missionIndex < MISSIONS.length) startNextMission(G);
    return;
  }
  const result = G.mission.def.update(G, dt);
  if (result === 'done') completeMission(G);
}
