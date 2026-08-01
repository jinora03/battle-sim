import { Application, Container, Graphics, Point, Text } from 'pixi.js';
import { calculateArenaFit, calculateCameraTarget } from './camera';
import { classifyBlast, compactMissilePresentationEvents, compactMissileSecondaryPresentationEvents, isMissileCascadeAbility, isMissileCascadeFrame, isMissileWeapon, MissileCascadeTracker, resolveBlastFeedback, resolveUltimateFreezeMs, resolveWeaponHitFreezeMs, shouldPresentDamage } from './combatFeedback';
import { LayeredVfxEngine } from './layeredVfx';
import { budgetPresentationEvents, resolveMassBattleRenderPolicy, selectProjectileVisuals } from './massBattlePolicy';
export * from './massBattlePolicy';
import { evaluatePlayerAim, resolvePlayerTargetingPreview } from './playerTargeting';
import { getAbility, getAbilityActivationProfile, getArena, getFighter, getPrimaryAttack, getProjectileSource, type ArenaDefinition, type PrimaryAttackDefinition } from '@kinetic/content';
import type { AbilitySlot, EntityId, EntitySnapshot, ProjectileSnapshot, SimulationEvent, Vec2, WorldSnapshot } from '@kinetic/protocol';
import { resolveCanvasResolution } from '@kinetic/platform';
import {
  computeMotionPose,
  elementColor,
  getMotionRecipe,
  getRenderProfile,
  getSkillPresentation,
  getVisualRecipe,
  resolveImpactResponse,
  resolveVfxQuality,
  type MotionRecipe,
  type PresentationSettings,
  type SkillPresentationRecipe,
  type VisualRecipe
} from '@kinetic/visual-engine';


export type VisualLod = 'hero' | 'standard' | 'army';
export interface RenderDiagnostics {
  lod: VisualLod;
  fighterViews: number;
  pooledFighterViews: number;
  createdFighterViews: number;
  reusedFighterViews: number;
  particleScale: number;
  activeParticles: number;
  vfxQuality: 'low' | 'medium' | 'high';
  groundMarks: number;
  residualParticles: number;
  weaponEffects: number;
  projectileTrails: number;
  qualityScale: number;
  resolution: number;
  devicePixelRatio: number;
  renderScale: number;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  orientation: 'portrait' | 'landscape';
  resizeCount: number;
  contextLost: boolean;
  renderTier: 'full' | 'crowd' | 'mass';
  targetRenderFps: number;
  presentationEvents: number;
  projectileVisuals: number;
}

export interface TrainingDebugOptions {
  enabled: boolean;
  focusEntityId: EntityId | null;
  selectedSlot: AbilitySlot;
  showRange: boolean;
  showHitboxes: boolean;
  showProjectilePaths: boolean;
  showDamageNumbers: boolean;
}

interface FloatingCombatTextState {
  node: Text;
  life: number;
  maxLife: number;
  rise: number;
}

interface KnockbackTrailState {
  life: number;
  maxLife: number;
  strength: number;
}

const DEFAULT_TRAINING_DEBUG: TrainingDebugOptions = {
  enabled: false,
  focusEntityId: null,
  selectedSlot: 'basic',
  showRange: false,
  showHitboxes: false,
  showProjectilePaths: false,
  showDamageNumbers: false
};

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

interface FxResponse {
  shake: number;
  freezeMs: number;
  screenFlash: number;
}

class FxEngine {
  private readonly particles: ParticleState[] = [];
  private readonly shockwaves: ShockwaveState[] = [];
  private readonly flashes: FlashState[] = [];

  constructor(private readonly container: Container) {
    for (let i = 0; i < 420; i += 1) {
      const node = new Graphics();
      node.visible = false;
      container.addChild(node);
      this.particles.push({ node, active: false, vx: 0, vy: 0, life: 0, maxLife: 1, drag: 0.96, growth: 0 });
    }
    for (let i = 0; i < 28; i += 1) {
      const node = new Graphics();
      node.visible = false;
      container.addChild(node);
      this.shockwaves.push({ node, active: false, life: 0, maxLife: 1 });
    }
    for (let i = 0; i < 14; i += 1) {
      const node = new Graphics();
      node.visible = false;
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
        if (event.kind === 'explosion') {
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
        const attack = getPrimaryAttack(event.weaponId);
        const color = primaryAttackColor(attack);
        const count = Math.round(Math.min(24, 8 + event.damage * 0.55) * particleScale);
        this.shardBurst(event.position.x, event.position.y, color, count, 6 + event.knockback * 0.35);
        this.flash(event.position.x, event.position.y, color, Math.min(28, 12 + event.damage * 0.45), 0.1);
        shake = Math.max(shake, Math.min(8, event.damage * 0.22 + event.knockback * 0.25));
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


function resolveCrowdFxResponse(events: readonly SimulationEvent[]): FxResponse {
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

class SkillTelegraphRenderer {
  readonly container = new Container();
  private readonly graphics = new Graphics();
  private readonly labels = new Map<EntityId, Text>();

  constructor() {
    this.container.addChild(this.graphics);
  }

  render(snapshot: WorldSnapshot, elapsedSeconds: number, enabled: boolean): void {
    this.graphics.clear();
    const castingIds = new Set<EntityId>();
    if (!enabled) {
      for (const label of this.labels.values()) label.visible = false;
      return;
    }

    const crowd = snapshot.entities.length > 40;
    const massCrowd = snapshot.entities.length > 64;
    const castingEntities = snapshot.entities
      .flatMap((entity) => {
        const cast = entity.abilities.find((ability) => ability.source === 'ability' && ability.phase === 'casting');
        return cast ? [{ entity, cast, recipe: getSkillPresentation(cast.abilityId) }] : [];
      })
      .filter((item) => !crowd
        || item.entity.controller === 'player'
        || (massCrowd ? item.recipe.importance === 'ultimate' : item.recipe.importance !== 'basic'))
      .sort((a, b) => Number(b.entity.controller === 'player') - Number(a.entity.controller === 'player')
        || (b.recipe.importance === 'ultimate' ? 2 : b.recipe.importance === 'skill' ? 1 : 0) - (a.recipe.importance === 'ultimate' ? 2 : a.recipe.importance === 'skill' ? 1 : 0)
        || a.entity.id - b.entity.id)
      .slice(0, massCrowd ? 3 : crowd ? 6 : snapshot.entities.length > 20 ? 14 : 999);

    for (const { entity, cast, recipe } of castingEntities) {
      castingIds.add(entity.id);
      const progress = cast.castTotalTicks > 0 ? 1 - cast.castRemainingTicks / cast.castTotalTicks : 1;
      const pulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * (recipe.importance === 'ultimate' ? 14 : 9));
      this.drawTelegraph(entity, recipe, progress, pulse, cast.castDirection);
      const label = this.labels.get(entity.id) ?? this.createLabel(entity.id);
      label.visible = true;
      label.text = `${recipe.importance === 'ultimate' ? 'ULT · ' : ''}${recipe.shortName}`;
      label.style.fill = recipe.accentColor;
      label.x = entity.x;
      label.y = entity.y - entity.radius - 42;
      label.anchor.set(0.5);
      label.alpha = 0.82 + pulse * 0.18;
    }

    for (const [id, label] of this.labels) if (!castingIds.has(id)) label.visible = false;
  }

  reset(): void {
    this.graphics.clear();
    for (const label of this.labels.values()) label.visible = false;
  }

  destroy(): void {
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear();
    this.container.destroy({ children: true });
  }

  private createLabel(id: EntityId): Text {
    const label = new Text({
      text: '',
      style: { fill: 0xffffff, fontSize: 13, fontWeight: '800', fontFamily: 'Inter, system-ui', stroke: { color: 0x07101b, width: 4 } }
    });
    this.labels.set(id, label);
    this.container.addChild(label);
    return label;
  }

  private drawTelegraph(entity: EntitySnapshot, recipe: SkillPresentationRecipe, progress: number, pulse: number, castDirection: Vec2 | null): void {
    const x = entity.x;
    const y = entity.y;
    const radius = recipe.telegraphRadius;
    const angle = castDirection ? Math.atan2(castDirection.y, castDirection.x) : entity.rotation;
    const alpha = 0.22 + pulse * 0.24;

    switch (recipe.telegraph) {
      case 'directional-stream': {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        if (recipe.abilityId === 'solar-laser') {
          const px = -dy;
          const py = dx;
          const eyeOffset = Math.max(10, entity.radius * 0.34);
          const forwardOffset = Math.max(7, entity.radius * 0.26);
          const leftEyeX = x + dx * forwardOffset + px * eyeOffset;
          const leftEyeY = y + dy * forwardOffset + py * eyeOffset;
          const rightEyeX = x + dx * forwardOffset - px * eyeOffset;
          const rightEyeY = y + dy * forwardOffset - py * eyeOffset;
          const castTicks = Math.max(1, getAbility(recipe.abilityId).castTicks);
          const elapsedTicks = progress * castTicks;
          const elapsedSeconds = elapsedTicks / 60;
          const eyeChargeEnd = 30;
          const beamStart = 48;
          const eyeChargeProgress = Math.min(1, elapsedTicks / eyeChargeEnd);
          const lockProgress = Math.min(1, Math.max(0, elapsedTicks - eyeChargeEnd) / Math.max(1, beamStart - eyeChargeEnd));
          const beamProgress = Math.min(1, Math.max(0, elapsedTicks - beamStart) / 18);
          const eyePulse = 0.76 + pulse * 0.24;
          const chargePulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * 22);
          const glowRadius = 10 + eyeChargeProgress * 13 + chargePulse * 3.5;
          const eyePairs = [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]] as const;

          // Stage 1: two unmistakable red eye cores charge above the fighter.
          // A dark backing disc prevents the body/core colors from washing them out.
          this.graphics.circle(x + dx * forwardOffset, y + dy * forwardOffset, entity.radius * 0.68)
            .fill({ color: 0x090509, alpha: 0.20 + eyeChargeProgress * 0.12 });
          this.graphics.moveTo(leftEyeX, leftEyeY).lineTo(rightEyeX, rightEyeY)
            .stroke({ color: 0xff6f59, width: 1.3, alpha: 0.16 + eyeChargeProgress * 0.22 });

          for (let eyeIndex = 0; eyeIndex < eyePairs.length; eyeIndex += 1) {
            const [eyeX, eyeY] = eyePairs[eyeIndex]!;
            this.graphics.circle(eyeX, eyeY, glowRadius + 11).fill({ color: 0xff1714, alpha: 0.12 + eyeChargeProgress * 0.16 });
            this.graphics.circle(eyeX, eyeY, glowRadius + 4).fill({ color: 0xff3028, alpha: 0.26 + eyeChargeProgress * 0.30 });
            this.graphics.circle(eyeX, eyeY, 7 + eyeChargeProgress * 3.2).fill({ color: 0xff2d24, alpha: 1 });
            this.graphics.circle(eyeX, eyeY, 3.4 + eyeChargeProgress * 1.8).fill({ color: 0xffd6c7, alpha: eyePulse });
            this.graphics.circle(eyeX, eyeY, 1.6 + chargePulse * 0.8).fill({ color: 0xffffff, alpha: 0.98 });
            this.graphics.circle(eyeX, eyeY, glowRadius + 3).stroke({ color: 0xffa18b, width: 2.2, alpha: 0.24 + eyeChargeProgress * 0.34 });
            this.graphics.moveTo(eyeX - px * (8 + eyeChargeProgress * 5), eyeY - py * (8 + eyeChargeProgress * 5))
              .lineTo(eyeX + px * (8 + eyeChargeProgress * 5), eyeY + py * (8 + eyeChargeProgress * 5))
              .stroke({ color: 0xffe0d6, width: 1.2, alpha: 0.18 + chargePulse * 0.28 });

            for (let spark = 0; spark < 3; spark += 1) {
              const sparkPhase = (eyeChargeProgress + spark / 3 + eyeIndex * 0.16) % 1;
              const sparkAngle = elapsedSeconds * (eyeIndex === 0 ? 5.8 : -5.8) + spark * Math.PI * 2 / 3;
              const sparkRadius = 28 - sparkPhase * 14;
              this.graphics.circle(
                eyeX + Math.cos(sparkAngle) * sparkRadius,
                eyeY + Math.sin(sparkAngle) * sparkRadius,
                1.5 + sparkPhase * 1.6
              ).fill({ color: spark % 2 === 0 ? 0xff6a52 : 0xffd5c6, alpha: 0.20 + sparkPhase * 0.52 });
            }
          }
          this.graphics.circle(x, y, entity.radius * (1.14 + chargePulse * 0.04)).stroke({ color: 0xff6f52, width: 2.5, alpha: 0.20 + eyeChargeProgress * 0.26 });

          // Stage 2: a thin lock line appears, but it still deals no damage.
          if (elapsedTicks >= eyeChargeEnd && elapsedTicks < beamStart) {
            const lockLength = 80 + lockProgress * 300;
            const lockEndX = x + dx * lockLength;
            const lockEndY = y + dy * lockLength;
            for (const [eyeX, eyeY] of [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]] as const) {
              this.graphics.moveTo(eyeX, eyeY).lineTo(lockEndX, lockEndY).stroke({ color: 0xff705b, width: 3, alpha: 0.28 + lockProgress * 0.36 });
            }
            this.graphics.circle(lockEndX, lockEndY, 6 + pulse * 2.5).stroke({ color: 0xffb39d, width: 2, alpha: 0.34 + lockProgress * 0.34 });
          }

          // Stage 3: the full beam is live. Gameplay damage begins at the same tick.
          if (elapsedTicks >= beamStart) {
            const length = 1080;
            const endX = x + dx * length;
            const endY = y + dy * length;
            const activeTicks = elapsedTicks - beamStart;
            const ramp = activeTicks < 54 ? 0 : activeTicks < 108 ? 1 : 2;
            const outerWidth = 18 + ramp * 5 + pulse * 3;
            const middleWidth = 8 + ramp * 2;
            const coreWidth = 2.8 + ramp * 0.8;
            const beamAlpha = 0.58 + beamProgress * 0.32;

            for (const [eyeX, eyeY] of [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]] as const) {
              this.graphics.moveTo(eyeX, eyeY).lineTo(endX, endY).stroke({ color: 0xff3028, width: outerWidth, alpha: 0.13 + ramp * 0.025 });
              this.graphics.moveTo(eyeX, eyeY).lineTo(endX, endY).stroke({ color: 0xff7258, width: middleWidth, alpha: beamAlpha });
              this.graphics.moveTo(eyeX, eyeY).lineTo(endX, endY).stroke({ color: 0xfff7dc, width: coreWidth, alpha: 0.98 });
            }
            this.graphics.circle(endX, endY, 10 + ramp * 4 + pulse * 3).fill({ color: 0xffc66c, alpha: 0.22 });
          }
          break;
        }
        const length = 70 + progress * 70;
        this.graphics.moveTo(x - dx * 24, y - dy * 24).lineTo(x + dx * length, y + dy * length)
          .stroke({ color: recipe.color, width: 7, alpha: 0.22 + pulse * 0.15 });
        this.graphics.circle(x, y, entity.radius * (1.12 + pulse * 0.08)).stroke({ color: recipe.accentColor, width: 3, alpha });
        break;
      }
      case 'outward-rings':
        for (let i = 0; i < 3; i += 1) {
          const ringProgress = (progress + i * 0.22) % 1;
          this.graphics.circle(x, y, 28 + ringProgress * radius).stroke({ color: i === 1 ? recipe.accentColor : recipe.color, width: 4 - i * 0.7, alpha: (1 - ringProgress) * 0.52 });
        }
        break;
      case 'inward-vortex':
        for (let i = 0; i < 4; i += 1) {
          const ringProgress = (progress + i * 0.18) % 1;
          const r = radius * (1 - ringProgress * 0.78);
          this.graphics.circle(x, y, Math.max(30, r)).stroke({ color: i % 2 ? recipe.accentColor : recipe.color, width: 3, alpha: 0.18 + ringProgress * 0.34 });
        }
        for (let i = 0; i < 6; i += 1) {
          const a = elapsedAngle(progress, i, -1);
          this.graphics.circle(x + Math.cos(a) * radius * 0.58, y + Math.sin(a) * radius * 0.58, 4 + pulse * 2).fill({ color: recipe.accentColor, alpha: 0.65 });
        }
        break;
      case 'tidal-gather':
        this.graphics.circle(x, y, radius * (1 - progress * 0.62)).stroke({ color: recipe.accentColor, width: 7, alpha: 0.3 + progress * 0.5 });
        this.graphics.circle(x, y, 36 + pulse * 9).fill({ color: recipe.color, alpha: 0.08 + progress * 0.22 });
        for (let i = 0; i < 8; i += 1) {
          const a = elapsedAngle(progress, i, 1);
          const r = radius * (0.72 - progress * 0.36);
          this.graphics.circle(x + Math.cos(a) * r, y + Math.sin(a) * r, 5 + progress * 4).fill({ color: i % 2 ? recipe.accentColor : recipe.color, alpha: 0.58 });
        }
        break;
      case 'fuse-charge':
      case 'rocket-charge': {
        const backX = x - Math.cos(angle) * (entity.radius + 16);
        const backY = y - Math.sin(angle) * (entity.radius + 16);
        for (let i = 0; i < 4; i += 1) {
          const spread = (i - 1.5) * 0.22;
          const a = angle + Math.PI + spread;
          this.graphics.moveTo(backX, backY).lineTo(backX + Math.cos(a) * (28 + pulse * 18), backY + Math.sin(a) * (28 + pulse * 18))
            .stroke({ color: i % 2 ? recipe.accentColor : recipe.color, width: 4, alpha });
        }
        this.graphics.circle(x, y, entity.radius * (1.1 + pulse * 0.1)).stroke({ color: recipe.color, width: 3, alpha });
        break;
      }
      case 'warning-ring':
        this.graphics.circle(x, y, radius).stroke({ color: recipe.color, width: 4 + pulse * 3, alpha: 0.35 + pulse * 0.35 });
        this.graphics.circle(x, y, radius * progress).stroke({ color: recipe.accentColor, width: 2, alpha: 0.62 });
        break;
      case 'shrapnel-lock':
        this.graphics.circle(x, y, radius * (0.9 + pulse * 0.04)).stroke({ color: recipe.color, width: 3, alpha });
        for (let i = 0; i < 12; i += 1) {
          const a = (i / 12) * Math.PI * 2 + progress * Math.PI;
          const inner = radius * 0.72;
          const outer = radius * (0.92 + pulse * 0.05);
          this.graphics.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner)
            .lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer)
            .stroke({ color: i % 2 ? recipe.accentColor : recipe.color, width: 4, alpha: 0.52 });
        }
        break;
      case 'mega-danger':
        this.graphics.circle(x, y, radius).fill({ color: recipe.color, alpha: 0.025 + progress * 0.045 });
        this.graphics.circle(x, y, radius).stroke({ color: recipe.color, width: 8 + pulse * 5, alpha: 0.45 + progress * 0.35 });
        this.graphics.circle(x, y, radius * (1 - progress * 0.72)).stroke({ color: recipe.accentColor, width: 5, alpha: 0.75 });
        for (let i = 0; i < 16; i += 1) {
          const a = (i / 16) * Math.PI * 2;
          const inner = radius * 0.78;
          const outer = radius * 0.96;
          this.graphics.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner)
            .lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer)
            .stroke({ color: i % 2 ? recipe.accentColor : recipe.color, width: 6, alpha: 0.62 });
        }
        break;
      case 'reactor-charge':
        this.graphics.circle(x, y, radius * (0.62 + progress * 0.18)).stroke({ color: recipe.color, width: 5 + pulse * 3, alpha: 0.42 + progress * 0.36 });
        this.graphics.circle(x, y, radius * (0.34 + progress * 0.12)).fill({ color: recipe.color, alpha: 0.05 + progress * 0.14 });
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 - progress * Math.PI * 3;
          const inner = radius * 0.42;
          const outer = radius * 0.82;
          this.graphics.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner)
            .lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer)
            .stroke({ color: i % 2 ? recipe.accentColor : recipe.color, width: 4, alpha: 0.5 });
        }
        break;
      case 'none':
      default:
        break;
    }
  }
}

