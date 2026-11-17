// The renderer: the camera, the city, the cars, the people and the effects,
// all drawn on one canvas in a fixed 1280x720 logical view.

import { BEACH, PALETTE, ROAD_WIDTH, VIEW, WORLD } from './config.js';
import { lightState } from './world.js';
import { drawGameOver, drawHUD, drawPaused, drawTitle } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Keep the camera on the player, clamped inside the city. */
function updateCamera(G) {
  const target = G.player.car && !G.player.onFoot ? G.player.car : G.player;
  G.camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, target.x));
  G.camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, target.y));
}

function drawGround(ctx, G) {
  const cam = G.camera;
  const x0 = cam.x - VIEW.width / 2;
  const y0 = cam.y - VIEW.height / 2;
  // Grass base, with a subtle checker of two greens so the ground is not flat.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = PALETTE.grassDark;
  const tile = 160;
  const startX = Math.floor(x0 / tile) * tile;
  const startY = Math.floor(y0 / tile) * tile;
  for (let x = startX; x < x0 + VIEW.width + tile; x += tile) {
    for (let y = startY; y < y0 + VIEW.height + tile; y += tile) {
      if (((x / tile) + (y / tile)) % 2 === 0) ctx.fillRect(x - x0, y - y0, tile, tile);
    }
  }
  // Beach sand and water along the south edge.
  const sandY = BEACH.sandTop - y0;
  const waterY = BEACH.waterTop - y0;
  if (sandY < VIEW.height) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, Math.max(0, sandY), VIEW.width, VIEW.height - Math.max(0, sandY));
  }
  if (waterY < VIEW.height) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, Math.max(0, waterY), VIEW.width, VIEW.height - Math.max(0, waterY));
    // Animated wave lines, driven by the game clock so shots stay deterministic.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const wy = waterY + 14 + i * 26 + Math.sin(G.time * 1.5 + i * 2) * 4;
      if (wy < 0 || wy > VIEW.height) continue;
      ctx.beginPath();
      for (let x = 0; x <= VIEW.width; x += 32) {
        const yy = wy + Math.sin(x / 90 + G.time * 2 + i) * 3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
}

function drawRoads(ctx, G) {
  const cam = G.camera;
  const x0 = cam.x - VIEW.width / 2;
  const y0 = cam.y - VIEW.height / 2;
  // Sidewalks first, then asphalt, so the road sits inside its walk.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const avenue of G.city.avenues) {
    ctx.fillRect(avenue - ROAD_WIDTH / 2 - 26 - x0, 150 - y0, ROAD_WIDTH + 52, 2150);
  }
  for (const street of G.city.streets) {
    ctx.fillRect(150 - x0, street - ROAD_WIDTH / 2 - 26 - y0, 2950, ROAD_WIDTH + 52);
  }
  ctx.fillStyle = PALETTE.road;
  for (const avenue of G.city.avenues) {
    ctx.fillRect(avenue - ROAD_WIDTH / 2 - x0, 150 - y0, ROAD_WIDTH, 2150);
  }
  for (const street of G.city.streets) {
    ctx.fillRect(150 - x0, street - ROAD_WIDTH / 2 - y0, 2950, ROAD_WIDTH);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const avenue of G.city.avenues) {
    for (let y = 200; y < 2250; y += 48) ctx.fillRect(avenue - 2 - x0, y - y0, 4, 24);
  }
  for (const street of G.city.streets) {
    for (let x = 200; x < 3050; x += 48) ctx.fillRect(x - x0, street - 2 - y0, 24, 4);
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const avenue of G.city.avenues) {
    for (const street of G.city.streets) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(avenue - ROAD_WIDTH / 2 - x0, street - ROAD_WIDTH / 2 - 8 + i * 6 - y0, 10, 4);
        ctx.fillRect(avenue + ROAD_WIDTH / 2 - 10 - x0, street - ROAD_WIDTH / 2 - 8 + i * 6 - y0, 10, 4);
      }
    }
  }
}

