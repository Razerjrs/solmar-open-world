// The HUD and the menus: wanted stars, cash, health, speed, the mission
// objective, the dialogue box, toasts, and the title, pause and game-over screens.

import { FONT, PALETTE, VIEW } from './config.js';
import { districtAt } from './world.js';
import { drawMinimap } from './minimap.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function drawStars(ctx, G) {
  // Inset from the viewport edges: the star glyph's ink runs ~10px above its
  // draw centre and ~4px left of its draw x in the fallback font, so the
  // row needs a real margin or it reads as clipped at the frame edge.
  const x = 28;
  const y = 30;
  ctx.font = '26px ' + FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < G.wanted ? PALETTE.gold : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', x + i * 30, y + 14);
  }
  if (G.wanted > 0) {
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillStyle = PALETTE.red;
    ctx.fillText('WANTED', x, y + 40);
  }
}

function drawCashHealth(ctx, G) {
  const w = 230;
  const x = VIEW.width - w - 16;
  panel(ctx, x, 16, w, 58);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`$${G.player.cash.toLocaleString('en-US')}`, x + 12, 32);
  ctx.font = '12px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`Best $${G.best.toLocaleString('en-US')}`, x + 12, 56);
  const healthW = w - 24;
  // Health bar lives just under the cash panel.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x + 12, 62, healthW, 8);
  ctx.fillStyle = G.player.health > 35 ? '#5ec95e' : PALETTE.red;
  ctx.fillRect(x + 12, 62, healthW * (G.player.health / 100), 8);
}

