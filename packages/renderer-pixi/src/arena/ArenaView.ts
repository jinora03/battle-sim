import { Container, Graphics } from 'pixi.js';
import type { ArenaDefinition } from '@kinetic/content';
import type { WorldSnapshot } from '@kinetic/protocol';
import type { PresentationSettings } from '@kinetic/visual-engine';

/** Owns static arena artwork and cached obstacle rendering. */
export class ArenaView {
  readonly container = new Container();
  private readonly arenaGraphics = new Graphics();
  private readonly obstacleGraphics = new Graphics();
  private arena: ArenaDefinition | null = null;
  private settings: PresentationSettings | null = null;
  private obstacleCacheArenaId = '';
  private obstacleCacheProfile = '';
  private obstacleCacheLength = -1;
  private readonly obstacleCacheIds: string[] = [];
  private readonly obstacleCacheHp: number[] = [];
  private readonly obstacleCacheAlive: boolean[] = [];

  constructor() {
    this.container.addChild(this.arenaGraphics, this.obstacleGraphics);
  }

  setArena(arena: ArenaDefinition): void {
    if (this.arena?.id === arena.id) return;
    this.arena = arena;
    this.invalidateObstacleCache();
  }

  setSettings(settings: PresentationSettings): void {
    const profileChanged = this.settings?.renderProfile !== settings.renderProfile;
    this.settings = settings;
    if (profileChanged) this.invalidateObstacleCache();
  }

  resetObstacles(): void {
    this.obstacleGraphics.clear();
    this.invalidateObstacleCache();
  }

  drawArena(): void {
    if (!this.arena || !this.settings) return;
    this.arenaGraphics.clear();
    const background = this.arena.theme === 'foundry' ? 0x120c0a : this.arena.theme === 'temple' ? 0x0b1115 : 0x090d16;
    const border = this.arena.theme === 'foundry' ? 0x85543a : this.arena.theme === 'temple' ? 0x70828a : 0x526170;
    this.arenaGraphics.rect(0, 0, this.arena.width, this.arena.height).fill({ color: background, alpha: 1 });

    if (this.settings.arenaBackground && this.settings.renderProfile !== 'debug') {
      const width = this.arena.width;
      const height = this.arena.height;
      const glowRadius = Math.max(width, height) * 0.48;
      const themeA = this.arena.theme === 'foundry' ? 0xff5a38 : this.arena.theme === 'temple' ? 0x74e7ff : 0x5ab7ff;
      const themeB = this.arena.theme === 'foundry' ? 0xffb04a : this.arena.theme === 'temple' ? 0xa07cff : 0xb05cff;
      this.arenaGraphics.circle(width * 0.08, height * 0.12, glowRadius).fill({ color: themeA, alpha: 0.055 });
      this.arenaGraphics.circle(width * 0.92, height * 0.88, glowRadius * 0.92).fill({ color: themeB, alpha: 0.05 });
      this.arenaGraphics.circle(width * 0.52, height * 0.46, Math.min(width, height) * 0.34).fill({ color: 0x163b65, alpha: 0.035 });
      const gridStep = Math.max(78, Math.round(Math.min(width, height) / 8));
      for (let x = gridStep; x < width; x += gridStep) {
        this.arenaGraphics.moveTo(x, 0).lineTo(x, height).stroke({ color: themeA, width: 1, alpha: 0.035 });
      }
      for (let y = gridStep; y < height; y += gridStep) {
        this.arenaGraphics.moveTo(0, y).lineTo(width, y).stroke({ color: themeB, width: 1, alpha: 0.03 });
      }
      this.arenaGraphics.rect(18, 18, width - 36, height - 36).stroke({ color: themeA, width: 2, alpha: 0.12 });
    }

    for (const zone of this.arena.zones) {
      const color = zone.kind === 'ice' ? 0x8bdcff : zone.kind === 'water' ? 0x157fc7 : zone.kind === 'lava' ? 0xe24920 : zone.kind === 'electric' ? 0x66eaff : 0xd9f4ff;
      const alpha = zone.kind === 'wind' ? 0.055 : 0.16;
      if (zone.shape === 'circle') {
        this.arenaGraphics.circle(zone.x, zone.y, zone.radius).fill({ color, alpha });
        this.arenaGraphics.circle(zone.x, zone.y, zone.radius).stroke({ color, width: 3, alpha: 0.42 });
      } else {
        this.arenaGraphics.rect(zone.x, zone.y, zone.width, zone.height).fill({ color, alpha });
        this.arenaGraphics.rect(zone.x, zone.y, zone.width, zone.height).stroke({ color, width: 3, alpha: 0.36 });
      }
      if (zone.kind === 'wind') {
        const step = 70;
        for (let y = zone.y + 35; y < zone.y + zone.height; y += step) {
          this.arenaGraphics.moveTo(zone.x + zone.width * 0.35, y - 18).lineTo(zone.x + zone.width * 0.5, y + 18).lineTo(zone.x + zone.width * 0.65, y - 18)
            .stroke({ color, width: 2, alpha: 0.24 });
        }
      }
    }

    this.arenaGraphics.rect(0, 0, this.arena.width, this.arena.height).stroke({ color: border, width: 5, alpha: 0.92 });
    if (this.settings.renderProfile === 'debug') {
      for (let x = this.arena.spatialCellSize; x < this.arena.width; x += this.arena.spatialCellSize) {
        this.arenaGraphics.moveTo(x, 0).lineTo(x, this.arena.height).stroke({ color: 0x34404d, width: 1, alpha: 0.45 });
      }
      for (let y = this.arena.spatialCellSize; y < this.arena.height; y += this.arena.spatialCellSize) {
        this.arenaGraphics.moveTo(0, y).lineTo(this.arena.width, y).stroke({ color: 0x34404d, width: 1, alpha: 0.45 });
      }
      for (const zone of this.arena.spawnZones) {
        this.arenaGraphics.rect(zone.x, zone.y, zone.width, zone.height).stroke({ color: zone.team === 1 ? 0x66a7ff : zone.team === 2 ? 0xff6e6e : 0xe9e472, width: 2, alpha: 0.55 });
      }
    } else {
      const inset = 26;
      this.arenaGraphics.rect(inset, inset, this.arena.width - inset * 2, this.arena.height - inset * 2).stroke({ color: 0x172332, width: 2, alpha: 0.8 });
    }
  }