function elapsedAngle(progress: number, index: number, direction: number): number {
  return progress * Math.PI * 5 * direction + (index / 8) * Math.PI * 2;
}

function drawRingArc(graphics: Graphics, radius: number, start: number, sweep: number, ratio: number, color: number, width: number, alpha: number): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped <= 0) return;
  const steps = Math.max(4, Math.ceil(36 * clamped));
  for (let index = 0; index <= steps; index += 1) {
    const angle = start + sweep * clamped * (index / steps);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) graphics.moveTo(x, y);
    else graphics.lineTo(x, y);
  }
  graphics.stroke({ color, width, alpha, cap: 'round' });
}

class FighterView {
  readonly container = new Container();
  private readonly playerMarker = new Graphics();
  private readonly body = new Graphics();
  private readonly damageOverlay = new Graphics();
  private readonly core = new Graphics();
  private readonly aura = new Graphics();
  private readonly weapon = new Graphics();
  private readonly velocityVector = new Graphics();
  private readonly health = new Graphics();
  private label: Text | null = null;
  private profileId: PresentationSettings['renderProfile'];
  private lod: VisualLod;
  private readonly visual: VisualRecipe;
  private readonly motion: MotionRecipe;
  private readonly weaponDefinition: PrimaryAttackDefinition;
  private impact = 0;
  private damageFlash = 0;
  private displayedHpRatio: number;
  private delayedHpRatio: number;
  private lastHealthRenderKey = '';

  constructor(private readonly entity: EntitySnapshot, profileId: PresentationSettings['renderProfile'], lod: VisualLod) {
    const fighter = getFighter(entity.fighterId);
    this.visual = getVisualRecipe(fighter.visualRecipeId);
    this.motion = getMotionRecipe(fighter.animationRecipeId);
    this.weaponDefinition = getPrimaryAttack(entity.primaryAttackId);
    this.profileId = profileId;
    this.lod = lod;
    this.displayedHpRatio = Math.max(0, Math.min(1, entity.hp / Math.max(1, entity.maxHp)));
    this.delayedHpRatio = this.displayedHpRatio;
    this.container.addChild(this.playerMarker, this.aura, this.body, this.core, this.damageOverlay, this.weapon, this.health, this.velocityVector);
    this.build();
  }

  matches(entity: EntitySnapshot): boolean {
    return this.entity.fighterId === entity.fighterId
      && this.entity.primaryAttackId === entity.primaryAttackId
      && this.entity.controller === entity.controller
      && Math.abs(this.entity.radius - entity.radius) < 0.001;
  }

  prepareForReuse(): void {
    this.impact = 0;
    this.damageFlash = 0;
    this.container.visible = true;
    this.weapon.position.set(0, 0);
  }

  setProfile(profileId: PresentationSettings['renderProfile']): void {
    if (profileId === this.profileId) return;
    this.profileId = profileId;
    this.build();
  }

  setLod(lod: VisualLod): void {
    if (lod === this.lod) return;
    this.lod = lod;
    this.build();
  }

  hit(magnitude: number): void {
    this.impact = Math.max(this.impact, Math.min(1, magnitude / 18));
  }

  damage(amount: number): void {
    this.damageFlash = Math.max(this.damageFlash, Math.min(1, 0.72 + amount / 24));
    this.impact = Math.max(this.impact, Math.min(1, amount / 24));
  }