function drawParksAndTrees(ctx, G) {
  const cam = G.camera;
  const x0 = cam.x - VIEW.width / 2;
  const y0 = cam.y - VIEW.height / 2;
  ctx.fillStyle = PALETTE.park;
  for (const park of G.city.parks) ctx.fillRect(park.x - x0, park.y - y0, park.w, park.h);
  for (const tree of G.city.trees) {
    const tx = tree.x - x0;
    const ty = tree.y - y0;
    if (tx < -30 || tx > VIEW.width + 30 || ty < -30 || ty > VIEW.height + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(tx + 4, ty + 5, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (tree.palm) {
      ctx.strokeStyle = '#7a5a3a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx, ty + 8);
      ctx.lineTo(tx, ty - 6);
      ctx.stroke();
      ctx.fillStyle = '#3f8a3f';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(tx + Math.cos(a) * 10, ty - 6 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(tx, ty, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeLight;
      ctx.beginPath();
      ctx.arc(tx - 3, ty - 3, tree.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBuildings(ctx, G) {
  const cam = G.camera;
  const x0 = cam.x - VIEW.width / 2;
  const y0 = cam.y - VIEW.height / 2;
  for (const building of G.city.buildings) {
    const bx = building.x - x0;
    const by = building.y - y0;
    if (bx > VIEW.width + 40 || by > VIEW.height + 40 || bx + building.w < -40 || by + building.h < -40) continue;
    // A long afternoon shadow, then the roof, then windows.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(bx + 10, by + 12, building.w, building.h);
    ctx.fillStyle = building.color;
    ctx.fillRect(bx, by, building.w, building.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, building.w - 2, building.h - 2);
    if (building.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(bx + 6, by + 6, building.w - 12, 10);
    }
    ctx.fillStyle = 'rgba(20,30,45,0.5)';
    const cols = Math.max(1, Math.floor(building.w / 26));
    const rows = Math.max(1, Math.floor(building.h / 26));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if ((building.seed + c * 7 + r * 13) % 3 === 0) continue;
        ctx.fillRect(bx + 8 + c * 26, by + 8 + r * 26, 12, 12);
      }
    }
  }
}

function drawTrafficLights(ctx, G) {
  const cam = G.camera;
  const x0 = cam.x - VIEW.width / 2;
  const y0 = cam.y - VIEW.height / 2;
  for (const light of G.city.lights) {
    const lx = light.x - x0;
    const ly = light.y - y0;
    if (lx < -20 || lx > VIEW.width + 20 || ly < -20 || ly > VIEW.height + 20) continue;
    const state = lightState(light, G.time);
    ctx.fillStyle = '#22262e';
    ctx.fillRect(lx + ROAD_WIDTH / 2 + 2, ly - ROAD_WIDTH / 2 - 16, 8, 22);
    ctx.fillStyle = state === 'ns' ? '#ff5a4e' : '#5ec95e';
    ctx.beginPath();
    ctx.arc(lx + ROAD_WIDTH / 2 + 6, ly - ROAD_WIDTH / 2 - 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = state === 'ew' ? '#ff5a4e' : '#5ec95e';
    ctx.beginPath();
    ctx.arc(lx + ROAD_WIDTH / 2 + 6, ly - ROAD_WIDTH / 2 - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCar(ctx, G, car) {
  const cam = G.camera;
  const x = car.x - (cam.x - VIEW.width / 2);
  const y = car.y - (cam.y - VIEW.height / 2);
  if (x < -80 || x > VIEW.width + 80 || y < -80 || y > VIEW.height + 80) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width);
  // Body.
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  ctx.beginPath();
  ctx.roundRect(-car.length / 2, -car.width / 2, car.length, car.width, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Roof and windows.
  ctx.fillStyle = car.wrecked ? '#2a2a2a' : 'rgba(20,30,45,0.55)';
  ctx.beginPath();
  ctx.roundRect(-car.length / 2 + 10, -car.width / 2 + 4, car.length - 22, car.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-car.length / 2 + 12, -car.width / 2 + 5, 8, car.width - 10);
  // Headlights and brake lights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(car.length / 2 - 3, -car.width / 2 + 3, 3, 5);
  ctx.fillRect(car.length / 2 - 3, car.width / 2 - 8, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2a1e' : '#a33';
  ctx.fillRect(-car.length / 2, -car.width / 2 + 3, 3, 5);
  ctx.fillRect(-car.length / 2, car.width / 2 - 8, 3, 5);
  // Police livery and light bar.
  if (car.type === 'police') {
    ctx.fillStyle = '#f5f2e8';
    ctx.fillRect(-car.length / 2 + 6, -car.width / 2, car.length - 12, 5);
    ctx.fillRect(-car.length / 2 + 6, car.width / 2 - 5, car.length - 12, 5);
    const phase = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2a1e' : '#2a6bff';
    ctx.fillRect(-6, -car.width / 2 - 2, 6, 4);
    ctx.fillStyle = phase ? '#2a6bff' : '#ff2a1e';
    ctx.fillRect(0, -car.width / 2 - 2, 6, 4);
  }
  // Taxi sign.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#f5f2e8';
    ctx.fillRect(-8, -car.width / 2 - 2, 16, 4);
    ctx.fillStyle = '#111';
    ctx.font = '6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -car.width / 2 - 3);
  }
  ctx.restore();
  // Smoke from a damaged car.
  if (car.smoke > 0.1) {
    ctx.fillStyle = `rgba(120,120,120,${0.35 * car.smoke})`;
    ctx.beginPath();
    ctx.arc(x, y - 8, 6 + car.smoke * 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPed(ctx, G, ped) {
  const cam = G.camera;
  const x = ped.x - (cam.x - VIEW.width / 2);
  const y = ped.y - (cam.y - VIEW.height / 2);
  if (x < -30 || x > VIEW.width + 30 || y < -30 || y > VIEW.height + 30) return;
  ctx.save();
  ctx.translate(x, y);
  if (ped.state === 'down') {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.roundRect(-11, -7, 22, 14, 6);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(13, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.roundRect(-8, -8, 16, 18, 6);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -12, 6, 0, Math.PI * 2);
  ctx.fill();
  if (ped.state === 'rival') {
    ctx.fillStyle = '#e5534b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -22);
  }
  if (ped.rook) {
    ctx.fillStyle = '#f2c94c';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('R', 0, -22);
  }
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const player = G.player;
  if (!player.onFoot) return;
  const cam = G.camera;
  const x = player.x - (cam.x - VIEW.width / 2);
  const y = player.y - (cam.y - VIEW.height / 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 5, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = player.moving ? Math.sin(G.time * 14) * 2 : 0;
  ctx.rotate(player.angle);
  // Punch: an arm swings out.
  if (player.punchT > 0) {
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.roundRect(8, -5, 20, 9, 4);
    ctx.fill();
  }
  // A light outline so the player reads against the road.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(-12, -12, 24, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#2f6fb8';
  ctx.beginPath();
  ctx.roundRect(-10, -10, 20, 24, 7);
  ctx.fill();
  ctx.fillStyle = '#e8b10c';
  ctx.beginPath();
  ctx.arc(0, -15, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(-10, 10 + bob, 8, 5);
  ctx.fillRect(2, 10 - bob, 8, 5);
  ctx.restore();
  if (player.hurtT > 0) {
    ctx.fillStyle = 'rgba(229,83,75,0.18)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

function drawPickups(ctx, G) {
  const cam = G.camera;
  for (const pickup of G.pickups) {
    if (pickup.taken) continue;
    const x = pickup.x - (cam.x - VIEW.width / 2);
    const y = pickup.y - (cam.y - VIEW.height / 2);
    if (x < -20 || x > VIEW.width + 20 || y < -20 || y > VIEW.height + 20) continue;
    const bob = Math.sin(G.time * 3 + pickup.x) * 3;
    ctx.save();
    ctx.translate(x, y + bob);
    if (pickup.kind === 'health') {
      ctx.fillStyle = '#f5f2e8';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(-3, -7, 6, 14);
      ctx.fillRect(-7, -3, 14, 6);
    } else if (pickup.kind === 'cash') {
      ctx.fillStyle = '#5ec95e';
      ctx.beginPath();
      ctx.roundRect(-10, -6, 20, 12, 2);
      ctx.fill();
      ctx.fillStyle = '#1f5f2a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 3);
    } else {
      ctx.fillStyle = '#c9c2ae';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a6068';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('R', 0, 3);
    }
    ctx.restore();
  }
}

function drawMissionMarker(ctx, G) {
  const mission = G.mission;
  if (!mission || !mission.target) return;
  const cam = G.camera;
  const x = mission.target.x - (cam.x - VIEW.width / 2);
  const y = mission.target.y - (cam.y - VIEW.height / 2);
  const pulse = 26 + Math.sin(G.time * 4) * 6;
  ctx.save();
  ctx.strokeStyle = '#f2c94c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.moveTo(x, y - 34);
  ctx.lineTo(x + 9, y - 18);
  ctx.lineTo(x - 9, y - 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // An edge arrow when the marker is off-screen.
  if (x < 0 || x > VIEW.width || y < 0 || y > VIEW.height) {
    const cx = Math.max(30, Math.min(VIEW.width - 30, x));
    const cy = Math.max(30, Math.min(VIEW.height - 30, y));
    const angle = Math.atan2(y - VIEW.height / 2, x - VIEW.width / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles(ctx, G) {
  const cam = G.camera;
  for (const particle of G.particles) {
    const x = particle.x - (cam.x - VIEW.width / 2);
    const y = particle.y - (cam.y - VIEW.height / 2);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.t / particle.life);
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawSkids(ctx, G) {
  const cam = G.camera;
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.lineWidth = 3;
  for (const skid of G.skids) {
    ctx.beginPath();
    ctx.moveTo(skid.x1 - (cam.x - VIEW.width / 2), skid.y1 - (cam.y - VIEW.height / 2));
    ctx.lineTo(skid.x2 - (cam.x - VIEW.width / 2), skid.y2 - (cam.y - VIEW.height / 2));
    ctx.stroke();
  }
}

/** Create the renderer for a canvas: scale the 1280x720 view to the window. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewScale = 1;
  let viewOffsetX = 0;
  let viewOffsetY = 0;
  let viewDpr = 1;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewDpr = dpr;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  }
  window.addEventListener('resize', resize);
  resize();

  function draw(G, screen) {
    const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    const offsetX = (canvas.width - VIEW.width * scale) / 2;
    const offsetY = (canvas.height - VIEW.height * scale) / 2;
    viewScale = scale;
    viewOffsetX = offsetX;
    viewOffsetY = offsetY;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1016';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    updateCamera(G);
    drawGround(ctx, G);
    drawRoads(ctx, G);
    drawParksAndTrees(ctx, G);
    drawBuildings(ctx, G);
    drawTrafficLights(ctx, G);
    drawSkids(ctx, G);
    drawPickups(ctx, G);
    drawMissionMarker(ctx, G);
    for (const car of G.cars) drawCar(ctx, G, car);
    for (const ped of G.peds) drawPed(ctx, G, ped);
    for (const cop of G.cops) {
      drawPed(ctx, G, { ...cop, shirt: '#1c3f94', skin: '#e8c39a', state: cop.down ? 'down' : 'walk' });
    }
    drawPlayer(ctx, G);
    drawParticles(ctx, G);
    if (screen === SCREEN_TITLE) drawTitle(ctx, G);
    else if (screen === SCREEN_PAUSED) {
      drawHUD(ctx, G);
      drawPaused(ctx, G);
    } else if (screen === SCREEN_OVER) drawGameOver(ctx, G);
    else drawHUD(ctx, G);
  }

  return {
    draw,
    resize,
    /** Convert a mouse position in CSS pixels to world coordinates. */
    toWorld(clientX, clientY, G) {
      const deviceX = clientX * viewDpr;
      const deviceY = clientY * viewDpr;
      const viewX = (deviceX - viewOffsetX) / viewScale;
      const viewY = (deviceY - viewOffsetY) / viewScale;
      const camera = G ? G.camera : { x: VIEW.width / 2, y: VIEW.height / 2 };
      return {
        x: camera.x - VIEW.width / 2 + viewX,
        y: camera.y - VIEW.height / 2 + viewY,
      };
    },
  };
}