  drawObstacles(snapshot: WorldSnapshot): void {
    if (!this.arena || !this.settings) return;
    const obstacles = snapshot.obstacles;
    let changed = this.obstacleCacheArenaId !== this.arena.id
      || this.obstacleCacheProfile !== this.settings.renderProfile
      || this.obstacleCacheLength !== obstacles.length;
    if (!changed) {
      for (let index = 0; index < obstacles.length; index += 1) {
        const obstacle = obstacles[index];
        if (!obstacle
          || this.obstacleCacheIds[index] !== obstacle.id
          || this.obstacleCacheHp[index] !== obstacle.hp
          || this.obstacleCacheAlive[index] !== obstacle.alive) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;

    this.obstacleCacheArenaId = this.arena.id;
    this.obstacleCacheProfile = this.settings.renderProfile;
    this.obstacleCacheLength = obstacles.length;
    this.obstacleCacheIds.length = obstacles.length;
    this.obstacleCacheHp.length = obstacles.length;
    this.obstacleCacheAlive.length = obstacles.length;
    for (let index = 0; index < obstacles.length; index += 1) {
      const obstacle = obstacles[index];
      if (!obstacle) continue;
      this.obstacleCacheIds[index] = obstacle.id;
      this.obstacleCacheHp[index] = obstacle.hp;
      this.obstacleCacheAlive[index] = obstacle.alive;
    }

    this.obstacleGraphics.clear();
    for (const obstacle of snapshot.obstacles) {
      if (!obstacle.alive) continue;
      const color = obstacle.kind === 'reactor' ? 0xff8a3d : obstacle.kind === 'crate' ? 0x8d6744 : 0x61717a;
      const accent = obstacle.kind === 'reactor' ? 0xffd165 : obstacle.kind === 'crate' ? 0xd9a467 : 0xaab9c0;
      if (obstacle.shape === 'circle') {
        this.obstacleGraphics.circle(obstacle.x, obstacle.y, obstacle.radius).fill({ color, alpha: 0.95 });
        this.obstacleGraphics.circle(obstacle.x, obstacle.y, obstacle.radius * 0.72).stroke({ color: accent, width: 5, alpha: 0.65 });
        if (obstacle.kind === 'reactor') this.obstacleGraphics.circle(obstacle.x, obstacle.y, obstacle.radius * 0.28).fill({ color: 0xfff0a0, alpha: 0.86 });
      } else {
        this.obstacleGraphics.rect(obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2, obstacle.width, obstacle.height).fill({ color, alpha: 0.94 });
        this.obstacleGraphics.rect(obstacle.x - obstacle.width / 2 + 8, obstacle.y - obstacle.height / 2 + 8, obstacle.width - 16, obstacle.height - 16).stroke({ color: accent, width: 4, alpha: 0.72 });
        this.obstacleGraphics.moveTo(obstacle.x - obstacle.width / 2 + 12, obstacle.y - obstacle.height / 2 + 12).lineTo(obstacle.x + obstacle.width / 2 - 12, obstacle.y + obstacle.height / 2 - 12).stroke({ color: accent, width: 3, alpha: 0.42 });
      }
      if (obstacle.destructible && obstacle.maxHp > 0 && this.settings.renderProfile === 'standard') {
        const width = obstacle.shape === 'circle' ? obstacle.radius * 1.4 : obstacle.width * 0.78;
        const top = obstacle.shape === 'circle' ? obstacle.y - obstacle.radius - 12 : obstacle.y - obstacle.height / 2 - 12;
        const ratio = Math.max(0, obstacle.hp / obstacle.maxHp);
        this.obstacleGraphics.rect(obstacle.x - width / 2, top, width, 5).fill({ color: 0x1b1510, alpha: 0.85 });
        this.obstacleGraphics.rect(obstacle.x - width / 2, top, width * ratio, 5).fill({ color: ratio > 0.4 ? 0xffc86b : 0xff674f, alpha: 0.95 });
      }
    }
  }

  invalidateObstacleCache(): void {
    this.obstacleCacheArenaId = '';
    this.obstacleCacheProfile = '';
    this.obstacleCacheLength = -1;
    this.obstacleCacheIds.length = 0;
    this.obstacleCacheHp.length = 0;
    this.obstacleCacheAlive.length = 0;
  }
}
