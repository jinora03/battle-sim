import { Container, Graphics } from 'pixi.js';
import {
  isMissileCascadeAbility,
  isMissileCascadeFrame,
  isMissileWeapon,
  resolveBlastFeedback,
  resolveUltimateFreezeMs,
  resolveWeaponHitFreezeMs,
  shouldPresentDamage
} from '../combatFeedback';
import {
  getAttackSource,
  getPrimaryAttack,
  getProjectileSource,
  type PrimaryAttackDefinition
} from '@kinetic/content';
import type { SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import {
  elementColor,
  getSkillPresentation,
  resolveImpactResponse,
  type SkillPresentationRecipe
} from '@kinetic/visual-engine';

export interface FxResponse {
  shake: number;
  freezeMs: number;
  screenFlash: number;
}

function isProjectileBehavior(behavior: PrimaryAttackDefinition['behavior']): boolean {
  return behavior === 'ranged' || behavior === 'automatic' || behavior === 'throwable' || behavior === 'beam';
}

function primaryAttackColor(attack: Pick<PrimaryAttackDefinition, 'form'>): number {
  switch (attack.form) {
    case 'fire': return 0xff7a35;
    case 'water': return 0x72dcff;
    case 'ice': return 0xc9f4ff;
    case 'lightning': return 0xa6fbff;
    case 'nature': return 0xa9e87e;
    case 'void': return 0xc69cff;
    case 'rifle': return 0xffe6a4;
    case 'launcher': return 0xffb347;
    case 'gauntlet': return 0xd3e1eb;
    default: return 0xfff0bc;
  }
}

interface ParticleState {
  node: Graphics;
  active: boolean;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  drag: number;
  growth: number;
}

interface ShockwaveState {
  node: Graphics;
  active: boolean;
  life: number;
  maxLife: number;
}

interface FlashState {
  node: Graphics;
  active: boolean;
  life: number;
  maxLife: number;
}

export class FxEngine {
  private readonly particles: ParticleState[] = [];
  private readonly shockwaves: ShockwaveState[] = [];
  private readonly flashes: FlashState[] = [];

  constructor(private readonly container: Container) {
    // Additive blending makes bright particles/flashes/shockwaves bloom and glow
    // over the dark arena instead of looking like flat sprites.
    for (let i = 0; i < 420; i += 1) {
      const node = new Graphics();
      node.visible = false;
      node.blendMode = 'add';
      container.addChild(node);
      this.particles.push({ node, active: false, vx: 0, vy: 0, life: 0, maxLife: 1, drag: 0.96, growth: 0 });
    }
    for (let i = 0; i < 28; i += 1) {
      const node = new Graphics();
      node.visible = false;
      node.blendMode = 'add';
      container.addChild(node);
      this.shockwaves.push({ node, active: false, life: 0, maxLife: 1 });
    }
    for (let i = 0; i < 14; i += 1) {
      const node = new Graphics();
      node.visible = false;
      node.blendMode = 'add';
      container.addChild(node);
      this.flashes.push({ node, active: false, life: 0, maxLife: 1 });
    }
  }

  consume(events: readonly SimulationEvent[], snapshot: WorldSnapshot, particleScale: number): FxResponse {
    let shake = 0;
    let freezeMs = 0;
    let screenFlash = 0;
    const entityMap = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
    const missileCascadeFrame = isMissileCascadeFrame(events);
    let missileDamageFx = 0;
    let missileHitFx = 0;
    let missileBlastFx = 0;
    let missileKnockbackFx = 0;

    for (const event of events) {
      if (missileCascadeFrame) {
        // A 16-missile ultimate can emit well over 80 semantic events in one
        // tick. Preserve a dense visual barrage without redrawing every
        // duplicate damage/impulse payload and stalling the renderer.
        if (event.type === 'damage' && ++missileDamageFx > 10) continue;
        if (event.type === 'weaponHit' && isMissileWeapon(event.weaponId) && ++missileHitFx > 6) continue;
        if (event.type === 'blast' && isMissileWeapon(event.abilityId ?? '') && ++missileBlastFx > 10) continue;
        if (event.type === 'knockbackApplied' && ++missileKnockbackFx > 10) continue;
      }
      if (event.type === 'impact') {
        const a = entityMap.get(event.a);
        const color = elementColor(a?.elements[0] ?? 'neutral');
        const response = resolveImpactResponse(event.magnitude);
        this.burst(event.position.x, event.position.y, color, Math.round(response.particleCount * particleScale), response.particleSpeed, 1.5, 4.2, 0.16, 0.42, 0.955, 0.25);
        if (response.shockwaveRadius > 0) this.shockwave(event.position.x, event.position.y, color, response.shockwaveRadius, 2.5, 0.28);
        shake = Math.max(shake, response.shake);
        freezeMs = Math.max(freezeMs, response.freezeMs);
        screenFlash = Math.max(screenFlash, response.flash);
      } else if (event.type === 'wallImpact') {
        const entity = entityMap.get(event.entityId);
        const color = elementColor(entity?.elements[0] ?? 'neutral');
        const count = Math.round(Math.min(14, 3 + event.magnitude) * particleScale);
        this.burst(event.position.x, event.position.y, color, count, 4.5, 1.2, 3.2, 0.12, 0.28, 0.94, 0.15);
        if (event.magnitude >= 6.5) {
          this.flash(event.position.x, event.position.y, 0xffffff, Math.min(25, 10 + event.magnitude), 0.08);
          this.shockwave(event.position.x, event.position.y, color, Math.min(52, 18 + event.magnitude * 1.8), 3, 0.22);
          freezeMs = Math.max(freezeMs, Math.min(28, 4 + event.magnitude * 1.2));
        }
        shake = Math.max(shake, Math.min(4.5, event.magnitude * 0.3));
      } else if (event.type === 'obstacleImpact') {
        const count = Math.round(Math.min(18, 4 + event.magnitude * 0.8) * particleScale);
        this.burst(event.position.x, event.position.y, 0xc4b79a, count, 5.2, 1.4, 4.4, 0.16, 0.4, 0.95, 0.28);
        shake = Math.max(shake, Math.min(7, event.magnitude * 0.18));
      } else if (event.type === 'obstacleDamaged') {
        this.burst(event.position.x, event.position.y, 0xe2b36d, Math.round(10 * particleScale), 5.8, 1.8, 4.6, 0.18, 0.4, 0.95, 0.35);
      } else if (event.type === 'obstacleDestroyed') {
        this.flash(event.position.x, event.position.y, 0xffe0a3, 34, 0.18);
        this.burst(event.position.x, event.position.y, 0x9d7950, Math.round(34 * particleScale), 9, 2.4, 6.5, 0.25, 0.6, 0.95, 0.6);
        this.shockwave(event.position.x, event.position.y, 0xffc46c, 58, 4, 0.34);
        shake = Math.max(shake, 11);
        freezeMs = Math.max(freezeMs, 36);
      } else if (event.type === 'hazardTriggered') {
        const color = event.kind === 'lava' ? 0xff5b25 : event.kind === 'electric' ? 0x89eaff : event.kind === 'wind' ? 0xd7f7ff : 0x72dfff;
        this.burst(event.position.x, event.position.y, color, Math.round((event.damage > 0 ? 12 : 7) * particleScale), 5.5, 1.2, 3.6, 0.15, 0.35, 0.95, 0.16);
        if (event.kind === 'electric') this.shockwave(event.position.x, event.position.y, color, 22, 2, 0.18);
        shake = Math.max(shake, event.damage > 0 ? 3 : 1);
      } else if (event.type === 'zoneEntered') {
        const color = event.kind === 'ice' ? 0xbfeaff : event.kind === 'water' ? 0x5edcff : event.kind === 'lava' ? 0xff6b32 : event.kind === 'electric' ? 0xa3f4ff : 0xe1faff;
        this.shockwave(event.position.x, event.position.y, color, 18, 2, 0.18);
      } else if (event.type === 'blast') {
        const color = elementColor(event.element);
        const blastFeedback = resolveBlastFeedback(event, 'hero');
        const microMissile = blastFeedback.classification === 'micro-missile';
        const missileBarrage = blastFeedback.classification !== 'singular';
        const intensity = Math.min(microMissile ? 0.72 : missileBarrage ? 1.02 : 1.6, 0.55 + event.radius / 260 + event.force / 28);
        if (event.abilityId === 'flame-ring') {
          // Fire Vortex has a dark, rotating furnace look rather than a generic
          // water-like wave. The semantic blast is centered on the selected target.
          this.fireSpiral(event.position.x, event.position.y, Math.max(58, event.radius * 0.42), particleScale);
          this.flash(event.position.x, event.position.y, 0x5a120e, Math.max(24, event.radius * 0.2), 0.2);
          this.shockwave(event.position.x, event.position.y, 0xff4b20, Math.max(42, event.radius * 0.34), 6, 0.44);
          this.shockwave(event.position.x, event.position.y, 0xffd35a, Math.max(26, event.radius * 0.2), 2.5, 0.3);
          this.burst(event.position.x, event.position.y, 0xff7a2a, Math.round(24 * intensity * particleScale), 4.8, 1.4, 4.8, 0.22, 0.58, 0.97, 0.5);
          shake = Math.max(shake, 5.5);
          freezeMs = Math.max(freezeMs, 20);
          screenFlash = Math.max(screenFlash, 0.12);
        } else if (event.abilityId === 'molten-guard') {
          // Each consumed Burn target receives its own furnace-pop detonation.
          this.flash(event.position.x, event.position.y, 0xffffd0, Math.max(20, event.radius * 0.28), 0.13);
          this.flash(event.position.x, event.position.y, 0xff4a1f, Math.max(32, event.radius * 0.46), 0.2);
          this.shockwave(event.position.x, event.position.y, 0xffe56b, Math.max(30, event.radius * 0.42), 6, 0.34);
          this.shockwave(event.position.x, event.position.y, 0x8e1b13, Math.max(46, event.radius * 0.62), 3, 0.48);
          this.burst(event.position.x, event.position.y, 0xfff08a, Math.round(14 * intensity * particleScale), 10.5, 1.4, 4.2, 0.12, 0.32, 0.94, 0.28);
          this.burst(event.position.x, event.position.y, 0xff5425, Math.round(24 * intensity * particleScale), 8.2, 2.2, 6.4, 0.18, 0.48, 0.95, 0.52);
          shake = Math.max(shake, Math.min(14, 4 + event.force * 0.5));
          freezeMs = Math.max(freezeMs, Math.min(50, 14 + event.damage * 0.55));
          screenFlash = Math.max(screenFlash, 0.24);
        } else if (event.abilityId === 'inferno-collapse') {
          this.flash(event.position.x, event.position.y, 0xffffff, Math.max(58, event.radius * 0.3), 0.2);
          this.flash(event.position.x, event.position.y, 0xffa33a, Math.max(92, event.radius * 0.5), 0.32);
          this.fireSpiral(event.position.x, event.position.y, Math.max(105, event.radius * 0.56), particleScale * 1.35);
          this.shockwave(event.position.x, event.position.y, 0xfff09a, Math.max(74, event.radius * 0.42), 10, 0.52);
          this.shockwave(event.position.x, event.position.y, 0xff321e, Math.max(116, event.radius * 0.65), 7, 0.68);
          this.burst(event.position.x, event.position.y, 0xff5a27, Math.round(52 * intensity * particleScale), 12.5, 2.2, 7.4, 0.2, 0.68, 0.95, 0.72);
          shake = Math.max(shake, 16);
          freezeMs = Math.max(freezeMs, 52);
          screenFlash = Math.max(screenFlash, 0.5);
        } else if (event.kind === 'explosion') {
          this.flash(event.position.x, event.position.y, 0xfff1a8, Math.max(14, event.radius * (microMissile ? 0.14 : 0.22)), microMissile ? 0.08 : 0.15);
          this.burst(event.position.x, event.position.y, 0xffef79, Math.round((microMissile ? 5 : missileBarrage ? 10 : 18) * intensity * particleScale), 8 * intensity, 2, 5.2, 0.13, 0.3, 0.94, 0.25);
          this.burst(event.position.x, event.position.y, 0xff7a2b, Math.round((microMissile ? 7 : missileBarrage ? 15 : 28) * intensity * particleScale), 6.2 * intensity, 2.5, 6, 0.18, 0.42, 0.945, 0.38);
          if (!microMissile) this.burst(event.position.x, event.position.y, 0x4f5561, Math.round((missileBarrage ? 7 : 15) * intensity * particleScale), 3.1 * intensity, 5, 10, 0.3, 0.68, 0.975, 1.05);
          this.shockwave(event.position.x, event.position.y, 0xffa447, Math.max(24, event.radius * (microMissile ? 0.24 : 0.32)), microMissile ? 2.5 : 4, microMissile ? 0.2 : 0.36);
          if (!microMissile) this.shockwave(event.position.x, event.position.y, 0xfff1b0, Math.max(18, event.radius * 0.17), 2, 0.22);
          shake = Math.max(shake, blastFeedback.shake);
          freezeMs = Math.max(freezeMs, blastFeedback.freezeMs);
          screenFlash = Math.max(screenFlash, blastFeedback.screenFlash);
        } else {
          this.flash(event.position.x, event.position.y, 0xc8f8ff, Math.max(18, event.radius * 0.16), 0.12);
          this.burst(event.position.x, event.position.y, color, Math.round(28 * intensity * particleScale), 6.5 * intensity, 1.8, 4.5, 0.2, 0.5, 0.96, 0.2);
          this.burst(event.position.x, event.position.y, 0xc6f8ff, Math.round(12 * intensity * particleScale), 8.2 * intensity, 1.2, 3.2, 0.16, 0.38, 0.95, 0.1);
          this.shockwave(event.position.x, event.position.y, color, Math.max(40, event.radius * 0.36), 4, 0.42);
          this.shockwave(event.position.x, event.position.y, 0xcdf8ff, Math.max(24, event.radius * 0.22), 2, 0.28);
          shake = Math.max(shake, Math.min(13, 4 + event.force * 0.45));
          freezeMs = Math.max(freezeMs, Math.min(54, 18 + event.radius * 0.1));
          screenFlash = Math.max(screenFlash, 0.18);
        }
      } else if (event.type === 'weaponAttackStarted') {
        const attack = getPrimaryAttack(event.weaponId);
        const color = primaryAttackColor(attack);
        const nx = event.direction.x / (Math.hypot(event.direction.x, event.direction.y) || 1);
        const ny = event.direction.y / (Math.hypot(event.direction.x, event.direction.y) || 1);
        const projectileLike = isProjectileBehavior(attack.behavior);
        this.directionalBurst(
          event.position.x + nx * 18,
          event.position.y + ny * 18,
          nx,
          ny,
          color,
          Math.round((projectileLike ? 7 : 4) * particleScale),
          projectileLike ? 8 : 4
        );
      } else if (event.type === 'damage' && shouldPresentDamage(event)) {
        const color = elementColor(event.element);
        const radius = Math.min(24, 9 + event.amount * 0.38);
        this.flash(event.position?.x ?? 0, event.position?.y ?? 0, color, radius, 0.085);
        this.shardBurst(event.position?.x ?? 0, event.position?.y ?? 0, color, Math.round(Math.min(12, 3 + event.amount * 0.32) * particleScale), 3.8 + Math.min(4, event.amount * 0.12));
      } else if (event.type === 'weaponHit') {
        // weaponHit is emitted by both fighter primary attacks and skill-owned
        // projectiles. Resolving only the primary registry throws on the first
        // Tactical/Suppressive/Pinning/Kill Zone hit and stops the RAF loop.
        const attack = getAttackSource(event.weaponId);
        const color = primaryAttackColor(attack);
        if (event.presentation === 'continuous') {
          const count = Math.round(Math.min(5, 2 + event.damage * 0.25) * particleScale);
          this.shardBurst(event.position.x, event.position.y, color, count, 2.8 + event.knockback * 0.2);
          this.flash(event.position.x, event.position.y, color, Math.min(15, 7 + event.damage * 0.3), 0.045);
        } else {
          const count = Math.round(Math.min(24, 8 + event.damage * 0.55) * particleScale);
          this.shardBurst(event.position.x, event.position.y, color, count, 6 + event.knockback * 0.35);
          this.flash(event.position.x, event.position.y, color, Math.min(28, 12 + event.damage * 0.45), 0.1);
          shake = Math.max(shake, Math.min(8, event.damage * 0.22 + event.knockback * 0.25));
        }
        freezeMs = Math.max(freezeMs, resolveWeaponHitFreezeMs(event));
      } else if (event.type === 'projectileSpawned') {
        const attack = getProjectileSource(event.weaponId);
        const color = primaryAttackColor(attack);
        if (isProjectileBehavior(attack.behavior)) {
          this.flash(event.position.x, event.position.y, color, 12, 0.075);
          this.directionalBurst(event.position.x, event.position.y, -event.velocity.x, -event.velocity.y, color, Math.round(5 * particleScale), 5.5);
        } else {
          this.burst(event.position.x, event.position.y, color, Math.round(4 * particleScale), 2.8, 1, 2.5, 0.1, 0.22, 0.94, 0.08);
        }
      } else if (event.type === 'projectileImpact') {
        const attack = getProjectileSource(event.weaponId);
        const explosive = (attack.projectile?.explosionRadius ?? 0) > 0;
        if (!explosive && attack.id !== 'demolition-bomb') {
          const color = primaryAttackColor(attack);
          this.flash(event.position.x, event.position.y, color, 16, 0.09);
          this.shardBurst(event.position.x, event.position.y, color, Math.round(9 * particleScale), 5.2);
        }
      } else if (event.type === 'knockbackApplied') {
        const color = event.kind === 'explosion' ? 0xffb052 : 0xffffff;
        const nx = event.direction.x / (Math.hypot(event.direction.x, event.direction.y) || 1);
        const ny = event.direction.y / (Math.hypot(event.direction.x, event.direction.y) || 1);
        this.directionalBurst(event.position.x, event.position.y, nx, ny, color, Math.round(Math.min(12, 3 + event.force * 0.35) * particleScale), 3.5 + event.force * 0.22);
        if (event.force >= 8) this.shockwave(event.position.x, event.position.y, color, Math.min(42, 14 + event.force * 1.5), 2.5, 0.18);
      } else if (event.type === 'abilityActivated') {
        const recipe = getSkillPresentation(event.abilityId);
        const amount = recipe.importance === 'ultimate' ? 18 : recipe.importance === 'skill' ? 7 : 3;
        this.burst(event.position.x, event.position.y, recipe.color, Math.round(amount * particleScale), recipe.importance === 'ultimate' ? 4.8 : 2.8, 1, 3.2, 0.14, 0.3, 0.96, 0.08);
        if (recipe.importance === 'ultimate') this.shockwave(event.position.x, event.position.y, recipe.accentColor, 32, 2, 0.26);
      } else if (event.type === 'abilityResolved') {
        const recipe = getSkillPresentation(event.abilityId);
        this.skillResolve(event.position.x, event.position.y, event.direction.x, event.direction.y, recipe, particleScale);
        if (recipe.importance === 'ultimate') {
          const missileUltimate = isMissileCascadeAbility(event.abilityId);
          shake = Math.max(shake, missileUltimate ? 7 : recipe.resolve === 'mega-bomb' ? 18 : 14);
          freezeMs = Math.max(freezeMs, resolveUltimateFreezeMs(event, recipe.resolve));
          screenFlash = Math.max(screenFlash, missileUltimate ? 0.16 : recipe.resolve === 'mega-bomb' ? 0.68 : 0.38);
        }
      } else if (event.type === 'death') {
        this.flash(event.position.x, event.position.y, 0xffffff, 35, 0.16);
        this.burst(event.position.x, event.position.y, 0xffffff, Math.round(38 * particleScale), 10, 2, 5, 0.22, 0.52, 0.95, 0.4);
        this.shockwave(event.position.x, event.position.y, 0xffffff, 80, 4, 0.42);
        shake = Math.max(shake, 13);
        freezeMs = Math.max(freezeMs, missileCascadeFrame ? 8 : 55);
        screenFlash = Math.max(screenFlash, 0.35);
      }
    }
    return { shake, freezeMs, screenFlash };
  }

  update(dtSeconds: number): void {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= dtSeconds;
      if (particle.life <= 0) {
        particle.active = false;
        particle.node.visible = false;
        continue;
      }
      particle.node.x += particle.vx * dtSeconds * 60;
      particle.node.y += particle.vy * dtSeconds * 60;
      particle.vx *= particle.drag;
      particle.vy *= particle.drag;
      const ratio = particle.life / particle.maxLife;
      particle.node.alpha = ratio;
      particle.node.scale.set(0.55 + ratio * 0.55 + (1 - ratio) * particle.growth);
    }

    for (const wave of this.shockwaves) {
      if (!wave.active) continue;
      wave.life -= dtSeconds;
      if (wave.life <= 0) {
        wave.active = false;
        wave.node.visible = false;
        continue;
      }
      const progress = 1 - wave.life / wave.maxLife;
      wave.node.scale.set(0.55 + progress * 3.1);
      wave.node.alpha = (1 - progress) * 0.72;
    }

    for (const flash of this.flashes) {
      if (!flash.active) continue;
      flash.life -= dtSeconds;
      if (flash.life <= 0) {
        flash.active = false;
        flash.node.visible = false;
        continue;
      }
      const progress = 1 - flash.life / flash.maxLife;
      flash.node.scale.set(0.65 + progress * 1.85);
      flash.node.alpha = (1 - progress) * 0.78;
    }
  }

  skillResolve(x: number, y: number, dirX: number, dirY: number, recipe: SkillPresentationRecipe, particleScale: number): void {
    const amount = recipe.importance === 'ultimate' ? 34 : recipe.importance === 'skill' ? 18 : 9;
    const speed = recipe.importance === 'ultimate' ? 9 : 5.8;
    switch (recipe.resolve) {
      case 'water-splash':
        this.burst(x, y, recipe.color, Math.round(amount * particleScale), speed, 1.2, 4.2, 0.14, 0.38, 0.95, 0.12);
        this.shockwave(x, y, recipe.accentColor, 22, 2, 0.2);
        break;
      case 'water-dash':
        this.directionalBurst(x, y, -dirX, -dirY, recipe.color, Math.round(amount * particleScale), 7.5);
        this.shockwave(x, y, recipe.accentColor, 28, 2, 0.22);
        break;
      case 'pressure-wave':
        this.shockwave(x, y, recipe.color, 54, 5, 0.34);
        this.shockwave(x, y, recipe.accentColor, 34, 2, 0.22);
        this.burst(x, y, recipe.color, Math.round(amount * particleScale), 6.5, 1.4, 4, 0.18, 0.46, 0.96, 0.2);
        break;
      case 'undertow':
        this.flash(x, y, 0x0a3e72, 34, 0.2);
        this.shockwave(x, y, recipe.color, 72, 5, 0.44);
        this.shockwave(x, y, recipe.accentColor, 42, 2, 0.31);
        this.burst(x, y, recipe.accentColor, Math.round(amount * particleScale), 4.4, 1, 3.5, 0.2, 0.55, 0.97, 0.55);
        break;
      case 'tidal-cataclysm':
        this.flash(x, y, 0xeaffff, 74, 0.22);
        this.shockwave(x, y, recipe.color, 105, 8, 0.52);
        this.shockwave(x, y, recipe.accentColor, 76, 3, 0.4);
        this.shockwave(x, y, 0x1f87d6, 48, 5, 0.3);
        this.burst(x, y, recipe.color, Math.round(amount * 1.4 * particleScale), 11, 1.5, 5.2, 0.2, 0.6, 0.95, 0.35);
        break;
      case 'contact-pop':
        this.flash(x, y, recipe.accentColor, 22, 0.11);
        this.burst(x, y, recipe.color, Math.round(amount * particleScale), 8, 1.2, 3.7, 0.12, 0.28, 0.94, 0.12);
        break;
      case 'rocket-burst':
        this.directionalBurst(x, y, -dirX, -dirY, recipe.color, Math.round(amount * particleScale), 10);
        this.flash(x, y, recipe.accentColor, 24, 0.12);
        break;
      case 'concussion':
        this.flash(x, y, recipe.accentColor, 38, 0.15);
        this.shockwave(x, y, recipe.color, 62, 7, 0.36);
        this.shockwave(x, y, recipe.accentColor, 38, 2, 0.22);
        break;
      case 'shrapnel':
        this.shardBurst(x, y, recipe.color, Math.round(amount * 1.5 * particleScale), 10.5);
        this.shockwave(x, y, recipe.accentColor, 55, 3, 0.3);
        break;
      case 'mega-bomb':
        this.flash(x, y, 0xffffff, 100, 0.24);
        this.flash(x, y, recipe.accentColor, 62, 0.3);
        this.shockwave(x, y, recipe.color, 120, 10, 0.62);
        this.shockwave(x, y, recipe.accentColor, 88, 4, 0.5);
        this.shockwave(x, y, 0xffffff, 48, 2, 0.32);
        this.shardBurst(x, y, recipe.color, Math.round(amount * 2 * particleScale), 13);
        break;
      case 'magma-dash':
        this.directionalBurst(x, y, -dirX, -dirY, 0xff542d, Math.round(amount * 1.4 * particleScale), 11);
        this.flash(x, y, recipe.accentColor, 30, 0.14);
        this.shockwave(x, y, recipe.color, 36, 3, 0.24);
        break;
      case 'inferno-collapse':
        this.flash(x, y, 0xfff1a0, 92, 0.22);
        this.shockwave(x, y, 0xff3c20, 112, 9, 0.56);
        this.shockwave(x, y, 0xffd250, 74, 4, 0.4);
        this.burst(x, y, 0xff5b2d, Math.round(amount * 1.8 * particleScale), 12, 2, 6, 0.2, 0.62, 0.94, 0.48);
        break;
      case 'cinder-rush':
        this.directionalBurst(x, y, -dirX, -dirY, 0xfff095, Math.round(amount * 0.75 * particleScale), 13.5);
        this.directionalBurst(x, y, -dirX, -dirY, 0xff5423, Math.round(amount * 1.8 * particleScale), 10.5);
        this.flash(x, y, 0xff9b3a, 42, 0.16);
        this.shockwave(x, y, 0xff4b22, 48, 4, 0.28);
        break;
      case 'fire-vortex':
        this.fireSpiral(x, y, 72, particleScale);
        this.flash(x, y, 0x5a120d, 46, 0.2);
        this.shockwave(x, y, 0xff3d1d, 72, 5, 0.42);
        this.shockwave(x, y, 0xffdc6b, 42, 2, 0.27);
        break;
      case 'combustion':
        this.flash(x, y, 0xffffff, 54, 0.14);
        this.flash(x, y, 0xff5a22, 78, 0.24);
        this.shockwave(x, y, 0xffef83, 86, 8, 0.4);
        this.shockwave(x, y, 0x9b1e13, 112, 4, 0.58);
        this.burst(x, y, 0xffbd4d, Math.round(amount * 1.8 * particleScale), 11, 1.8, 6, 0.16, 0.48, 0.94, 0.56);
        break;
      case 'meltdown':
        this.flash(x, y, 0xffffff, 108, 0.25);
        this.flash(x, y, 0xff7b2e, 148, 0.38);
        this.fireSpiral(x, y, 132, particleScale * 1.5);
        this.shockwave(x, y, 0xffffa8, 122, 11, 0.62);
        this.shockwave(x, y, 0xff2e1a, 174, 8, 0.82);
        this.burst(x, y, 0xff4a21, Math.round(amount * 2.3 * particleScale), 14, 2.5, 8, 0.22, 0.76, 0.94, 0.9);
        break;
      case 'kinetic-pulse':
        this.flash(x, y, 0xeaffff, 48, 0.13);
        this.shockwave(x, y, recipe.color, 82, 8, 0.42);
        this.shockwave(x, y, recipe.accentColor, 52, 3, 0.29);
        this.shardBurst(x, y, 0x9beaff, Math.round(amount * particleScale), 7.5);
        break;
      case 'reactor-overdrive':
        this.flash(x, y, 0xffffff, 64, 0.18);
        this.shockwave(x, y, recipe.color, 70, 6, 0.4);
        this.shockwave(x, y, 0xffffff, 42, 2, 0.25);
        this.burst(x, y, recipe.color, Math.round(amount * 1.25 * particleScale), 7.5, 1.5, 4.5, 0.2, 0.55, 0.96, 0.2);
        break;
      case 'mass-bloom':
        this.flash(x, y, 0xe9fbff, 42, 0.13);
        this.shockwave(x, y, recipe.accentColor, 86, 3, 0.46);
        this.shockwave(x, y, recipe.color, 58, 5, 0.34);
        this.burst(x, y, 0xd8c7ff, Math.round(amount * 0.85 * particleScale), 3.8, 1, 3.4, 0.22, 0.62, 0.98, 0.5);
        break;
      case 'downbeat-punt':
        this.flash(x, y, 0xf4fdff, 38, 0.12);
        this.directionalBurst(x, y, dirX, dirY, recipe.accentColor, Math.round(amount * 1.35 * particleScale), 12.5);
        this.directionalBurst(x, y, dirX, dirY, recipe.color, Math.round(amount * 0.8 * particleScale), 8.5);
        this.shockwave(x, y, recipe.color, 64, 7, 0.28);
        break;
      case 'anchor-drop':
        this.flash(x, y, 0xeaffff, 46, 0.14);
        this.shockwave(x, y, 0x2d203a, 86, 10, 0.48);
        this.shockwave(x, y, recipe.accentColor, 58, 4, 0.34);
        this.shardBurst(x, y, 0xbcefff, Math.round(amount * 0.8 * particleScale), 5.5);
        break;
      case 'last-call':
        this.flash(x, y, 0xffffff, 112, 0.22);
        this.flash(x, y, recipe.color, 156, 0.34);
        this.shockwave(x, y, 0x28172f, 188, 12, 0.78);
        this.shockwave(x, y, recipe.accentColor, 132, 6, 0.6);
        this.shockwave(x, y, 0xa88cdd, 82, 3, 0.42);
        this.burst(x, y, 0xd8faff, Math.round(amount * 1.6 * particleScale), 10.5, 1.5, 5, 0.2, 0.68, 0.96, 0.72);
        this.burst(x, y, 0x5d3a79, Math.round(amount * 1.25 * particleScale), 7.2, 2.5, 7, 0.26, 0.78, 0.97, 0.9);
        break;
      case 'solar-laser':
        // The sustained beam is rendered from the live casting snapshot so it
        // stays attached to the Sentinel and tracks its target. Resolution only
        // adds a compact release flare instead of leaving a detached static beam.
        this.flash(x, y, 0xfff5cf, 46, 0.16);
        this.directionalBurst(x, y, -dirX, -dirY, 0xffd46a, Math.round(20 * particleScale), 8.5);
        this.shockwave(x, y, 0xffdd7a, 54, 3, 0.18);
        break;
      default:
        this.burst(x, y, recipe.color, Math.round(amount * particleScale), speed, 1.2, 4.2, 0.14, 0.38, 0.95, 0.12);
        this.shockwave(x, y, recipe.accentColor, 34, 2, 0.24);
    }
  }

  reset(): void {
    for (const particle of this.particles) { particle.active = false; particle.node.visible = false; }
    for (const wave of this.shockwaves) { wave.active = false; wave.node.visible = false; }
    for (const flash of this.flashes) { flash.active = false; flash.node.visible = false; }
  }

  activeParticleCount(): number {
    return this.particles.reduce((count, particle) => count + (particle.active ? 1 : 0), 0);
  }

  private laserBeam(x: number, y: number, dirX: number, dirY: number, length: number): void {
    const flash = this.flashes.find((item) => !item.active);
    if (!flash) return;
    const magnitude = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / magnitude;
    const ny = dirY / magnitude;
    const px = -ny;
    const py = nx;
    const eyeOffset = 8;
    flash.active = true;
    flash.life = flash.maxLife = 5.15;
    flash.node.clear();
    // left eye beam
    flash.node.moveTo(px * eyeOffset, py * eyeOffset).lineTo(px * eyeOffset + nx * length, py * eyeOffset + ny * length).stroke({ color: 0xff2f26, width: 22, alpha: 0.16 });
    flash.node.moveTo(px * eyeOffset, py * eyeOffset).lineTo(px * eyeOffset + nx * length, py * eyeOffset + ny * length).stroke({ color: 0xff7258, width: 10, alpha: 0.78 });
    flash.node.moveTo(px * eyeOffset, py * eyeOffset).lineTo(px * eyeOffset + nx * length, py * eyeOffset + ny * length).stroke({ color: 0xfff7dc, width: 3.5, alpha: 1 });
    // right eye beam
    flash.node.moveTo(-px * eyeOffset, -py * eyeOffset).lineTo(-px * eyeOffset + nx * length, -py * eyeOffset + ny * length).stroke({ color: 0xff2f26, width: 22, alpha: 0.16 });
    flash.node.moveTo(-px * eyeOffset, -py * eyeOffset).lineTo(-px * eyeOffset + nx * length, -py * eyeOffset + ny * length).stroke({ color: 0xff7258, width: 10, alpha: 0.78 });
    flash.node.moveTo(-px * eyeOffset, -py * eyeOffset).lineTo(-px * eyeOffset + nx * length, -py * eyeOffset + ny * length).stroke({ color: 0xfff7dc, width: 3.5, alpha: 1 });
    flash.node.circle(px * eyeOffset, py * eyeOffset, 5).fill({ color: 0xffffff, alpha: 0.95 });
    flash.node.circle(-px * eyeOffset, -py * eyeOffset, 5).fill({ color: 0xffffff, alpha: 0.95 });
    flash.node.circle(0, 0, 18).stroke({ color: 0xffdb87, width: 2, alpha: 0.3 });
    flash.node.x = x;
    flash.node.y = y;
    flash.node.scale.set(1);
    flash.node.alpha = 1;
    flash.node.visible = true;
  }

  private burst(
    x: number,
    y: number,
    color: number,
    count: number,
    speed: number,
    minSize: number,
    maxSize: number,
    minLife: number,
    maxLife: number,
    drag: number,
    growth: number
  ): void {
    let created = 0;
    for (const particle of this.particles) {
      if (particle.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.35 + Math.random() * 0.8);
      const size = minSize + Math.random() * Math.max(0.1, maxSize - minSize);
      particle.active = true;
      particle.life = particle.maxLife = minLife + Math.random() * Math.max(0.01, maxLife - minLife);
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.drag = drag;
      particle.growth = growth;
      particle.node.clear().circle(0, 0, size).fill({ color, alpha: 1 });
      particle.node.x = x;
      particle.node.y = y;
      particle.node.alpha = 1;
      particle.node.scale.set(1);
      particle.node.visible = true;
      created += 1;
      if (created >= count) break;
    }
  }

  private directionalBurst(x: number, y: number, dirX: number, dirY: number, color: number, count: number, speed: number): void {
    const length = Math.hypot(dirX, dirY) || 1;
    const base = Math.atan2(dirY / length, dirX / length);
    let created = 0;
    for (const particle of this.particles) {
      if (particle.active) continue;
      const angle = base + (Math.random() - 0.5) * 0.9;
      const velocity = speed * (0.45 + Math.random() * 0.7);
      particle.active = true;
      particle.life = particle.maxLife = 0.18 + Math.random() * 0.28;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.drag = 0.95;
      particle.growth = 0.12;
      particle.node.clear().circle(0, 0, 1.5 + Math.random() * 3.5).fill({ color, alpha: 1 });
      particle.node.x = x;
      particle.node.y = y;
      particle.node.alpha = 1;
      particle.node.scale.set(1);
      particle.node.visible = true;
      if (++created >= count) break;
    }
  }

  private shardBurst(x: number, y: number, color: number, count: number, speed: number): void {
    let created = 0;
    for (const particle of this.particles) {
      if (particle.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.55 + Math.random() * 0.7);
      particle.active = true;
      particle.life = particle.maxLife = 0.22 + Math.random() * 0.36;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.drag = 0.955;
      particle.growth = 0.05;
      particle.node.clear().rect(-1.2, -5, 2.4, 10).fill({ color, alpha: 1 });
      particle.node.rotation = angle + Math.PI / 2;
      particle.node.x = x;
      particle.node.y = y;
      particle.node.alpha = 1;
      particle.node.scale.set(1);
      particle.node.visible = true;
      if (++created >= count) break;
    }
  }

  private fireSpiral(x: number, y: number, radius: number, particleScale: number): void {
    const flash = this.flashes.find((item) => !item.active);
    if (flash) {
      flash.active = true;
      flash.life = flash.maxLife = 0.52;
      flash.node.clear();
      const arms = 4;
      for (let arm = 0; arm < arms; arm += 1) {
        const phase = arm / arms * Math.PI * 2;
        for (let step = 0; step < 8; step += 1) {
          const progress = step / 7;
          const angle = phase + progress * Math.PI * 1.45;
          const inner = radius * (0.18 + progress * 0.74);
          const nextProgress = Math.min(1, (step + 1) / 7);
          const nextAngle = phase + nextProgress * Math.PI * 1.45;
          const nextInner = radius * (0.18 + nextProgress * 0.74);
          flash.node
            .moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
            .lineTo(Math.cos(nextAngle) * nextInner, Math.sin(nextAngle) * nextInner)
            .stroke({
              color: arm % 2 === 0 ? 0xff5a24 : 0xffd45d,
              width: Math.max(2, radius * (0.055 - progress * 0.025)),
              alpha: 0.72 - progress * 0.32
            });
        }
      }
      flash.node.circle(0, 0, radius * 0.16).fill({ color: 0x3b0b09, alpha: 0.78 });
      flash.node.circle(0, 0, radius * 0.11).stroke({ color: 0xffffa2, width: 3, alpha: 0.9 });
      flash.node.x = x;
      flash.node.y = y;
      flash.node.scale.set(0.55);
      flash.node.alpha = 0.9;
      flash.node.visible = true;
    }
    this.burst(x, y, 0xff7a2a, Math.round(18 * particleScale), 5.2, 1.2, 4.6, 0.18, 0.54, 0.97, 0.5);
  }

  private shockwave(x: number, y: number, color: number, radius: number, width: number, life: number): void {
    const wave = this.shockwaves.find((item) => !item.active);
    if (!wave) return;
    wave.active = true;
    wave.life = wave.maxLife = life;
    wave.node.clear().circle(0, 0, radius).stroke({ color, width, alpha: 0.8 });
    wave.node.x = x;
    wave.node.y = y;
    wave.node.scale.set(0.55);
    wave.node.alpha = 0.8;
    wave.node.visible = true;
  }

  private flash(x: number, y: number, color: number, radius: number, life: number): void {
    const flash = this.flashes.find((item) => !item.active);
    if (!flash) return;
    flash.active = true;
    flash.life = flash.maxLife = life;
    flash.node.clear().circle(0, 0, radius).fill({ color, alpha: 0.72 });
    flash.node.x = x;
    flash.node.y = y;
    flash.node.scale.set(0.65);
    flash.node.alpha = 0.72;
    flash.node.visible = true;
  }
}


