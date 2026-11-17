// The live minimap: the whole city shrunk to a corner, with the player, the
// police and the mission marker on it.

import { AVENUES, BEACH, PALETTE, STREETS, WORLD } from './config.js';

const MAP_W = 216;
const MAP_H = 172;

/** Draw the minimap at the given screen position. */
export function drawMinimap(ctx, G, x, y) {
  const scale = MAP_W / WORLD.width;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 20, 0.72)';
  ctx.fillRect(x - 6, y - 6, MAP_W + 12, MAP_H + 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6, y - 6, MAP_W + 12, MAP_H + 12);
  ctx.beginPath();
  ctx.rect(x, y, MAP_W, MAP_H);
  ctx.clip();
  // Ground and water.
  ctx.fillStyle = PALETTE.grassDark;
  ctx.fillRect(x, y, MAP_W, MAP_H);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(x, y + (BEACH.waterTop - 0) * scale, MAP_W, MAP_H);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x, y + BEACH.sandTop * scale, MAP_W, (BEACH.waterTop - BEACH.sandTop) * scale);
  // Roads.
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = 5;
  for (const avenue of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(x + avenue * scale, y);
    ctx.lineTo(x + avenue * scale, y + MAP_H);
    ctx.stroke();
  }
  for (const street of STREETS) {
    ctx.beginPath();
    ctx.moveTo(x, y + street * scale);
    ctx.lineTo(x + MAP_W, y + street * scale);
    ctx.stroke();
  }
  // Mission marker: a pulsing yellow diamond.
  if (G.mission && G.mission.target) {
    const pulse = 5 + Math.sin(G.time * 5) * 2;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(x + G.mission.target.x * scale, y + G.mission.target.y * scale - pulse);
    ctx.lineTo(x + G.mission.target.x * scale + pulse, y + G.mission.target.y * scale);
    ctx.lineTo(x + G.mission.target.x * scale, y + G.mission.target.y * scale + pulse);
    ctx.lineTo(x + G.mission.target.x * scale - pulse, y + G.mission.target.y * scale);
    ctx.closePath();
    ctx.fill();
  }
  // Police: blue dots (cars) and squares (foot cops).
  ctx.fillStyle = '#5aa2ff';
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    ctx.fillRect(x + car.x * scale - 2, y + car.y * scale - 2, 4, 4);
  }
  for (const cop of G.cops) {
    if (cop.down) continue;
    ctx.fillRect(x + cop.x * scale - 2, y + cop.y * scale - 2, 4, 4);
  }
  // The player: a white arrow pointing where they face.
  const px = x + G.player.x * scale;
  const py = y + G.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