function drawObjective(ctx, G) {
  if (!G.mission) return;
  const text = G.mission.objective;
  ctx.font = 'bold 15px ' + FONT;
  const w = Math.min(560, ctx.measureText(text).width + 90);
  const x = (VIEW.width - w) / 2;
  panel(ctx, x, 14, w, 34);
  ctx.fillStyle = PALETTE.gold;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('◆', x + 12, 32);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(text, x + 32, 32);
  if (G.mission.timer > 0) {
    ctx.fillStyle = G.mission.timer < 20 ? PALETTE.red : PALETTE.text;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(G.mission.timer)}s`, x + w - 12, 32);
    ctx.textAlign = 'left';
  }
}

function drawDialogue(ctx, G) {
  const dialogue = G.dialogue;
  if (!dialogue) return;
  const line = dialogue.lines[dialogue.index];
  const w = 720;
  const h = 86;
  const x = (VIEW.width - w) / 2;
  const y = VIEW.height - h - 24;
  panel(ctx, x, y, w, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 13px ' + FONT;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(dialogue.who.toUpperCase(), x + 16, y + 12);
  ctx.font = '15px ' + FONT;
  ctx.fillStyle = PALETTE.text;
  wrapText(ctx, line, x + 16, y + 34, w - 32, 20);
  ctx.font = '11px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Enter to continue', x + w - 120, y + h - 18);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let row = 0;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight);
      line = word;
      row += 1;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y + row * lineHeight);
}

function drawMessages(ctx, G) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '14px ' + FONT;
  let y = 96;
  for (const message of G.messages) {
    const alpha = Math.min(1, message.t * 2);
    ctx.fillStyle = `rgba(245,242,232,${alpha})`;
    ctx.fillText(message.text, 16, y);
    y += 22;
  }
}

function drawSpeed(ctx, G) {
  if (G.player.onFoot || !G.player.car) return;
  const mph = Math.round(Math.abs(G.player.car.speed) * 0.14);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 30px ' + FONT;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`${mph}`, VIEW.width - 20, VIEW.height - 52);
  ctx.font = '12px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('mph', VIEW.width - 20, VIEW.height - 28);
  ctx.textAlign = 'left';
}

function drawHint(ctx, G) {
  const hint = G.player.onFoot
    ? 'WASD move · Shift run · E enter car · F punch · M mute · K save'
    : 'WASD drive · Space handbrake · E exit car · M mute · K save';
  ctx.font = '12px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(245,242,232,0.6)';
  ctx.fillText(hint, VIEW.width / 2, VIEW.height - 12);
}

function drawDistrictBanner(ctx, G) {
  if (!G.districtBanner) return;
  const alpha = Math.min(1, G.districtBanner.t);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 34px ' + FONT;
  ctx.fillStyle = `rgba(245,242,232,${alpha})`;
  ctx.fillText(G.districtBanner.name, VIEW.width / 2, 130);
  ctx.font = '14px ' + FONT;
  ctx.fillStyle = `rgba(184,178,164,${alpha})`;
  ctx.fillText('Solmar', VIEW.width / 2, 162);
  ctx.textAlign = 'left';
}

/** The in-game HUD: stars, cash, objective, minimap, dialogue, toasts. */
export function drawHUD(ctx, G) {
  drawStars(ctx, G);
  drawCashHealth(ctx, G);
  drawObjective(ctx, G);
  drawMinimap(ctx, G, 16, VIEW.height - 188);
  drawMessages(ctx, G);
  drawDialogue(ctx, G);
  drawSpeed(ctx, G);
  drawHint(ctx, G);
  drawDistrictBanner(ctx, G);
  const district = districtAt(G.player.x, G.player.y);
  if (district !== G.district) {
    G.district = district;
    G.districtBanner = { name: district, t: 1.6 };
  }
}

function bigTitle(ctx, G) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2a007';
  ctx.font = 'bold 92px ' + FONT;
  ctx.fillText('SOLMAR', VIEW.width / 2, 210);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px ' + FONT;
  ctx.fillText('A sun-soaked open-world crime game', VIEW.width / 2, 268);
  ctx.font = '15px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Steal cars. Outrun the law. Run six jobs for Mara Voss — and take the city.', VIEW.width / 2, 296);
  ctx.textAlign = 'left';
}

/** The title screen. */
export function drawTitle(ctx, G) {
  ctx.fillStyle = 'rgba(8, 12, 18, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  bigTitle(ctx, G);
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillStyle = PALETTE.gold;
  const blink = Math.sin(G.time * 4) > -0.2;
  if (blink) ctx.fillText('Press ENTER or click to play', VIEW.width / 2, 380);
  if (G.hasSave) {
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('Save found — press C to continue your story', VIEW.width / 2, 412);
  }
  ctx.font = '14px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('WASD / arrows — move & drive · Shift — run · E — enter / exit car · F — punch', VIEW.width / 2, 470);
  ctx.fillText('Space — handbrake · Esc — pause · M — mute · K — save · R — restart', VIEW.width / 2, 494);
  ctx.font = '12px ' + FONT;
  ctx.fillText('An original game. No Rockstar names, maps, art or music.', VIEW.width / 2, 540);
  ctx.textAlign = 'left';
}

/** The pause screen. */
export function drawPaused(ctx, G) {
  ctx.fillStyle = 'rgba(8, 12, 18, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 52px ' + FONT;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('PAUSED', VIEW.width / 2, 300);
  ctx.font = '16px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Progress saved. Esc to resume · M to mute · R to restart the story', VIEW.width / 2, 350);
  ctx.textAlign = 'left';
}

/** The game-over screen: wasted or busted, with the run's numbers. */
export function drawGameOver(ctx, G) {
  ctx.fillStyle = 'rgba(20, 6, 8, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 84px ' + FONT;
  ctx.fillStyle = G.gameOver === 'busted' ? '#5aa2ff' : PALETTE.red;
  ctx.fillText(G.gameOver === 'busted' ? 'BUSTED' : 'WASTED', VIEW.width / 2, 280);
  ctx.font = '17px ' + FONT;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`Cash kept: $${G.player.cash.toLocaleString('en-US')} · Missions done: ${G.stats.missionsDone} · Cars stolen: ${G.stats.carsStolen}`, VIEW.width / 2, 350);
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillStyle = PALETTE.gold;
  if (Math.sin(G.time * 4) > -0.2) ctx.fillText('Press R to start over', VIEW.width / 2, 400);
  ctx.textAlign = 'left';
}