  update(entity: EntitySnapshot, alpha: number, elapsedSeconds: number, reducedMotion = false, victory = false): void {
    const profile = getRenderProfile(this.profileId);
    const x = entity.prevX + (entity.x - entity.prevX) * alpha;
    const y = entity.prevY + (entity.y - entity.prevY) * alpha;
    const speed = Math.hypot(entity.vx, entity.vy);
    const pose = reducedMotion ? { scaleX: 1, scaleY: 1 } : computeMotionPose(this.motion, { speed, impact: this.impact, elapsedSeconds });
    const cast = entity.abilities.find((ability) => ability.source === 'ability' && ability.phase === 'casting');
    const castRecipe = cast ? getSkillPresentation(cast.abilityId) : null;
    const castProgress = cast && cast.castTotalTicks > 0 ? 1 - cast.castRemainingTicks / cast.castTotalTicks : 0;
    const castPulse = cast ? Math.sin(castProgress * Math.PI * 8) : 0;
    let castScaleX = 1;
    let castScaleY = 1;
    let rotationOffset = 0;
    let jitterX = 0;
    let jitterY = 0;
    if (castRecipe && !reducedMotion) {
      switch (castRecipe.motion) {
        case 'stream': castScaleX = 1.16 + castProgress * 0.16; castScaleY = 0.92; break;
        case 'compress': castScaleX = 1.08 + castProgress * 0.1; castScaleY = 0.92 - castProgress * 0.08; break;
        case 'vortex': rotationOffset = castProgress * Math.PI * 1.2; castScaleX = castScaleY = 1 + Math.sin(castProgress * Math.PI) * 0.08; break;
        case 'gather': castScaleX = castScaleY = 1 - castProgress * 0.12 + Math.abs(castPulse) * 0.04; break;
        case 'rocket': castScaleX = 1.12 + castProgress * 0.18; castScaleY = 0.88; break;
        case 'brace': castScaleX = 1.14; castScaleY = 0.86; break;
        case 'spin': rotationOffset = castProgress * Math.PI * 3.5; break;
        case 'tremble': jitterX = Math.sin(elapsedSeconds * 70) * (1 + castProgress * 4); jitterY = Math.cos(elapsedSeconds * 83) * (1 + castProgress * 3); castScaleX = castScaleY = 1 + castProgress * 0.12; break;
        case 'overdrive': rotationOffset = Math.sin(elapsedSeconds * 18) * 0.08; castScaleX = castScaleY = 1 + castProgress * 0.18 + Math.abs(castPulse) * 0.06; break;
        case 'fuse-pop': castScaleX = castScaleY = 1.08; break;
        case 'snap': castScaleX = 1.12; castScaleY = 0.92; break;
      }
    }
    this.impact *= 0.86;

    const victoryLift = victory && !reducedMotion ? Math.sin(elapsedSeconds * 2.6) * 2.2 - 3 : 0;
    const victoryPulse = victory && !reducedMotion ? 1 + Math.sin(elapsedSeconds * 3.2) * 0.025 : 1;
    this.container.x = x + jitterX;
    this.container.y = y + jitterY + victoryLift;
    const weaponAttack = entity.weaponAttack;
    const attackFacing = weaponAttack ? Math.atan2(weaponAttack.direction.y, weaponAttack.direction.x) : null;
    const castFacing = cast?.castDirection ? Math.atan2(cast.castDirection.y, cast.castDirection.x) : null;
    if (this.profileId !== 'debug') this.container.rotation = (castFacing ?? attackFacing ?? entity.rotation) + rotationOffset;
    else this.container.rotation = 0;
    this.container.scale.set(pose.scaleX * castScaleX * victoryPulse, pose.scaleY * castScaleY * victoryPulse);
    this.updateWeaponPose(weaponAttack, reducedMotion);
    this.damageFlash *= reducedMotion ? 0.84 : 0.925;
    const damagePulse = Math.max(0, this.damageFlash);
    this.damageOverlay.alpha = Math.min(1, damagePulse * 1.18);
    this.damageOverlay.scale.set(1 + damagePulse * 0.18);
    this.core.alpha = 1 - damagePulse * 0.72;
    this.core.scale.set(castRecipe ? 1 + castProgress * (castRecipe.importance === 'ultimate' ? 0.55 : 0.24) : 1);
    this.aura.scale.set(castRecipe ? 1 + castProgress * 0.18 : 1);
    this.aura.alpha = castRecipe ? 0.75 + Math.abs(castPulse) * 0.25 : 1;

    this.velocityVector.clear();
    if (profile.showVelocityVectors) {
      this.velocityVector.moveTo(0, 0).lineTo(entity.vx * 8, entity.vy * 8).stroke({ color: 0x6dff9a, width: 2, alpha: 0.9 });
    }

    const uiAngle = -this.container.rotation;
    this.health.position.set(0, 0);
    this.health.rotation = uiAngle;
    if (this.profileId === 'standard') {
      const actualRatio = Math.max(0, Math.min(1, entity.hp / Math.max(1, entity.maxHp)));
      this.displayedHpRatio += (actualRatio - this.displayedHpRatio) * 0.38;
      if (actualRatio < this.delayedHpRatio) this.delayedHpRatio += (actualRatio - this.delayedHpRatio) * 0.055;
      else this.delayedHpRatio = actualRatio;
      const ringRadius = entity.radius * (entity.controller === 'player' ? 1.33 : 1.27);
      const lineWidth = entity.controller === 'player' ? Math.max(4.5, entity.radius * 0.15) : this.lod === 'army' ? 2.2 : Math.max(3.2, entity.radius * 0.115);
      const startAngle = Math.PI * 0.72;
      const sweep = Math.PI * 1.56;
      const pulseStep = actualRatio <= 0.25 && this.lod !== 'army' ? Math.round((0.4 + Math.sin(elapsedSeconds * 8) * 0.18) * 20) : 0;
      const healthKey = `${Math.round(this.displayedHpRatio * 160)}:${Math.round(this.delayedHpRatio * 160)}:${Math.round(actualRatio * 160)}:${pulseStep}:${this.lod}:${entity.controller}`;
      if (healthKey !== this.lastHealthRenderKey) {
        this.lastHealthRenderKey = healthKey;
        this.health.clear();
        drawRingArc(this.health, ringRadius, startAngle, sweep, 1, 0x111722, lineWidth + 2, this.lod === 'army' ? 0.55 : 0.88);
        if (this.delayedHpRatio > actualRatio + 0.01) drawRingArc(this.health, ringRadius, startAngle, sweep, this.delayedHpRatio, 0xffc65a, lineWidth, 0.82);
        const hpColor = actualRatio > 0.58 ? 0x72f29a : actualRatio > 0.28 ? 0xffc45f : 0xff4f58;
        drawRingArc(this.health, ringRadius, startAngle, sweep, this.displayedHpRatio, hpColor, lineWidth, 0.98);
        if (actualRatio <= 0.25 && this.lod !== 'army') {
          drawRingArc(this.health, ringRadius + lineWidth * 0.8, startAngle, sweep, actualRatio, 0xff5860, 1.8, pulseStep / 20);
        }
      }
    } else if (this.lastHealthRenderKey !== 'hidden') {
      this.lastHealthRenderKey = 'hidden';
      this.health.clear();
    }

    if (this.label) {
      this.label.text = `#${entity.id}  hp ${Math.ceil(entity.hp)}\nv ${speed.toFixed(1)} m ${entity.mass.toFixed(1)}`;
      this.label.rotation = uiAngle;
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private updateWeaponPose(attack: EntitySnapshot['weaponAttack'], reducedMotion: boolean): void {
    const r = this.entity.radius;
    // The weapon pivot is the exact fighter center. This keeps every weapon
    // aligned with the circular body regardless of facing direction.
    const socketX = 0;
    const socketY = 0;
    this.weapon.position.set(socketX, socketY);
    this.weapon.scale.set(1);
    // Primary attacks are deliberately stable while idle. Only an explicit
    // spin/orbit behavior is allowed to rotate, and only during its attack.
    if (!attack || reducedMotion) {
      this.weapon.rotation = 0;
      return;
    }
    const progress = 1 - attack.remainingTicks / Math.max(1, attack.totalTicks);
    const eased = progress * progress * (3 - 2 * progress);
    switch (attack.style) {
      case 'swing':
        this.weapon.rotation = attack.phase === 'windup' ? -1.2 + eased * 0.42 : attack.phase === 'active' ? -0.78 + eased * 2.28 : 1.5 - eased * 1.5;
        break;
      case 'thrust':
        this.weapon.rotation = 0;
        this.weapon.x = socketX + (attack.phase === 'windup' ? -r * 0.28 * eased : attack.phase === 'active' ? r * 0.78 * Math.sin(progress * Math.PI) : r * 0.28 * (1 - eased));
        break;
      case 'overhead':
      case 'slam':
        this.weapon.rotation = attack.phase === 'windup' ? -1.55 + eased * 0.3 : attack.phase === 'active' ? -1.25 + eased * 1.9 : 0.65 - eased * 0.65;
        break;
      case 'spin':
      case 'orbit':
        this.weapon.rotation = attack.phase === 'active' ? progress * Math.PI * 5 : attack.phase === 'windup' ? -0.45 * eased : 0;
        break;
      case 'shot':
      case 'burst':
      case 'stream':
        this.weapon.rotation = 0;
        this.weapon.x = socketX + (attack.phase === 'active' ? -r * 0.22 * Math.sin(progress * Math.PI * 2) : 0);
        break;
      case 'lob':
        this.weapon.rotation = attack.phase === 'windup' ? -0.95 * eased : attack.phase === 'active' ? -0.95 + eased * 1.9 : 0.95 - eased * 0.95;
        this.weapon.y = socketY + (attack.phase === 'windup' ? -r * 0.2 * eased : 0);
        break;
      default:
        this.weapon.rotation = 0;
    }
  }

  private drawConfiguredWeapon(r: number, attack: PrimaryAttackDefinition): void {
    const accent = this.visual.accentColor;
    const core = this.visual.coreColor;
    const size = r * attack.visualScale;

    if (attack.form === 'fire') {
      this.weapon.circle(size * 0.58, 0, size * 0.28).fill({ color: 0xff5b28, alpha: 0.92 });
      this.weapon.circle(size * 0.67, -size * 0.08, size * 0.18).fill({ color: 0xffb33d, alpha: 0.96 });
      this.weapon.moveTo(size * 0.52, -size * 0.22).lineTo(size * 0.82, -size * 0.52).lineTo(size * 0.76, -size * 0.08).fill({ color: 0xffe16f, alpha: 0.9 });
      return;
    }
    if (attack.form === 'water') {
      this.weapon.circle(size * 0.7, 0, size * 0.28).fill({ color: 0x4fd3ff, alpha: 0.72 });
      this.weapon.circle(size * 0.7, 0, size * 0.31).stroke({ color: 0xc9f8ff, width: Math.max(2, r * 0.1), alpha: 0.85 });
      this.weapon.circle(size * 0.61, -size * 0.09, size * 0.08).fill({ color: 0xffffff, alpha: 0.72 });
      return;
    }
    if (attack.form === 'lightning') {
      this.weapon.circle(size * 0.48, 0, size * 0.23).fill({ color: 0xffef4e, alpha: 0.95 });
      this.weapon.circle(size * 0.48, 0, size * 0.32).stroke({ color: 0x8df6ff, width: 3, alpha: 0.8 });
      this.weapon.moveTo(size * 0.68, -size * 0.2).lineTo(size * 0.58, 0).lineTo(size * 0.84, -size * 0.03).lineTo(size * 0.72, size * 0.22).stroke({ color: 0xffffff, width: 3, alpha: 0.95 });
      return;
    }
    if (attack.form === 'gauntlet') {
      this.weapon.rect(size * 0.18, -size * 0.22, size * 0.62, size * 0.44).fill({ color: 0x334657, alpha: 1 });
      this.weapon.rect(size * 0.62, -size * 0.32, size * 0.42, size * 0.64).fill({ color: accent, alpha: 0.95 });
      this.weapon.rect(size * 0.28, -size * 0.08, size * 0.42, size * 0.16).fill({ color: core, alpha: 0.9 });
      return;
    }
    if (attack.form === 'rifle') {
      this.weapon.moveTo(size * 0.05, 0).lineTo(size * 0.3, 0).stroke({ color: 0x26303b, width: Math.max(10, r * 0.45), alpha: 1 });
      this.weapon.rect(size * 0.22, -size * 0.11, size * 0.78, size * 0.22).fill({ color: 0x202a34, alpha: 1 });
      this.weapon.rect(size * 0.34, -size * 0.065, size * 0.48, size * 0.13).fill({ color: accent, alpha: 0.85 });
      this.weapon.moveTo(size * 0.96, 0).lineTo(size * 1.28, 0).stroke({ color: core, width: Math.max(3, r * 0.13), alpha: 0.98 });
      this.weapon.moveTo(size * 0.55, size * 0.11).lineTo(size * 0.62, size * 0.35).lineTo(size * 0.76, size * 0.11).fill({ color: 0x111820, alpha: 0.96 });
      return;
    }
    if (attack.form === 'launcher') {
      if (attack.visualId.includes('rocket')) {
        this.weapon.rect(size * 0.08, -size * 0.19, size * 0.98, size * 0.38).fill({ color: 0x29343d, alpha: 1 });
        this.weapon.rect(size * 0.18, -size * 0.12, size * 0.72, size * 0.24).fill({ color: accent, alpha: 0.8 });
        this.weapon.circle(size * 1.03, 0, size * 0.22).stroke({ color: 0xffc15d, width: Math.max(3, r * 0.11), alpha: 0.95 });
        this.weapon.moveTo(size * 0.16, size * 0.18).lineTo(size * 0.03, size * 0.38).lineTo(size * 0.35, size * 0.19).fill({ color: 0x171f27, alpha: 1 });
      } else {
        const x = size * 0.66;
        this.weapon.circle(x, 0, size * 0.26).fill({ color: 0x171a22, alpha: 1 });
        this.weapon.circle(x, 0, size * 0.22).stroke({ color: 0xff883a, width: 3, alpha: 0.92 });
        this.weapon.moveTo(x + size * 0.14, -size * 0.14).lineTo(x + size * 0.28, -size * 0.34).stroke({ color: 0xcab58e, width: 3, alpha: 0.95 });
        this.weapon.circle(x + size * 0.29, -size * 0.35, Math.max(3, r * 0.13)).fill({ color: 0xffd05a, alpha: 1 });
      }
      return;
    }
    if (attack.form === 'claws') {
      for (let index = -1; index <= 1; index += 1) {
        this.weapon.moveTo(size * 0.12, index * size * 0.1).lineTo(size * 0.94, index * size * 0.15 - size * 0.08).stroke({ color: index === 0 ? core : accent, width: Math.max(4, r * 0.15), alpha: 0.94 });
      }
      return;
    }
    if (attack.form === 'void') {
      const end = size * 0.92;
      this.weapon.moveTo(size * 0.12, size * 0.1).lineTo(end * 0.72, 0).stroke({ color: 0x58307f, width: Math.max(5, r * 0.18), alpha: 0.98 });
      this.weapon.moveTo(end * 0.62, 0).quadraticCurveTo(end, -size * 0.55, end * 1.18, -size * 0.12).lineTo(end * 0.88, size * 0.02).quadraticCurveTo(end * 0.78, -size * 0.25, end * 0.62, 0).fill({ color: accent, alpha: 0.94 });
      return;
    }
    if (attack.form === 'axe' || attack.form === 'hammer') {
      const end = size * 0.92;
      this.weapon.moveTo(size * 0.08, 0).lineTo(end, 0).stroke({ color: attack.form === 'axe' ? 0xc5f4ff : 0x8095a5, width: Math.max(5, r * 0.18), alpha: 0.97 });
      if (attack.form === 'axe') {
        this.weapon.moveTo(end - size * 0.08, -size * 0.34).lineTo(end + size * 0.18, 0).lineTo(end - size * 0.08, size * 0.34).lineTo(end - size * 0.22, 0).fill({ color: 0x8ee9ff, alpha: 0.94 });
      } else {
        this.weapon.rect(end - size * 0.12, -size * 0.25, size * 0.35, size * 0.5).fill({ color: accent, alpha: 0.96 });
      }
      return;
    }
    if (attack.form === 'spear') {
      const end = size * 1.04;
      this.weapon.moveTo(size * 0.04, 0).lineTo(end, 0).stroke({ color: 0xa9c7d7, width: Math.max(6, r * 0.19), alpha: 0.98 });
      this.weapon.moveTo(end, 0).lineTo(end - size * 0.24, -size * 0.18).lineTo(end - size * 0.14, 0).lineTo(end - size * 0.24, size * 0.18).lineTo(end, 0).fill({ color: core, alpha: 0.98 });
      return;
    }
    // Sword and shield-compatible fallback: oversized handle, guard and broad blade for readability.
    const handleStart = -size * 0.2;
    const guardX = size * 0.14;
    const end = size * 1.04;
    this.weapon.moveTo(handleStart, 0).lineTo(guardX, 0).stroke({ color: 0x5a3624, width: Math.max(7, r * 0.22), alpha: 1 });
    this.weapon.circle(handleStart, 0, Math.max(4, r * 0.13)).fill({ color: 0xd9ad5e, alpha: 0.98 });
    this.weapon.moveTo(guardX, -size * 0.24).lineTo(guardX, size * 0.24).stroke({ color: core, width: Math.max(5, r * 0.16), alpha: 1 });
    this.weapon.moveTo(guardX + size * 0.04, -size * 0.13).lineTo(end - size * 0.12, -size * 0.17).lineTo(end + size * 0.18, 0).lineTo(end - size * 0.12, size * 0.17).lineTo(guardX + size * 0.04, size * 0.13).fill({ color: accent, alpha: 0.98 });
    this.weapon.moveTo(guardX + size * 0.12, 0).lineTo(end, 0).stroke({ color: 0xffffff, width: Math.max(2, r * 0.06), alpha: 0.55 });
  }

  private drawIdentityWeaponSilhouette(r: number, attack: PrimaryAttackDefinition): void {
    this.drawConfiguredWeapon(r * 0.8, attack);
  }

  private build(): void {
    const profile = getRenderProfile(this.profileId);
    const r = this.entity.radius;
    this.playerMarker.clear();
    this.aura.clear();
    this.body.clear();
    this.damageOverlay.clear();
    this.core.clear();
    this.weapon.clear();
    this.velocityVector.clear();
    this.health.clear();
    this.lastHealthRenderKey = '';
    if (this.label) { this.label.destroy(); this.label = null; }

    if (this.entity.controller === 'player') {
      this.playerMarker.circle(0, 0, r * 1.48).stroke({ color: 0xffffff, width: 2.2, alpha: 0.48 });
    }

    if (profile.showCharacterLayers && this.lod !== 'army') {
      if (this.lod === 'hero') {
        this.aura.circle(0, 0, r * 1.32).fill({ color: this.visual.auraColor, alpha: 0.07 });
        this.aura.circle(0, 0, r * 1.1).stroke({ color: this.visual.auraColor, width: 3, alpha: 0.36 });
      }
      this.body.circle(0, 0, r).fill({ color: this.visual.bodyDarkColor, alpha: 1 });
      this.body.circle(0, 0, r * 0.88).fill({ color: this.visual.bodyColor, alpha: this.visual.shape === 'water' ? 0.78 : 1 });

      if (this.visual.shape === 'mech') {
        this.body.rect(-r * 0.78, -r * 0.22, r * 1.56, r * 0.44).fill({ color: this.visual.accentColor, alpha: 0.28 });
        this.body.rect(-r * 0.22, -r * 0.78, r * 0.44, r * 1.56).fill({ color: this.visual.accentColor, alpha: 0.2 });
      } else if (this.visual.shape === 'water') {
        this.body.circle(-r * 0.2, -r * 0.14, r * 0.56).fill({ color: 0x72dfff, alpha: 0.18 });
        this.body.circle(r * 0.27, r * 0.16, r * 0.43).fill({ color: 0x0b5f9b, alpha: 0.25 });
        this.body.circle(0, 0, r * 0.7).stroke({ color: this.visual.accentColor, width: 2, alpha: 0.52 });
      } else if (this.visual.shape === 'bomber') {
        this.body.circle(0, 0, r * 0.68).stroke({ color: this.visual.accentColor, width: 3, alpha: 0.45 });
        for (let i = -2; i <= 2; i += 1) {
          const offset = i * r * 0.28;
          this.body.moveTo(offset - r * 0.13, r * 0.58).lineTo(offset + r * 0.13, r * 0.78).stroke({ color: this.visual.accentColor, width: 3, alpha: 0.72 });
        }
      }

      this.damageOverlay.circle(0, 0, r * 0.98).fill({ color: 0xff172f, alpha: 0.98 });
      this.damageOverlay.circle(0, 0, r * 1.08).stroke({ color: 0xff5364, width: Math.max(4, r * 0.16), alpha: 0.94 });
      this.damageOverlay.circle(-r * 0.24, -r * 0.24, r * 0.46).fill({ color: 0xffffff, alpha: 0.42 });
      this.damageOverlay.alpha = 0;
      this.core.circle(0, 0, r * 0.3).fill({ color: this.visual.coreColor, alpha: 1 });
      this.core.circle(0, 0, r * 0.5).stroke({ color: this.visual.coreColor, width: 2, alpha: 0.42 });
      if (this.visual.horns && this.lod === 'hero') {
        this.body.moveTo(-r * 0.6, -r * 0.55).lineTo(-r * 0.92, -r * 1.02).stroke({ color: this.visual.accentColor, width: 5, alpha: 0.95 });
        this.body.moveTo(r * 0.6, -r * 0.55).lineTo(r * 0.92, -r * 1.02).stroke({ color: this.visual.accentColor, width: 5, alpha: 0.95 });
      }
      this.drawConfiguredWeapon(r, this.weaponDefinition);
    } else {
      const color = this.visual.bodyColor;
      this.body.circle(0, 0, r).fill({ color, alpha: this.lod === 'army' || this.profileId === 'minimal' ? 0.9 : 0.08 });
      this.body.circle(0, 0, r).stroke({ color: this.profileId === 'debug' ? 0xffffff : this.visual.accentColor, width: this.profileId === 'debug' ? 2 : 3, alpha: 0.95 });
      this.core.circle(0, 0, Math.max(3, r * 0.25)).fill({ color: this.visual.coreColor, alpha: 1 });
      this.body.moveTo(-r * 0.45, -r * 0.52).lineTo(r * 0.36, r * 0.5).stroke({ color: this.visual.bodyDarkColor, width: Math.max(2, r * 0.13), alpha: 0.62 });
      this.damageOverlay.circle(0, 0, r).fill({ color: 0xff1730, alpha: 0.98 });
      this.damageOverlay.circle(0, 0, r * 1.08).stroke({ color: 0xff5a68, width: Math.max(3, r * 0.14), alpha: 0.92 });
      this.damageOverlay.alpha = 0;
      this.drawIdentityWeaponSilhouette(r, this.weaponDefinition);
    }

    if (profile.showLabels && this.lod !== 'army') {
      this.label = new Text({ text: `#${this.entity.id}`, style: { fill: 0xffffff, fontSize: 12, fontFamily: 'monospace' } });
      this.label.x = this.entity.radius + 8;
      this.label.y = -this.entity.radius - 8;
      this.container.addChild(this.label);
    }
  }
}

export class PixiBattleRenderer {
  private readonly app = new Application();
  private readonly cameraRoot = new Container();
  private readonly shakeRoot = new Container();
  private readonly worldRoot = new Container();
  private readonly arenaLayer = new Container();
  private readonly groundFxLayer = new Container();
  private readonly trailLayer = new Container();
  private readonly projectileFxLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly telegraphLayer = new Container();
  private readonly fighterFxLayer = new Container();
  private readonly fighterLayer = new Container();
  private readonly weaponFxLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly trainingDebugLayer = new Container();
  private readonly combatTextLayer = new Container();
  private readonly foregroundLayer = new Container();
  private readonly screenFxLayer = new Container();
  private readonly arenaGraphics = new Graphics();
  private readonly obstacleGraphics = new Graphics();
  private readonly trailGraphics = new Graphics();
  private readonly projectileGraphics = new Graphics();
  private readonly trainingDebugGraphics = new Graphics();
  private readonly playerTargetingGraphics = new Graphics();
  private readonly screenFlashGraphics = new Graphics();
  private readonly fighterViews = new Map<EntityId, FighterView>();
  private readonly activeEntityIds = new Set<EntityId>();
  private readonly impactByEntity = new Map<EntityId, number>();
  private readonly damageByEntity = new Map<EntityId, number>();
  private readonly entityByIdScratch = new Map<EntityId, EntitySnapshot>();
  private readonly trailHistory = new Map<EntityId, Array<{ x: number; y: number }>>();
  private readonly knockbackTrails = new Map<EntityId, KnockbackTrailState>();
  private readonly projectileDebugHistory = new Map<number, Array<{ x: number; y: number }>>();
  private readonly floatingCombatTexts: FloatingCombatTextState[] = [];
  private fx: FxEngine | null = null;
  private layeredFx: LayeredVfxEngine | null = null;
  private legacyFxSuppressed = false;
  private readonly telegraphs = new SkillTelegraphRenderer();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private destroyed = false;
  private arena!: ArenaDefinition;
  private settings!: PresentationSettings;
  private elapsedSeconds = 0;
  private shake = 0;
  private freezeMs = 0;
  private readonly missileCascadeTracker = new MissileCascadeTracker();
  private screenFlash = 0;
  private baseX = 0;
  private baseY = 0;
  private baseScale = 1;
  private cameraScale = 1;
  private cameraX = 0;
  private cameraY = 0;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;
  private cameraNeedsSnap = true;
  private focusEntityId: EntityId | null = null;
  private lastFocusPosition: Vec2 | null = null;
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeRaf = 0;
  private resizeForcePending = false;
  private lastHostWidth = 0;
  private lastHostHeight = 0;
  private lastResolution = 1;
  private resizeCount = 0;
  private contextLost = false;
  private performanceScale = 1;
  private active = true;
  private playerAimPoint: Vec2 | null = null;
  private pointerAimEnabled = true;
  private playerPreviewSlot: AbilitySlot = 'basic';
  private playerHitmarkerFlash = 0;
  private readonly playerEntityIdsScratch = new Set<EntityId>();
  private createdFighterViews = 0;
  private reusedFighterViews = 0;
  private obstacleCacheArenaId = '';
  private obstacleCacheProfile = '';
  private obstacleCacheLength = -1;
  private readonly obstacleCacheIds: string[] = [];
  private readonly obstacleCacheHp: number[] = [];
  private readonly obstacleCacheAlive: boolean[] = [];
  private trainingDebug: TrainingDebugOptions = { ...DEFAULT_TRAINING_DEBUG };
  private diagnostics: RenderDiagnostics = {
    lod: 'hero', fighterViews: 0, pooledFighterViews: 0, createdFighterViews: 0, reusedFighterViews: 0, particleScale: 1, activeParticles: 0, vfxQuality: 'high', groundMarks: 0, residualParticles: 0, weaponEffects: 0, projectileTrails: 0, qualityScale: 1, resolution: 1,
    devicePixelRatio: 1, renderScale: 1, cssWidth: 1, cssHeight: 1, pixelWidth: 1, pixelHeight: 1,
    orientation: 'landscape', resizeCount: 0, contextLost: false,
    renderTier: 'full', targetRenderFps: 60, presentationEvents: 0, projectileVisuals: 0
  };

  init(host: HTMLElement, arenaId: string, settings: PresentationSettings): Promise<void> {
    if (this.destroyed) return Promise.reject(new Error('Battle renderer has been destroyed.'));
    if (this.initialized) {
      this.attachHost(host);
      this.setArena(arenaId);
      this.setSettings(settings);
      return Promise.resolve();
    }
    this.arena = getArena(arenaId);
    this.settings = { ...settings };
    this.host = host;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize().then(() => {
      this.initPromise = null;
    }, (reason: unknown) => {
      this.initPromise = null;
      throw reason;
    });
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    const initialHost = this.host;
    if (!initialHost?.isConnected) throw new Error('Battle renderer host is not connected.');
    const initialWidth = Math.max(1, Math.round(initialHost.getBoundingClientRect().width || initialHost.clientWidth));
    const initialHeight = Math.max(1, Math.round(initialHost.getBoundingClientRect().height || initialHost.clientHeight));
    if (initialWidth < 32 || initialHeight < 32) throw new Error('Battle renderer host does not have a usable layout yet.');
    const initialResolution = this.resolveResolution();
    this.lastResolution = initialResolution;
    await this.app.init({
      width: initialWidth,
      height: initialHeight,
      backgroundColor: 0x05070d,
      antialias: true,
      autoDensity: true,
      resolution: initialResolution,
      preference: 'webgl',
      sharedTicker: false
    });
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      throw new Error('Battle renderer was destroyed during initialization.');
    }
    const mountHost = this.host;
    if (!mountHost?.isConnected) {
      this.app.destroy(true, { children: true });
      throw new Error('Battle renderer host was removed during initialization.');
    }
    this.app.canvas.classList.add('kinetic-render-canvas');
    this.app.canvas.setAttribute('aria-hidden', 'true');
    mountHost.replaceChildren(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = this.active ? 'visible' : 'hidden';
    this.app.stage.addChild(this.cameraRoot, this.screenFxLayer);
    this.cameraRoot.addChild(this.shakeRoot);
    this.shakeRoot.addChild(this.worldRoot);
    this.worldRoot.addChild(this.arenaLayer, this.groundFxLayer, this.trailLayer, this.projectileFxLayer, this.projectileLayer, this.fighterFxLayer, this.fighterLayer, this.telegraphLayer, this.weaponFxLayer, this.fxLayer, this.trainingDebugLayer, this.combatTextLayer, this.foregroundLayer);
    this.arenaLayer.addChild(this.arenaGraphics, this.obstacleGraphics);
    this.trailLayer.addChild(this.trailGraphics);
    this.projectileLayer.addChild(this.projectileGraphics);
    this.trainingDebugLayer.addChild(this.trainingDebugGraphics);
    this.foregroundLayer.addChild(this.playerTargetingGraphics);
    this.telegraphLayer.addChild(this.telegraphs.container);
    this.screenFxLayer.addChild(this.screenFlashGraphics);
    this.fx = new FxEngine(this.fxLayer);
    this.layeredFx = new LayeredVfxEngine({
      arena: this.groundFxLayer,
      world: this.fxLayer,
      fighter: this.fighterFxLayer,
      weapon: this.weaponFxLayer,
      projectile: this.projectileFxLayer,
      foreground: this.screenFxLayer
    }, this.arena);
    this.bindResizeObserver(mountHost);
    window.addEventListener('resize', this.handleViewportResize, { passive: true });
    window.addEventListener('orientationchange', this.handleViewportResize, { passive: true });
    window.visualViewport?.addEventListener('resize', this.handleViewportResize, { passive: true });
    this.app.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.app.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    this.initialized = true;
    this.invalidateObstacleCache();
    this.syncRendererSize(true);
    this.drawArena();
    this.fitWorld();
    this.snapCameraToCurrentTarget();
  }

  attachHost(host: HTMLElement): void {
    if (this.initialized && this.host === host && this.app.canvas.parentElement === host) {
      this.ensureCanvasMounted();
      this.queueRendererResize(true);
      return;
    }
    this.host = host;
    if (!this.initialized) return;
    this.bindResizeObserver(host);
    host.replaceChildren(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = this.active ? 'visible' : 'hidden';
    this.lastHostWidth = 0;
    this.lastHostHeight = 0;
    this.cameraNeedsSnap = true;
    this.queueRendererResize(true);
    requestAnimationFrame(() => this.queueRendererResize(true));
  }

  setPlayerAimPoint(point: Vec2 | null): void {
    this.playerAimPoint = point ? { ...point } : null;
  }

  /** Touch devices steer with the analog stick and have no cursor, so the aim
   *  reticle/crosshair is suppressed entirely on those devices. */
  setPointerAimEnabled(enabled: boolean): void {
    if (this.pointerAimEnabled === enabled) return;
    this.pointerAimEnabled = enabled;
    if (!enabled) this.playerTargetingGraphics.clear();
  }

  setPlayerPreviewSlot(slot: AbilitySlot): void {
    this.playerPreviewSlot = slot;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!this.initialized) return;
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = active ? 'visible' : 'hidden';
    if (!active) {
      this.app.stop();
      return;
    }
    this.ensureCanvasMounted();
    this.app.start();
    this.lastHostWidth = 0;
    this.lastHostHeight = 0;
    this.queueRendererResize(true);
    this.cameraNeedsSnap = true;
    requestAnimationFrame(() => {
      if (!this.active) return;
      this.ensureCanvasMounted();
      this.queueRendererResize(true);
      requestAnimationFrame(() => {
        if (!this.active) return;
        this.ensureCanvasMounted();
        this.queueRendererResize(true);
      });
    });
  }

  setArena(arenaId: string): void {
    if (this.arena?.id === arenaId) return;
    this.arena = getArena(arenaId);
    this.invalidateObstacleCache();
    if (!this.initialized) return;
    this.layeredFx?.setArena(this.arena);
    this.drawArena();
    this.fitWorld();
    this.lastFocusPosition = null;
    this.cameraNeedsSnap = true;
    this.snapCameraToCurrentTarget();
  }

  setFocusEntity(entityId: EntityId | null): void {
    if (this.focusEntityId === entityId) return;
    this.focusEntityId = entityId;
    this.lastFocusPosition = null;
    this.cameraNeedsSnap = true;
  }

  clientToWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.app.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    const screenX = (clientX - rect.left) * (this.app.screen.width / rect.width);
    const screenY = (clientY - rect.top) * (this.app.screen.height / rect.height);
    const world = this.worldRoot.toLocal(new Point(screenX, screenY));
    return { x: world.x, y: world.y };
  }

  setSettings(settings: PresentationSettings): void {
    const profileChanged = this.settings?.renderProfile !== settings.renderProfile;
    const arenaBackgroundChanged = this.settings?.arenaBackground !== settings.arenaBackground;
    const resolutionChanged = this.settings?.maxDevicePixelRatio !== settings.maxDevicePixelRatio
      || this.settings?.renderScale !== settings.renderScale
      || this.settings?.adaptiveQuality !== settings.adaptiveQuality;
    const followChanged = this.settings?.cameraFollow !== settings.cameraFollow;
    this.settings = { ...settings };
    if (resolutionChanged && this.initialized) this.queueRendererResize(true);
    if (profileChanged) {
      this.invalidateObstacleCache();
      for (const view of this.fighterViews.values()) view.setProfile(settings.renderProfile);
    }
    if (this.initialized && (profileChanged || arenaBackgroundChanged)) {
      this.drawArena();
    }
    if (followChanged) {
      this.cameraNeedsSnap = true;
      if (!settings.cameraFollow) this.snapCameraToCurrentTarget();
    }
  }

  setPerformanceScale(scale: number): void {
    const next = Math.max(0.35, Math.min(1, scale));
    if (Math.abs(next - this.performanceScale) < 0.001) return;
    const previousResolution = this.resolveResolution();
    this.performanceScale = next;
    if (this.initialized && Math.abs(previousResolution - this.resolveResolution()) >= 0.04) {
      this.queueRendererResize(true);
    }
  }

  setTrainingDebugOptions(options: Partial<TrainingDebugOptions>): void {
    this.trainingDebug = { ...this.trainingDebug, ...options };
    if (!this.trainingDebug.enabled || !this.trainingDebug.showProjectilePaths) this.projectileDebugHistory.clear();
    if (!this.trainingDebug.enabled || !this.trainingDebug.showDamageNumbers) this.clearFloatingCombatTexts();
  }

  render(snapshot: WorldSnapshot, alpha: number, events: readonly SimulationEvent[], dtMs: number): RenderDiagnostics {
    if (!this.settings || this.contextLost || !this.active) return this.diagnostics;
    this.ensureCanvasMounted();
    this.elapsedSeconds += Math.min(0.05, dtMs / 1000);
    const playerEntityIds = this.playerEntityIdsScratch;
    playerEntityIds.clear();
    for (const entity of snapshot.entities) if (entity.controller === 'player') playerEntityIds.add(entity.id);
    const renderPolicy = resolveMassBattleRenderPolicy(snapshot.entities.length, this.settings.targetRenderFps, this.performanceScale);
    const missileCausalFrame = this.missileCascadeTracker.shouldSuppressFreeze(events, snapshot.tick);
    const compactedEvents = compactMissilePresentationEvents(events);
    this.updateKnockbackTrailState(events, Math.min(0.05, dtMs / 1000));
    const missileBarrageActive = missileCausalFrame || snapshot.projectiles.some((projectile) => isMissileWeapon(projectile.weaponId));
    const unbudgetedPresentationEvents = missileBarrageActive
      ? compactMissileSecondaryPresentationEvents(compactedEvents)
      : compactedEvents;
    const presentationEvents = budgetPresentationEvents(unbudgetedPresentationEvents, renderPolicy.maxPresentationEvents, playerEntityIds);
    const visibleProjectiles = selectProjectileVisuals(snapshot.projectiles, renderPolicy.maxProjectileVisuals, playerEntityIds);
    if (missileBarrageActive) {
      // A barrage is continuous presentation: missiles fly, hit, launch a
      // fighter, then cause body/wall/death events on later ticks. Hit-stop
      // during any part of that chain is perceived as the whole game freezing.
      // Clear previously queued freeze and keep the barrage fully real-time.
      this.freezeMs = 0;
    }
    this.syncRendererSize(false);
    this.drawObstacles(snapshot);
    const profile = getRenderProfile(this.settings.renderProfile);
    const baseLod: VisualLod = snapshot.entities.length <= 12 ? 'hero' : snapshot.entities.length <= 36 ? 'standard' : 'army';
    const automaticLod: VisualLod = renderPolicy.tier === 'mass' || this.performanceScale < 0.5 ? 'army' : this.performanceScale < 0.78 && baseLod === 'hero' ? 'standard' : baseLod;
    const crowdParticleScale = snapshot.entities.length <= 12 ? 1 : snapshot.entities.length <= 28 ? 0.68 : snapshot.entities.length <= 55 ? 0.4 : 0.22;

    for (const event of events) {
      if (event.type === 'impact') {
        this.impactByEntity.set(event.a, Math.max(this.impactByEntity.get(event.a) ?? 0, event.magnitude));
        this.impactByEntity.set(event.b, Math.max(this.impactByEntity.get(event.b) ?? 0, event.magnitude));
      } else if (event.type === 'damage' && shouldPresentDamage(event)) {
        this.damageByEntity.set(event.targetId, Math.max(this.damageByEntity.get(event.targetId) ?? 0, event.amount));
        if (event.sourceId !== undefined && playerEntityIds.has(event.sourceId) && !playerEntityIds.has(event.targetId)) {
          this.playerHitmarkerFlash = Math.max(this.playerHitmarkerFlash, Math.min(1, 0.66 + event.amount / 28));
        }
      }
    }

    this.activeEntityIds.clear();
    for (const entity of snapshot.entities) this.activeEntityIds.add(entity.id);
    for (const [id, view] of this.fighterViews) {
      if (!this.activeEntityIds.has(id)) {
        view.container.visible = false;
        this.trailHistory.delete(id);
        this.knockbackTrails.delete(id);
      }
    }
    for (const entity of snapshot.entities) {
      let view = this.fighterViews.get(entity.id);
      if (view && !view.matches(entity)) {
        view.destroy();
        this.fighterViews.delete(entity.id);
        view = undefined;
      }
      if (!view) {
        const entityLod: VisualLod = entity.controller === 'player' ? 'hero' : automaticLod;
        view = new FighterView(entity, this.settings.renderProfile, entityLod);
        this.fighterViews.set(entity.id, view);
        this.fighterLayer.addChild(view.container);
        this.createdFighterViews += 1;
      } else if (!view.container.visible) {
        view.prepareForReuse();
        this.reusedFighterViews += 1;
      }
      view.container.visible = true;
      view.setLod(entity.controller === 'player' ? 'hero' : automaticLod);
    }

    const vfxQuality = resolveVfxQuality({
      effects: this.settings.effects,
      particleScale: this.settings.particleScale,
      reducedMotion: this.settings.reducedMotion,
      adaptiveQuality: this.settings.adaptiveQuality,
      performanceScale: this.performanceScale,
      fighterCount: snapshot.entities.length
    });
    const effectiveParticleScale = profile.defaultParticleScale * crowdParticleScale * this.settings.particleScale * this.performanceScale * vfxQuality.particleMultiplier;
    if (this.settings.effects && effectiveParticleScale > 0) {
      const useLegacyFx = snapshot.entities.length <= 40 && vfxQuality.tier !== 'low';
      let response: FxResponse | null = null;
      if (useLegacyFx) {
        this.legacyFxSuppressed = false;
        response = this.fx?.consume(presentationEvents, snapshot, effectiveParticleScale) ?? null;
      } else {
        if (!this.legacyFxSuppressed) this.fx?.reset();
        this.legacyFxSuppressed = true;
        response = resolveCrowdFxResponse(presentationEvents);
      }
      this.layeredFx?.consume(presentationEvents, snapshot, vfxQuality, {
        maxResidualEffects: renderPolicy.maxResidualEffects,
        maxWeaponEffects: renderPolicy.maxWeaponEffects,
        maxGroundMarks: renderPolicy.maxGroundMarks
      });
      if (response) {
        if (this.settings.cameraShake) {
          const shake = missileBarrageActive ? Math.min(3, response.shake) : response.shake;
          this.shake = Math.max(this.shake, shake * vfxQuality.shakeMultiplier);
        }
        if (this.settings.impactFreeze && !missileBarrageActive) this.freezeMs = Math.max(this.freezeMs, response.freezeMs * vfxQuality.freezeMultiplier);
        const screenFlash = missileBarrageActive ? Math.min(0.14, response.screenFlash) : response.screenFlash;
        this.screenFlash = Math.max(this.screenFlash, screenFlash * vfxQuality.flashMultiplier);
      }
    }

    this.telegraphs.render(snapshot, this.elapsedSeconds, this.settings.effects && this.settings.renderProfile !== 'debug');

    const frozen = !missileBarrageActive && this.settings.impactFreeze && this.freezeMs > 0;
    this.freezeMs = Math.max(0, this.freezeMs - dtMs);

    if (!frozen) {
      for (const entity of snapshot.entities) {
        const view = this.fighterViews.get(entity.id)!;
        const impact = this.impactByEntity.get(entity.id) ?? 0;
        if (impact > 0) view.hit(impact);
        this.impactByEntity.set(entity.id, impact * 0.72);
        const damage = this.damageByEntity.get(entity.id) ?? 0;
        if (damage > 0) view.damage(damage);
        this.damageByEntity.delete(entity.id);
        view.update(entity, alpha, this.elapsedSeconds, this.settings.reducedMotion, snapshot.battleEnded && snapshot.winningTeam === entity.team);
        const hasKnockbackTrail = this.knockbackTrails.has(entity.id);
        if (hasKnockbackTrail || (this.performanceScale >= 0.48 && (snapshot.entities.length <= 24 || entity.controller === 'player' || entity.id % Math.ceil(snapshot.entities.length / 24) === 0))) this.updateTrail(entity, alpha);
      }
      this.drawTrails(snapshot);
    }
    if (this.settings.effects) this.layeredFx?.update(snapshot, alpha, this.elapsedSeconds, frozen ? 0 : Math.min(0.05, dtMs / 1000), vfxQuality, this.settings.trails, renderPolicy.maxProjectileTrails, renderPolicy.tier === 'mass');
    else this.layeredFx?.reset();
    this.drawProjectiles(visibleProjectiles, alpha);
    this.drawPlayerTargeting(snapshot, alpha);
    this.consumeTrainingDamageEvents(events, snapshot);
    this.drawTrainingDebug(snapshot, alpha);
    this.updateFloatingCombatTexts(dtMs);

    if (!this.legacyFxSuppressed) this.fx?.update(frozen ? 0 : Math.min(0.05, dtMs / 1000));
    this.drawScreenFlash(dtMs);
    this.updateCamera(snapshot);
    const cssWidth = Math.max(1, this.lastHostWidth || Math.round(this.app.screen.width));
    const cssHeight = Math.max(1, this.lastHostHeight || Math.round(this.app.screen.height));
    const layeredDiagnostics = this.layeredFx?.getDiagnostics() ?? { activeGroundMarks: 0, activeResiduals: 0, activeWeaponEffects: 0, projectileTrails: 0 };
    this.diagnostics = {
      lod: automaticLod,
      fighterViews: snapshot.entities.length,
      pooledFighterViews: Math.max(0, this.fighterViews.size - snapshot.entities.length),
      createdFighterViews: this.createdFighterViews,
      reusedFighterViews: this.reusedFighterViews,
      particleScale: effectiveParticleScale,
      activeParticles: (this.fx?.activeParticleCount() ?? 0) + layeredDiagnostics.activeResiduals,
      vfxQuality: vfxQuality.tier,
      groundMarks: layeredDiagnostics.activeGroundMarks,
      residualParticles: layeredDiagnostics.activeResiduals,
      weaponEffects: layeredDiagnostics.activeWeaponEffects,
      projectileTrails: layeredDiagnostics.projectileTrails,
      qualityScale: this.performanceScale,
      resolution: this.lastResolution,
      devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
      renderScale: this.settings.renderScale,
      cssWidth,
      cssHeight,
      pixelWidth: Math.max(1, this.app.canvas.width),
      pixelHeight: Math.max(1, this.app.canvas.height),
      orientation: cssWidth >= cssHeight ? 'landscape' : 'portrait',
      resizeCount: this.resizeCount,
      contextLost: this.contextLost,
      renderTier: renderPolicy.tier,
      targetRenderFps: renderPolicy.targetFps,
      presentationEvents: presentationEvents.length,
      projectileVisuals: visibleProjectiles.length
    };
    return this.diagnostics;
  }

  getDiagnostics(): RenderDiagnostics { return { ...this.diagnostics }; }

  reset(): void {
    for (const view of this.fighterViews.values()) {
      view.container.visible = false;
      view.prepareForReuse();
      view.container.visible = false;
    }
    this.activeEntityIds.clear();
    this.trailHistory.clear();
    this.knockbackTrails.clear();
    this.projectileDebugHistory.clear();
    this.clearFloatingCombatTexts();
    this.trailGraphics.clear();
    this.projectileGraphics.clear();
    this.trainingDebugGraphics.clear();
    this.playerTargetingGraphics.clear();
    this.obstacleGraphics.clear();
    this.invalidateObstacleCache();
    this.screenFlashGraphics.clear();
    this.fx?.reset();
    this.legacyFxSuppressed = false;
    this.layeredFx?.reset();
    this.telegraphs.reset();
    this.shake = 0;
    this.freezeMs = 0;
    this.missileCascadeTracker.reset();
    this.screenFlash = 0;
    this.playerHitmarkerFlash = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRoot.position.set(0, 0);
    this.cameraNeedsSnap = true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeRaf !== 0) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = 0;
    window.removeEventListener('resize', this.handleViewportResize);
    window.removeEventListener('orientationchange', this.handleViewportResize);
    window.visualViewport?.removeEventListener('resize', this.handleViewportResize);
    if (this.initialized) {
      this.app.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      this.app.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      this.reset();
    }
    for (const view of this.fighterViews.values()) view.destroy();
    this.fighterViews.clear();
    this.layeredFx?.destroy();
    this.layeredFx = null;
    if (this.initialized) this.app.destroy(true, { children: true });
    this.initialized = false;
    this.fx = null;
    this.host = null;
  }