export function resolveCrowdFxResponse(events: readonly SimulationEvent[]): FxResponse {
  const missileCascadeFrame = isMissileCascadeFrame(events);
  let shake = 0;
  let freezeMs = 0;
  let screenFlash = 0;
  for (const event of events) {
    if (event.type === 'death') {
      shake = Math.max(shake, 7);
      freezeMs = Math.max(freezeMs, missileCascadeFrame ? 5 : 18);
      screenFlash = Math.max(screenFlash, missileCascadeFrame ? 0.06 : 0.12);
    } else if (event.type === 'blast') {
      const blastFeedback = resolveBlastFeedback(event, 'crowd');
      shake = Math.max(shake, blastFeedback.shake);
      freezeMs = Math.max(freezeMs, blastFeedback.freezeMs);
      screenFlash = Math.max(screenFlash, blastFeedback.screenFlash);
    } else if (event.type === 'obstacleDestroyed') {
      shake = Math.max(shake, 6);
      freezeMs = Math.max(freezeMs, 14);
    } else if (event.type === 'weaponHit' && event.damage >= 18) {
      shake = Math.max(shake, 2.5);
    } else if (event.type === 'abilityResolved' && event.slot === 'ultimate') {
      const missileUltimate = isMissileCascadeAbility(event.abilityId);
      shake = Math.max(shake, missileUltimate ? 4 : 7);
      if (!missileUltimate) freezeMs = Math.max(freezeMs, 18);
      screenFlash = Math.max(screenFlash, missileUltimate ? 0.07 : 0.13);
    }
  }
  return { shake, freezeMs, screenFlash };
}