  private updateKnockbackTrailState(events: readonly SimulationEvent[], dtSeconds: number): void {
    for (const [entityId, state] of this.knockbackTrails) {
      state.life -= dtSeconds;
      if (state.life <= 0) {
        this.knockbackTrails.delete(entityId);
        this.trailHistory.delete(entityId);
      }
    }
    for (const event of events) {
      if (event.type === 'knockbackApplied' && event.force >= 5.5) {
        const maxLife = Math.min(4.8, 0.75 + event.force * 0.055);
        const current = this.knockbackTrails.get(event.targetId);
        this.knockbackTrails.set(event.targetId, {
          life: Math.max(current?.life ?? 0, maxLife),
          maxLife: Math.max(current?.maxLife ?? 0, maxLife),
          strength: Math.max(current?.strength ?? 0, event.force)
        });
      } else if ((event.type === 'wallImpact' || event.type === 'obstacleImpact') && this.knockbackTrails.has(event.entityId)) {
        const current = this.knockbackTrails.get(event.entityId)!;
        current.life = Math.max(current.life, 0.7);
        current.strength = Math.max(current.strength, event.magnitude);
      } else if (event.type === 'death') {
        this.knockbackTrails.delete(event.entityId);
      }
    }
  }

  private updateTrail(entity: EntitySnapshot, alpha: number): void {
    const x = entity.prevX + (entity.x - entity.prevX) * alpha;
    const y = entity.prevY + (entity.y - entity.prevY) * alpha;
    const history = this.trailHistory.get(entity.id) ?? [];
    const last = history.at(-1);
    if (!last || Math.hypot(x - last.x, y - last.y) > 3) {
      history.push({ x, y });
      if (history.length > 16) history.shift();
      this.trailHistory.set(entity.id, history);
    }
  }

  private drawTrails(snapshot: WorldSnapshot): void {
    this.trailGraphics.clear();
    if (!this.settings.trails || this.settings.renderProfile === 'debug') return;
    const snapshotMap = this.entityByIdScratch;
    snapshotMap.clear();
    for (const entity of snapshot.entities) snapshotMap.set(entity.id, entity);
    for (const [id, points] of this.trailHistory) {
      if (points.length < 2) continue;
      const entity = snapshotMap.get(id);
      if (!entity) continue;
      const fighter = getFighter(entity.fighterId);
      const color = elementColor(fighter.classification.elements[0] ?? 'neutral');
      for (let index = 1; index < points.length; index += 1) {
        const a = points[index - 1];
        const b = points[index];
        if (!a || !b) continue;
        const progress = index / points.length;
        const knockback = this.knockbackTrails.get(id);
        if (knockback) {
          const lifeRatio = Math.max(0, Math.min(1, knockback.life / Math.max(0.001, knockback.maxLife)));
          const strengthScale = Math.min(1.8, 0.7 + knockback.strength / 35);
          this.trailGraphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
            color,
            width: (5 + progress * 10) * strengthScale,
            alpha: progress * 0.22 * lifeRatio
          });
          this.trailGraphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
            color: 0xffffff,
            width: (1.8 + progress * 4.5) * strengthScale,
            alpha: progress * 0.62 * lifeRatio
          });
          if (index % 3 === 0) this.trailGraphics.circle(b.x, b.y, 2.5 + progress * 3.5).fill({ color, alpha: 0.24 * lifeRatio });
        } else {
          this.trailGraphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width: 1.5 + progress * 5, alpha: progress * 0.3 });
        }
      }
    }
  }


  private drawProjectiles(projectiles: readonly ProjectileSnapshot[], alpha: number): void {
    this.projectileGraphics.clear();
    for (const projectile of projectiles) {
      const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
      const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha - projectile.arcHeight;
      const weapon = getProjectileSource(projectile.weaponId);
      const color = projectile.team === 1 ? 0x72dfff : 0xff8a55;
      if (weapon.form === 'launcher' && weapon.id !== 'demolition-bomb') {
        const dx = Math.cos(projectile.rotation);
        const dy = Math.sin(projectile.rotation);
        const sideX = -dy;
        const sideY = dx;
        const length = Math.max(projectile.radius * 3.2, 22);
        const tailX = x - dx * length * 0.7;
        const tailY = y - dy * length * 0.7;
        this.projectileGraphics.moveTo(tailX + sideX * projectile.radius * 0.72, tailY + sideY * projectile.radius * 0.72)
          .lineTo(x + dx * length * 0.45, y + dy * length * 0.45)
          .lineTo(tailX - sideX * projectile.radius * 0.72, tailY - sideY * projectile.radius * 0.72)
          .closePath().fill({ color: 0xdce8ef, alpha: 0.98 });
        this.projectileGraphics.moveTo(tailX, tailY).lineTo(tailX - dx * projectile.radius * 1.4, tailY - dy * projectile.radius * 1.4)
          .stroke({ color: 0xffa13c, width: Math.max(3, projectile.radius * 0.55), alpha: 0.92 });
        this.projectileGraphics.circle(x + dx * length * 0.35, y + dy * length * 0.35, Math.max(2.5, projectile.radius * 0.34)).fill({ color: 0xff6538, alpha: 0.95 });
        continue;
      }
      if (weapon.id === 'demolition-bomb') {
        const pulse = projectile.fuseRemainingTicks > 0 ? 0.65 + Math.sin(this.elapsedSeconds * 14) * 0.25 : 1;
        this.projectileGraphics.circle(x, y, projectile.radius * 1.4).fill({ color: 0x151821, alpha: 0.98 });
        this.projectileGraphics.circle(x, y, projectile.radius * 0.92).stroke({ color: 0xff8a37, width: 3, alpha: 0.95 });
        const fuseX = x + Math.cos(projectile.rotation - 1.1) * projectile.radius * 1.1;
        const fuseY = y + Math.sin(projectile.rotation - 1.1) * projectile.radius * 1.1;
        this.projectileGraphics.moveTo(x, y).lineTo(fuseX, fuseY).stroke({ color: 0xc8b08a, width: 3, alpha: 0.9 });
        this.projectileGraphics.circle(fuseX, fuseY, 3 + pulse * 2).fill({ color: 0xffdd68, alpha: 1 });
        this.projectileGraphics.circle(x, projectile.y + projectile.radius * 0.75, projectile.radius * 0.8).fill({ color: 0x000000, alpha: 0.18 });
        continue;
      }
      const length = Math.max(12, Math.hypot(projectile.vx, projectile.vy) * 2.2);
      const dx = Math.cos(projectile.rotation);
      const dy = Math.sin(projectile.rotation);
      this.projectileGraphics.moveTo(x - dx * length, y - dy * length).lineTo(x + dx * projectile.radius, y + dy * projectile.radius)
        .stroke({ color, width: Math.max(3, projectile.radius * 0.75), alpha: 0.72 });
      this.projectileGraphics.circle(x, y, projectile.radius).fill({ color: 0xeaffff, alpha: 0.95 });
    }
  }

  private consumeTrainingDamageEvents(events: readonly SimulationEvent[], snapshot: WorldSnapshot): void {
    if (!this.trainingDebug.enabled || !this.trainingDebug.showDamageNumbers) return;
    const entityMap = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
    for (const event of events) {
      if (event.type !== 'damage') continue;
      const target = entityMap.get(event.targetId);
      const position = event.position ?? (target ? { x: target.x, y: target.y } : null);
      if (!position) continue;
      const text = event.prevented ? `TEST ${event.amount.toFixed(1)}` : `-${event.amount.toFixed(1)}`;
      const node = new Text({
        text,
        style: {
          fill: event.prevented ? 0x9ff6ff : 0xffe083,
          fontSize: 18,
          fontWeight: '900',
          fontFamily: 'Inter, system-ui',
          stroke: { color: 0x07101b, width: 5 }
        }
      });
      node.anchor.set(0.5);
      node.position.set(position.x, position.y - (target?.radius ?? 24) - 18);
      this.combatTextLayer.addChild(node);
      this.floatingCombatTexts.push({ node, life: 0.9, maxLife: 0.9, rise: 42 });
      if (this.floatingCombatTexts.length > 40) {
        const oldest = this.floatingCombatTexts.shift();
        oldest?.node.destroy();
      }
    }
  }

  private updateFloatingCombatTexts(dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    for (let index = this.floatingCombatTexts.length - 1; index >= 0; index -= 1) {
      const item = this.floatingCombatTexts[index];
      if (!item) continue;
      item.life -= dt;
      item.node.y -= item.rise * dt;
      item.node.alpha = Math.max(0, item.life / item.maxLife);
      item.node.scale.set(1 + (1 - item.life / item.maxLife) * 0.08);
      if (item.life <= 0) {
        item.node.destroy();
        this.floatingCombatTexts.splice(index, 1);
      }
    }
  }

  private clearFloatingCombatTexts(): void {
    for (const item of this.floatingCombatTexts) item.node.destroy();
    this.floatingCombatTexts.length = 0;
  }

  private drawTrainingDebug(snapshot: WorldSnapshot, alpha: number): void {
    this.trainingDebugGraphics.clear();
    if (!this.trainingDebug.enabled) return;

    const focus = snapshot.entities.find((entity) => entity.id === this.trainingDebug.focusEntityId)
      ?? snapshot.entities.find((entity) => entity.controller === 'player');

    if (this.trainingDebug.showProjectilePaths) {
      const activeProjectileIds = new Set<number>();
      for (const projectile of snapshot.projectiles) {
        activeProjectileIds.add(projectile.id);
        const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
        const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha - projectile.arcHeight;
        const history = this.projectileDebugHistory.get(projectile.id) ?? [];
        const last = history.at(-1);
        if (!last || Math.hypot(x - last.x, y - last.y) > 2) {
          history.push({ x, y });
          if (history.length > 64) history.shift();
          this.projectileDebugHistory.set(projectile.id, history);
        }
      }
      for (const id of [...this.projectileDebugHistory.keys()]) if (!activeProjectileIds.has(id)) this.projectileDebugHistory.delete(id);
      for (const [id, points] of this.projectileDebugHistory) {
        if (points.length < 2) continue;
        const projectile = snapshot.projectiles.find((item) => item.id === id);
        const color = projectile?.team === 1 ? 0x7ee8ff : 0xff9a72;
        for (let index = 1; index < points.length; index += 1) {
          const start = points[index - 1];
          const end = points[index];
          if (!start || !end) continue;
          const progress = index / points.length;
          this.trainingDebugGraphics.moveTo(start.x, start.y).lineTo(end.x, end.y)
            .stroke({ color, width: 1.5 + progress * 1.5, alpha: 0.12 + progress * 0.42 });
        }
      }
    } else {
      this.projectileDebugHistory.clear();
    }

    if (this.trainingDebug.showHitboxes) {
      for (const entity of snapshot.entities) {
        const color = entity.id === focus?.id ? 0xffffff : entity.team === 1 ? 0x62d9ff : 0xff785f;
        this.trainingDebugGraphics.circle(entity.x, entity.y, entity.radius)
          .stroke({ color, width: entity.id === focus?.id ? 3 : 2, alpha: 0.78 });
        this.trainingDebugGraphics.moveTo(entity.x - 5, entity.y).lineTo(entity.x + 5, entity.y)
          .moveTo(entity.x, entity.y - 5).lineTo(entity.x, entity.y + 5)
          .stroke({ color, width: 1.5, alpha: 0.72 });
        if (entity.weaponAttack) {
          const weapon = getPrimaryAttack(entity.weaponAttack.weaponId);
          const facing = Math.atan2(entity.weaponAttack.direction.y, entity.weaponAttack.direction.x);
          this.drawDebugArc(entity.x, entity.y, weapon.range, facing, weapon.attackAngleDegrees, color, 0.58);
        }
      }
      for (const projectile of snapshot.projectiles) {
        const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
        const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha - projectile.arcHeight;
        const color = projectile.team === 1 ? 0x72eaff : 0xff896f;
        this.trainingDebugGraphics.circle(x, y, projectile.radius).stroke({ color, width: 2, alpha: 0.9 });
        this.trainingDebugGraphics.moveTo(x, y).lineTo(x + projectile.vx * 3, y + projectile.vy * 3)
          .stroke({ color, width: 1.5, alpha: 0.65 });
      }
    }

    if (this.trainingDebug.showRange && focus) {
      const fighter = getFighter(focus.fighterId);
      const rangeColor = elementColor(fighter.classification.elements[0] ?? 'neutral');
      const selectedSlot = this.trainingDebug.selectedSlot;
      const primaryAttack = selectedSlot === 'basic' ? getPrimaryAttack(fighter.primaryAttackId) : null;
      const abilityId = selectedSlot === 'basic' ? null : fighter.abilitySlots[selectedSlot];
      const activation = primaryAttack
        ? { minRange: primaryAttack.minRange, maxRange: primaryAttack.range }
        : abilityId
          ? getAbilityActivationProfile(getAbility(abilityId), fighter)
          : null;
      if (activation) {
        const maxVisibleRange = Math.min(Math.hypot(this.arena.width, this.arena.height), activation.maxRange);
        if (Number.isFinite(maxVisibleRange) && maxVisibleRange < 9000) {
          this.trainingDebugGraphics.circle(focus.x, focus.y, maxVisibleRange)
            .fill({ color: rangeColor, alpha: 0.025 })
            .stroke({ color: rangeColor, width: 3, alpha: 0.55 });
        }
        if (activation.minRange > 0 && activation.minRange < 9000) {
          this.trainingDebugGraphics.circle(focus.x, focus.y, activation.minRange)
            .stroke({ color: 0xffb86b, width: 2, alpha: 0.72 });
        }
        if (primaryAttack) {
          const direction = focus.weaponAttack?.direction ?? { x: Math.cos(focus.rotation), y: Math.sin(focus.rotation) };
          const facing = Math.atan2(direction.y, direction.x);
          this.drawDebugArc(focus.x, focus.y, primaryAttack.range, facing, primaryAttack.attackAngleDegrees, rangeColor, 0.82);
        }
      }
    }
  }

  private drawDebugArc(x: number, y: number, radius: number, facing: number, angleDegrees: number, color: number, alpha: number): void {
    const half = Math.max(1, Math.min(360, angleDegrees)) * Math.PI / 360;
    const start = facing - half;
    const end = facing + half;
    const segments = Math.max(8, Math.ceil((end - start) / (Math.PI / 24)));
    this.trainingDebugGraphics.moveTo(x, y);
    for (let index = 0; index <= segments; index += 1) {
      const angle = start + ((end - start) * index) / segments;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (index === 0) this.trainingDebugGraphics.lineTo(px, py);
      else this.trainingDebugGraphics.lineTo(px, py);
    }
    this.trainingDebugGraphics.lineTo(x, y).stroke({ color, width: 2, alpha });
  }

  private readonly handleViewportResize = (): void => {
    this.queueRendererResize(false);
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.diagnostics = { ...this.diagnostics, contextLost: true };
  };

  private readonly handleContextRestored = (): void => {
    this.contextLost = false;
    this.diagnostics = { ...this.diagnostics, contextLost: false };
    this.drawArena();
    this.queueRendererResize(true);
  };

  private bindResizeObserver(host: HTMLElement): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => this.queueRendererResize(false))
      : null;
    this.resizeObserver?.observe(host, { box: 'content-box' });
  }

  private drawPlayerTargeting(snapshot: WorldSnapshot, alpha: number): void {
    this.playerTargetingGraphics.clear();
    if (!this.pointerAimEnabled) return;
    const player = snapshot.entities.find((entity) => entity.controller === 'player');
    if (!player || !this.playerAimPoint) return;
    const x = player.prevX + (player.x - player.prevX) * alpha;
    const y = player.prevY + (player.y - player.prevY) * alpha;
    const preview = resolvePlayerTargetingPreview(player, this.playerPreviewSlot);
    const validity = evaluatePlayerAim(snapshot, player, this.playerAimPoint, preview);
    const color = validity.valid ? 0x72f2a0 : validity.reason === 'too-close' ? 0xffc05c : 0xff5b68;
    if (preview.finiteRange && preview.maxRange > 0) {
      this.playerTargetingGraphics.circle(x, y, preview.maxRange).fill({ color, alpha: 0.012 }).stroke({ color, width: 2, alpha: 0.38 });
      if (preview.minRange > 0) this.playerTargetingGraphics.circle(x, y, preview.minRange).stroke({ color: 0xffb85b, width: 1.6, alpha: 0.5 });
    } else if (preview.targeting === 'self') {
      this.playerTargetingGraphics.circle(x, y, player.radius * 1.75).stroke({ color, width: 2.5, alpha: 0.55 });
    }
    const aimDx = this.playerAimPoint.x - x;
    const aimDy = this.playerAimPoint.y - y;
    const aimLength = Math.hypot(aimDx, aimDy) || 1;
    const nx = aimDx / aimLength;
    const ny = aimDy / aimLength;
    const arrowDistance = player.radius * 1.78;
    const arrowX = x + nx * arrowDistance;
    const arrowY = y + ny * arrowDistance;
    const sideX = -ny;
    const sideY = nx;
    this.playerTargetingGraphics.moveTo(arrowX + nx * 11, arrowY + ny * 11)
      .lineTo(arrowX - nx * 8 + sideX * 7, arrowY - ny * 8 + sideY * 7)
      .lineTo(arrowX - nx * 8 - sideX * 7, arrowY - ny * 8 - sideY * 7)
      .closePath().fill({ color, alpha: 0.96 });
    const crossX = this.playerAimPoint.x;
    const crossY = this.playerAimPoint.y;
    const crossRadius = preview.targeting === 'area' ? 15 : 10;
    this.playerTargetingGraphics.circle(crossX, crossY, crossRadius).stroke({ color, width: 2.4, alpha: 0.94 });
    this.playerTargetingGraphics.moveTo(crossX - crossRadius - 7, crossY).lineTo(crossX - 3, crossY).stroke({ color, width: 2, alpha: 0.9 });
    this.playerTargetingGraphics.moveTo(crossX + 3, crossY).lineTo(crossX + crossRadius + 7, crossY).stroke({ color, width: 2, alpha: 0.9 });
    this.playerTargetingGraphics.moveTo(crossX, crossY - crossRadius - 7).lineTo(crossX, crossY - 3).stroke({ color, width: 2, alpha: 0.9 });
    this.playerTargetingGraphics.moveTo(crossX, crossY + 3).lineTo(crossX, crossY + crossRadius + 7).stroke({ color, width: 2, alpha: 0.9 });
    if (preview.targeting === 'area') this.playerTargetingGraphics.circle(crossX, crossY, Math.min(110, Math.max(28, preview.maxRange * 0.14))).stroke({ color, width: 1.3, alpha: 0.3 });
    if (this.playerHitmarkerFlash > 0.02) {
      const markerAlpha = Math.min(1, this.playerHitmarkerFlash);
      const markerRadius = 12 + markerAlpha * 5;
      this.playerTargetingGraphics.moveTo(crossX - markerRadius, crossY - markerRadius).lineTo(crossX - 4, crossY - 4)
        .moveTo(crossX + markerRadius, crossY - markerRadius).lineTo(crossX + 4, crossY - 4)
        .moveTo(crossX - markerRadius, crossY + markerRadius).lineTo(crossX - 4, crossY + 4)
        .moveTo(crossX + markerRadius, crossY + markerRadius).lineTo(crossX + 4, crossY + 4)
        .stroke({ color: 0xffffff, width: 3.4, alpha: markerAlpha });
    }
    this.playerHitmarkerFlash *= 0.82;
  }

  private ensureCanvasMounted(): void {
    if (!this.initialized || !this.host) return;
    if (this.app.canvas.parentElement !== this.host) this.host.replaceChildren(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.visibility = this.active ? 'visible' : 'hidden';
  }

  private queueRendererResize(force = false): void {
    if (!this.initialized) return;
    this.resizeForcePending ||= force;
    if (this.resizeRaf !== 0) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      const shouldForce = this.resizeForcePending;
      this.resizeForcePending = false;
      this.syncRendererSize(shouldForce);
    });
  }

  private resolveResolution(): number {
    const adaptiveScale = this.settings?.adaptiveQuality
      ? 0.58 + this.performanceScale * 0.42
      : 1;
    return resolveCanvasResolution({
      devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
      maxDevicePixelRatio: this.settings?.maxDevicePixelRatio ?? 1,
      renderScale: this.settings?.renderScale ?? 1,
      adaptiveScale
    }).effectiveResolution;
  }

  private syncRendererSize(force: boolean): void {
    if (!this.initialized || !this.host || this.contextLost) return;
    const rect = this.host.getBoundingClientRect();
    const measuredWidth = rect.width || this.host.clientWidth;
    const measuredHeight = rect.height || this.host.clientHeight;
    if (measuredWidth < 2 || measuredHeight < 2) return;
    const width = Math.max(1, Math.round(measuredWidth));
    const height = Math.max(1, Math.round(measuredHeight));
    const resolution = this.resolveResolution();
    const widthDelta = Math.abs(width - this.lastHostWidth);
    const heightDelta = Math.abs(height - this.lastHostHeight);
    const sizeChanged = force
      ? widthDelta > 0 || heightDelta > 0
      : widthDelta >= 2 || heightDelta >= 2;
    const resolutionChanged = Math.abs(resolution - this.lastResolution) >= 0.01;
    if (!sizeChanged && !resolutionChanged) return;
    this.lastHostWidth = width;
    this.lastHostHeight = height;
    this.lastResolution = resolution;
    this.app.renderer.resolution = resolution;
    this.app.renderer.resize(width, height);
    this.resizeCount += 1;
    this.fitWorld();
    this.cameraNeedsSnap = true;
    this.snapCameraToCurrentTarget();
  }

  private drawArena(): void {
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

  private drawObstacles(snapshot: WorldSnapshot): void {
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

  private invalidateObstacleCache(): void {
    this.obstacleCacheArenaId = '';
    this.obstacleCacheProfile = '';
    this.obstacleCacheLength = -1;
    this.obstacleCacheIds.length = 0;
    this.obstacleCacheHp.length = 0;
    this.obstacleCacheAlive.length = 0;
  }

  private drawScreenFlash(dtMs: number): void {
    this.screenFlashGraphics.clear();
    if (!this.settings.effects || !this.settings.screenFlash || this.screenFlash <= 0.005) {
      this.screenFlash = 0;
      return;
    }
    this.screenFlashGraphics.rect(0, 0, this.app.screen.width, this.app.screen.height).fill({ color: 0xffffff, alpha: this.screenFlash * 0.16 });
    this.screenFlash *= Math.pow(0.78, Math.max(1, dtMs / 16.67));
  }

  private fitWorld(): void {
    if (!this.arena) return;
    const fit = calculateArenaFit(this.app.screen.width, this.app.screen.height, this.arena.width, this.arena.height);
    this.baseScale = fit.scale;
    this.baseX = fit.x;
    this.baseY = fit.y;
  }

  private cameraTarget(focus: Vec2 | null): { scale: number; x: number; y: number } {
    return calculateCameraTarget({
      viewportWidth: this.app.screen.width,
      viewportHeight: this.app.screen.height,
      arenaWidth: this.arena.width,
      arenaHeight: this.arena.height,
      baseScale: this.baseScale,
      focus,
      follow: this.settings.cameraFollow,
      reducedMotion: this.settings.reducedMotion
    });
  }

  private snapCameraToCurrentTarget(): void {
    if (!this.initialized || !this.arena || !this.settings) return;
    const focus = this.settings.cameraFollow ? this.lastFocusPosition : null;
    const target = this.cameraTarget(focus);
    this.cameraScale = target.scale;
    this.cameraX = target.x;
    this.cameraY = target.y;
    this.cameraRoot.scale.set(this.cameraScale);
    this.cameraRoot.position.set(this.cameraX, this.cameraY);
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRoot.position.set(0, 0);
    this.cameraNeedsSnap = false;
  }

  private updateCamera(snapshot: WorldSnapshot): void {
    if (!this.settings.cameraShake || this.settings.reducedMotion) this.shake = 0;
    const focusEntity = this.settings.cameraFollow && this.focusEntityId !== null
      ? snapshot.entities.find((entity) => entity.id === this.focusEntityId)
      : undefined;
    this.lastFocusPosition = focusEntity ? { x: focusEntity.x, y: focusEntity.y } : null;
    const target = this.cameraTarget(this.lastFocusPosition);

    if (this.cameraNeedsSnap) {
      this.cameraScale = target.scale;
      this.cameraX = target.x;
      this.cameraY = target.y;
      this.cameraNeedsSnap = false;
    } else {
      this.cameraScale += (target.scale - this.cameraScale) * 0.08;
      this.cameraX += (target.x - this.cameraX) * 0.1;
      this.cameraY += (target.y - this.cameraY) * 0.1;
    }

    const amount = this.shake * this.cameraScale;
    const screenOffsetX = amount > 0.05 ? (Math.random() * 2 - 1) * amount : 0;
    const screenOffsetY = amount > 0.05 ? (Math.random() * 2 - 1) * amount : 0;
    this.shakeOffsetX = screenOffsetX / Math.max(0.0001, this.cameraScale);
    this.shakeOffsetY = screenOffsetY / Math.max(0.0001, this.cameraScale);
    this.cameraRoot.scale.set(this.cameraScale);
    this.cameraRoot.position.set(this.cameraX, this.cameraY);
    this.shakeRoot.position.set(this.shakeOffsetX, this.shakeOffsetY);
    this.worldRoot.position.set(0, 0);
    this.worldRoot.scale.set(1);
    this.shake *= 0.82;
  }

}
