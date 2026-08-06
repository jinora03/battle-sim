import { Container, Graphics } from 'pixi.js';
import { classifyBlast, isMissileCascadeFrame, isMissileWeapon, shouldPresentDamage } from './combatFeedback';
import { getPrimaryAttack, getProjectileSource, type ArenaDefinition } from '@kinetic/content';
import type { EntitySnapshot, ProjectileSnapshot, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import {
  getAbilityCombatVfxProfile,
  getElementVfxPalette,
  getWeaponVfxRecipe,
  resolveCombatVfxLayer,
  resolveCombatVfxParticleStyle,
  resolveVisualRadius,
  type ResolvedCombatVfxLayer,
  type VfxParticleShape,
  type VfxQualityProfile
} from '@kinetic/visual-engine';

export interface LayeredVfxLayers {
  arena: Container;
  world: Container;
  fighter: Container;
  weapon: Container;
  projectile: Container;
  foreground: Container;
}

export interface LayeredVfxDiagnostics {
  activeGroundMarks: number;
  activeResiduals: number;
  activeWeaponEffects: number;
  projectileTrails: number;
}

export interface LayeredVfxBudget {
  maxResidualEffects: number;
  maxWeaponEffects: number;
  maxGroundMarks: number;
}

const UNLIMITED_VFX_BUDGET: LayeredVfxBudget = {
  maxResidualEffects: Number.POSITIVE_INFINITY,
  maxWeaponEffects: Number.POSITIVE_INFINITY,
  maxGroundMarks: Number.POSITIVE_INFINITY
};

interface TimedGraphic {
  node: Graphics;
  active: boolean;
  life: number;
  maxLife: number;
}

interface ResidualParticle extends TimedGraphic {
  vx: number;
  vy: number;
  drag: number;
  growth: number;
  spin: number;
}

interface ProjectileTrailPoint {
  x: number;
  y: number;
}

interface HitPulse {
  entityId: number;
  color: number;
  life: number;
  maxLife: number;
}

interface ScheduledLayeredCombatVfx {
  remainingSeconds: number;
  layer: ResolvedCombatVfxLayer;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
}

const STATUS_COLORS: Record<string, number> = {
  burn: 0xff6a2f,
  wet: 0x48d9ff,
  frozen: 0xbff7ff,
  shocked: 0xffef55,
  rooted: 0x7bd15d,
  'void-mark': 0xae68ff,
  fortified: 0xb8d9e8,
  'molten-guard': 0xff7b35,
  barkskin: 0x8fc76a,
  overcharged: 0xc7fbff,
  phased: 0xb77cff
};

function drawParticleShape(node: Graphics, shape: VfxParticleShape, size: number, color: number, alpha: number): void {
  node.clear();
  if (shape === 'smoke' || shape === 'droplet') {
    node.circle(0, 0, size * (shape === 'smoke' ? 1.75 : 0.82)).fill({ color, alpha: shape === 'smoke' ? alpha * 0.52 : alpha });
    return;
  }
  if (shape === 'debris' || shape === 'shard') {
    node.moveTo(0, -size * 1.35)
      .lineTo(size * 0.52, size * 0.72)
      .lineTo(-size * 0.38, size)
      .lineTo(0, -size * 1.35)
      .fill({ color, alpha });
    return;
  }
  if (shape === 'ember') {
    node.moveTo(0, -size)
      .lineTo(size * 0.62, 0)
      .lineTo(0, size)
      .lineTo(-size * 0.62, 0)
      .lineTo(0, -size)
      .fill({ color, alpha });
    return;
  }
  if (shape === 'flame') {
    node.moveTo(0, size * 1.2)
      .quadraticCurveTo(size * 0.95, size * 0.12, size * 0.18, -size * 1.45)
      .quadraticCurveTo(-size * 0.78, -size * 0.18, 0, size * 1.2)
      .fill({ color, alpha });
    return;
  }
  if (shape === 'arc' || shape === 'ribbon' || shape === 'ring-fragment') {
    const bend = shape === 'ring-fragment' ? size * 0.92 : shape === 'ribbon' ? size * 0.62 : size * 0.42;
    node.moveTo(-size * 1.25, size * 0.25)
      .quadraticCurveTo(0, -bend, size * 1.25, -size * 0.2)
      .stroke({ color, width: Math.max(1.4, size * (shape === 'ribbon' ? 0.42 : 0.34)), alpha });
    return;
  }
  if (shape === 'wedge') {
    node.moveTo(size * 1.45, 0)
      .lineTo(-size * 0.9, -size * 0.72)
      .lineTo(-size * 0.45, 0)
      .lineTo(-size * 0.9, size * 0.72)
      .lineTo(size * 1.45, 0)
      .fill({ color, alpha });
    return;
  }
  node.moveTo(-size * 1.25, 0).lineTo(size * 1.45, 0).stroke({
    color,
    width: Math.max(1.5, size * (shape === 'streak' ? 0.42 : 0.32)),
    alpha
  });
}


export class LayeredVfxEngine {
  private readonly groundMarks: TimedGraphic[] = [];
  private readonly weaponEffects: TimedGraphic[] = [];
  private readonly residuals: ResidualParticle[] = [];
  private readonly projectileTrails = new Map<number, ProjectileTrailPoint[]>();
  private readonly hitPulses: HitPulse[] = [];
  private readonly scheduledCombatVfx: ScheduledLayeredCombatVfx[] = [];
  private readonly projectileTrailGraphics = new Graphics();
  private readonly fighterAnchorGraphics = new Graphics();
  private readonly weaponAnchorGraphics = new Graphics();
  private readonly arenaAmbientGraphics = new Graphics();
  private noiseState = 0x6d2b79f5;
  private quality!: VfxQualityProfile;
  private budget: LayeredVfxBudget = UNLIMITED_VFX_BUDGET;

  constructor(private readonly layers: LayeredVfxLayers, private arena: ArenaDefinition) {
    layers.projectile.addChild(this.projectileTrailGraphics);
    layers.fighter.addChild(this.fighterAnchorGraphics);
    layers.weapon.addChild(this.weaponAnchorGraphics);
    layers.arena.addChild(this.arenaAmbientGraphics);
    for (let index = 0; index < 72; index += 1) {
      const node = new Graphics();
      node.visible = false;
      layers.arena.addChild(node);
      this.groundMarks.push({ node, active: false, life: 0, maxLife: 1 });
    }
    for (let index = 0; index < 48; index += 1) {
      const node = new Graphics();
      node.visible = false;
      layers.weapon.addChild(node);
      this.weaponEffects.push({ node, active: false, life: 0, maxLife: 1 });
    }
    for (let index = 0; index < 220; index += 1) {
      const node = new Graphics();
      node.visible = false;
      layers.world.addChild(node);
      this.residuals.push({ node, active: false, life: 0, maxLife: 1, vx: 0, vy: 0, drag: 0.96, growth: 0, spin: 0 });
    }
  }

  setArena(arena: ArenaDefinition): void {
    this.arena = arena;
    this.drawArenaAmbient(0);
  }

  consume(events: readonly SimulationEvent[], snapshot: WorldSnapshot, quality: VfxQualityProfile, budget: LayeredVfxBudget = UNLIMITED_VFX_BUDGET): void {
    this.quality = quality;
    this.budget = budget;
    const entities = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
    const crowd = snapshot.entities.length > 48;
    const useProfileVfx = snapshot.entities.length > 40 || quality.tier === 'low';
    const missileCascadeFrame = isMissileCascadeFrame(events);
    let crowdEffects = 0;
    let missileDamageFx = 0;
    let missileHitFx = 0;
    let missileBlastFx = 0;
    let missileKnockbackFx = 0;
    const crowdBudget = quality.tier === 'low' ? 10 : 18;
    for (const event of events) {
      if (missileCascadeFrame) {
        if (event.type === 'damage' && ++missileDamageFx > 10) continue;
        if (event.type === 'weaponHit' && isMissileWeapon(event.weaponId) && ++missileHitFx > 6) continue;
        if (event.type === 'blast' && isMissileWeapon(event.abilityId ?? '') && ++missileBlastFx > 10) continue;
        if (event.type === 'knockbackApplied' && ++missileKnockbackFx > 10) continue;
      }
      if (crowd) {
        const sourceId = event.type === 'weaponAttackStarted' || event.type === 'abilityActivated' || event.type === 'abilityResolved'
          ? event.entityId
          : event.type === 'weaponHit' || event.type === 'projectileImpact' || event.type === 'damage'
            ? event.sourceId ?? null
            : null;
        const sourceIsPlayer = sourceId !== null && entities.get(sourceId)?.controller === 'player';
        const abilityProfile = event.type === 'abilityActivated' || event.type === 'abilityResolved'
          ? getAbilityCombatVfxProfile(event.abilityId)
          : undefined;
        const important = sourceIsPlayer
          || abilityProfile?.hierarchy === 'ultimate'
          || event.type === 'blast'
          || event.type === 'death'
          || event.type === 'obstacleDestroyed';
        if (!important && crowdEffects >= crowdBudget) continue;
        if (event.type === 'wallImpact' && event.magnitude < 9) continue;
        if (event.type === 'weaponHit' && quality.tier === 'low') continue;
        crowdEffects += 1;
      }
      if (useProfileVfx && event.type === 'abilityActivated' && this.scheduleAbilityCombatVfx(
        event.abilityId,
        'activated',
        event.position.x,
        event.position.y,
        event.direction.x,
        event.direction.y,
        event.castTicks
      )) {
        continue;
      }
      if (useProfileVfx && event.type === 'abilityResolved' && this.scheduleAbilityCombatVfx(
        event.abilityId,
        'resolved',
        event.position.x,
        event.position.y,
        event.direction.x,
        event.direction.y,
        0
      )) {
        continue;
      }
      if (event.type === 'weaponAttackStarted') {
        const weapon = getPrimaryAttack(event.weaponId);
        const recipe = getWeaponVfxRecipe(event.weaponId);
        this.spawnWeaponEffect(event.position.x, event.position.y, event.direction.x, event.direction.y, weapon.range, weapon.attackAngleDegrees, recipe.trailShape, recipe.trailColor);
        if (recipe.muzzleFlash) {
          const length = Math.hypot(event.direction.x, event.direction.y) || 1;
          this.spawnCoreFlash(event.position.x + event.direction.x / length * 58, event.position.y + event.direction.y / length * 58, recipe.impactColor, 16, 0.1);
        }
      } else if (event.type === 'damage' && shouldPresentDamage(event)) {
        const palette = getElementVfxPalette(event.element);
        this.hitPulses.push({ entityId: event.targetId, color: palette.accent, life: 0.2, maxLife: 0.2 });
        const position = event.position ?? entities.get(event.targetId);
        if (position) {
          this.spawnCoreFlash(position.x, position.y, palette.glow, Math.min(20, 8 + event.amount * 0.35), 0.08);
          this.spawnResidualBurst(position.x, position.y, palette.accent, event.element === 'ice' ? 'shard' : event.element === 'water' ? 'droplet' : 'spark', Math.round(Math.min(9, 2 + event.amount * 0.25) * quality.residualMultiplier), 3.6 + Math.min(3.5, event.amount * 0.1));
        }
      } else if (event.type === 'weaponHit') {
        const recipe = getWeaponVfxRecipe(event.weaponId);
        this.hitPulses.push({ entityId: event.targetId, color: recipe.impactColor, life: 0.22, maxLife: 0.22 });
        this.spawnResidualBurst(event.position.x, event.position.y, recipe.impactColor, recipe.residualShape, Math.round((6 + event.damage * 0.45) * quality.residualMultiplier), 5.5 + event.knockback * 0.25);
        this.spawnGroundMark(event.position.x, event.position.y, recipe.groundMark, recipe.trailColor, 15 + event.damage * 0.65);
      } else if (event.type === 'projectileImpact') {
        const recipe = getWeaponVfxRecipe(event.weaponId);
        const source = getProjectileSource(event.weaponId);
        const explosive = (source.projectile?.explosionRadius ?? 0) > 0;
        // Explosive projectiles receive their full visual payload from the
        // semantic blast event. Keeping impact light avoids double-spawning
        // particles and ground marks for every missile in a barrage.
        this.spawnCoreFlash(event.position.x, event.position.y, recipe.impactColor, explosive ? 8 : 14, explosive ? 0.06 : 0.1);
        if (!explosive) {
          this.spawnResidualBurst(event.position.x, event.position.y, recipe.impactColor, recipe.residualShape, Math.round(10 * quality.residualMultiplier), 5.8);
          this.spawnGroundMark(event.position.x, event.position.y, recipe.groundMark, recipe.trailColor, 18);
        }
      } else if (event.type === 'blast') {
        const profile = event.abilityId ? getAbilityCombatVfxProfile(event.abilityId) : undefined;
        const basePalette = getElementVfxPalette(profile?.palette ?? event.element);
        const palette = { ...basePalette, ...profile?.colors };
        const activation = profile ? resolveCombatVfxLayer(profile, 'activation') ?? resolveCombatVfxLayer(profile, 'release') : undefined;
        const kind = event.element === 'ice' ? 'frost' : event.element === 'water' ? 'wet' : event.element === 'void' ? 'void' : 'scorch';
        const blastClass = classifyBlast(event);
        const microMissile = blastClass === 'micro-missile';
        const missileBarrage = blastClass !== 'singular';
        const markScale = microMissile ? 0.2 : missileBarrage ? 0.32 : profile?.hierarchy === 'ultimate' ? 0.62 : 0.48;
        const residualBase = microMissile ? 5 : missileBarrage ? 9 : profile?.hierarchy === 'ultimate' ? 30 : event.kind === 'explosion' ? 24 : 14;
        if (!microMissile || quality.tier === 'high') {
          this.spawnGroundMark(event.position.x, event.position.y, kind, palette.groundMark, resolveVisualRadius(event.radius * markScale, quality.tier, profile?.hierarchy === 'ultimate' ? 'ultimate' : 'impact'));
        }
        const shape: VfxParticleShape = event.element === 'fire' ? 'ember' : event.element === 'ice' ? 'shard' : event.element === 'water' ? 'droplet' : 'smoke';
        if (activation?.intent === 'pull') {
          this.spawnInwardResidualBurst(event.position.x, event.position.y, palette.accent, shape, Math.round(residualBase * quality.residualMultiplier), resolveVisualRadius(event.radius * 0.46, quality.tier), 5.2 + event.force * 0.18);
        } else {
          this.spawnResidualBurst(event.position.x, event.position.y, palette.debris, shape, Math.round(residualBase * quality.residualMultiplier), 4.2 + event.force * 0.2);
        }
      } else if (event.type === 'knockbackApplied') {
        const entity = entities.get(event.targetId);
        const palette = getElementVfxPalette(entity?.elements[0] ?? 'neutral');
        const count = Math.round(Math.min(12, 3 + event.force * 0.34) * quality.residualMultiplier);
        this.spawnDirectionalResidualBurst(
          event.position.x,
          event.position.y,
          event.direction.x,
          event.direction.y,
          palette.accent,
          event.kind === 'explosion' ? 'smoke' : 'spark',
          count,
          3.6 + event.force * 0.24
        );
        if (event.force >= 8) this.spawnKnockbackStreak(event.position.x, event.position.y, event.direction.x, event.direction.y, palette.glow, Math.min(70, 22 + event.force * 2.6));
      } else if (event.type === 'wallImpact') {
        const entity = entities.get(event.entityId);
        const palette = getElementVfxPalette(entity?.elements[0] ?? 'neutral');
        if (event.magnitude >= 5) this.spawnGroundMark(event.position.x, event.position.y, 'crack', palette.groundMark, Math.min(32, 10 + event.magnitude));
        this.spawnResidualBurst(event.position.x, event.position.y, palette.debris, 'debris', Math.round(Math.min(9, event.magnitude) * quality.residualMultiplier), 3.4 + event.magnitude * 0.2);
      } else if (event.type === 'obstacleDestroyed') {
        this.spawnGroundMark(event.position.x, event.position.y, 'crack', 0x40362d, 42);
        this.spawnResidualBurst(event.position.x, event.position.y, 0xc3a06e, 'debris', Math.round(28 * quality.residualMultiplier), 8.2);
      } else if (event.type === 'death') {
        const entity = entities.get(event.entityId);
        const palette = getElementVfxPalette(entity?.elements[0] ?? 'neutral');
        this.spawnGroundMark(event.position.x, event.position.y, entity?.elements[0] === 'void' ? 'void' : 'scorch', palette.groundMark, 34);
        this.spawnResidualBurst(event.position.x, event.position.y, palette.accent, entity?.elements[0] === 'ice' ? 'shard' : 'spark', Math.round(22 * quality.residualMultiplier), 8.5);
      }
    }
    while (this.hitPulses.length > 40) this.hitPulses.shift();
    this.enforceGroundMarkLimit(Math.min(quality.maxGroundMarks, budget.maxGroundMarks));
    this.enforceActiveLimit(this.weaponEffects, budget.maxWeaponEffects);
    this.enforceActiveLimit(this.residuals, budget.maxResidualEffects);
  }

  update(snapshot: WorldSnapshot, alpha: number, elapsedSeconds: number, dtSeconds: number, quality: VfxQualityProfile, showTrails: boolean, projectileTrailBudget = Number.POSITIVE_INFINITY, massMode = false): void {
    this.quality = quality;
    this.updateScheduledCombatVfx(dtSeconds);
    this.updateTimedGraphics(dtSeconds);
    this.updateResiduals(dtSeconds);
    if (showTrails) this.updateProjectileTrails(
      snapshot.projectiles,
      alpha,
      quality.trailSamples,
      Math.min(projectileTrailBudget, snapshot.entities.length > 48 && quality.tier === 'low' ? 64 : Number.POSITIVE_INFINITY)
    );
    else { this.projectileTrails.clear(); this.projectileTrailGraphics.clear(); }
    this.drawFighterAnchors(snapshot.entities, elapsedSeconds, dtSeconds, quality, massMode);
    this.drawWeaponAnchors(snapshot.entities, elapsedSeconds, quality, massMode);
    this.drawArenaAmbient(elapsedSeconds);
  }

  getDiagnostics(): LayeredVfxDiagnostics {
    let activeGroundMarks = 0;
    let activeResiduals = 0;
    let activeWeaponEffects = 0;
    for (const mark of this.groundMarks) if (mark.active) activeGroundMarks += 1;
    for (const particle of this.residuals) if (particle.active) activeResiduals += 1;
    for (const effect of this.weaponEffects) if (effect.active) activeWeaponEffects += 1;
    return { activeGroundMarks, activeResiduals, activeWeaponEffects, projectileTrails: this.projectileTrails.size };
  }

  reset(): void {
    this.scheduledCombatVfx.length = 0;
    for (const item of this.groundMarks) this.disable(item);
    for (const item of this.weaponEffects) this.disable(item);
    for (const item of this.residuals) this.disable(item);
    this.projectileTrails.clear();
    this.hitPulses.length = 0;
    this.projectileTrailGraphics.clear();
    this.fighterAnchorGraphics.clear();
    this.weaponAnchorGraphics.clear();
    this.arenaAmbientGraphics.clear();
  }

  destroy(): void {
    this.reset();
  }


  private scheduleAbilityCombatVfx(
    abilityId: string,
    anchor: 'activated' | 'resolved',
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    castTicks: number
  ): boolean {
    const profile = getAbilityCombatVfxProfile(abilityId);
    if (!profile) return false;
    for (const phase of ['anticipation', 'activation', 'sustain', 'release'] as const) {
      const layer = resolveCombatVfxLayer(profile, phase, castTicks);
      if (!layer || layer.anchor !== anchor) continue;
      if (layer.delaySeconds > 0) {
        this.scheduledCombatVfx.push({
          remainingSeconds: layer.delaySeconds,
          layer,
          x,
          y,
          dirX,
          dirY
        });
      } else {
        this.playCombatVfxLayer(layer, x, y, dirX, dirY);
      }
    }
    return true;
  }

  private updateScheduledCombatVfx(dtSeconds: number): void {
    for (let index = this.scheduledCombatVfx.length - 1; index >= 0; index -= 1) {
      const scheduled = this.scheduledCombatVfx[index];
      if (!scheduled) continue;
      scheduled.remainingSeconds -= dtSeconds;
      if (scheduled.remainingSeconds > 0) continue;
      this.playCombatVfxLayer(scheduled.layer, scheduled.x, scheduled.y, scheduled.dirX, scheduled.dirY);
      this.scheduledCombatVfx.splice(index, 1);
    }
  }

  private playCombatVfxLayer(
    layer: ResolvedCombatVfxLayer,
    x: number,
    y: number,
    dirX: number,
    dirY: number
  ): void {
    const basePalette = getElementVfxPalette(layer.palette);
    const palette = { ...basePalette, ...layer.colors };
    const qualityScale = this.quality.tier === 'high' ? 1 : this.quality.tier === 'medium' ? 0.72 : 0.46;
    const count = Math.max(2, Math.round(18 * layer.intensity * this.quality.residualMultiplier));
    const radius = 64 * layer.radiusScale * layer.intensity * qualityScale;
    const glowStrength = layer.hierarchy === 'ultimate' ? 1 : layer.hierarchy === 'payoff' ? 0.78 : 0.56;
    const suppressRadialShells = layer.treatment === 'root-growth' || layer.treatment === 'singularity';
    const style = resolveCombatVfxParticleStyle(layer);
    const shape = style.primary;
    const secondaryShape = style.secondary;
    this.playCombatVfxTreatment(layer, x, y, dirX, dirY, count, radius, palette);

    if (layer.phase === 'anticipation') {
      if (!suppressRadialShells) this.spawnProfileBloom(x, y, palette.core, palette.glow, radius * 0.42, Math.min(0.28, layer.durationSeconds), glowStrength * 0.68);
      if (layer.intent === 'pull') {
        this.spawnInwardResidualBurst(x, y, palette.accent, shape, Math.round(count * 0.72), radius * 0.92, 4.4 * layer.intensity);
      } else {
        this.spawnResidualBurst(x, y, palette.accent, shape, Math.round(count * 0.6), 2.6 * layer.intensity);
      }
      if (layer.intent === 'projectile' || layer.intent === 'burst-fire' || layer.intent === 'beam' || layer.intent === 'dash') {
        this.spawnDirectionalResidualBurst(x, y, dirX, dirY, palette.glow, shape, Math.round(count * 0.38), 3.2 * layer.intensity);
      }
      return;
    }
    if (layer.phase === 'activation') {
      if (!suppressRadialShells) this.spawnProfileBloom(x, y, palette.core, palette.glow, radius, Math.min(0.32, layer.durationSeconds), glowStrength);
      if (layer.intent === 'pull') {
        this.spawnInwardResidualBurst(x, y, palette.accent, shape, count, radius, 7.2 * layer.intensity);
        this.spawnInwardResidualBurst(x, y, palette.glow, shape, Math.round(count * 0.48), radius * 0.7, 5.2 * layer.intensity);
      } else {
        this.spawnResidualBurst(x, y, palette.accent, shape, count, 7.4 * layer.intensity);
      }
      if (layer.intent === 'dash') {
        this.spawnDirectionalResidualBurst(x, y, -dirX, -dirY, palette.glow, shape, Math.round(count * 0.75), 7.8 * layer.intensity);
        this.spawnDirectionalResidualBurst(x, y, dirX, dirY, palette.core, shape, Math.round(count * 0.3), 9.4 * layer.intensity);
      } else if (layer.intent === 'projectile' || layer.intent === 'beam' || layer.intent === 'burst-fire') {
        this.spawnDirectionalResidualBurst(x, y, dirX, dirY, palette.glow, shape, Math.round(count * 0.82), 8.8 * layer.intensity);
      } else if (layer.intent === 'explosion') {
        this.spawnResidualBurst(x, y, palette.accent, shape, Math.round(count * 1.12), 8.6 * layer.intensity);
        this.spawnResidualBurst(x, y, palette.debris, secondaryShape, Math.round(count * 0.55), 5.2 * layer.intensity);
        if (!suppressRadialShells) this.spawnBrokenRing(x, y, palette.glow, radius * 0.94, layer.hierarchy === 'ultimate' ? 10 : 7, Math.min(0.46, layer.durationSeconds * 1.45));
      } else if (layer.intent === 'knockback') {
        if (layer.directional) {
          this.spawnDirectionalResidualBurst(x, y, dirX, dirY, palette.core, shape, Math.round(count * 1.05), 10.8 * layer.intensity);
          this.spawnDirectionalResidualBurst(x, y, dirX, dirY, palette.accent, shape, Math.round(count * 0.68), 7.6 * layer.intensity);
        } else {
          this.spawnResidualBurst(x, y, palette.core, shape, Math.round(count * 0.82), 7.8 * layer.intensity);
          this.spawnResidualBurst(x, y, palette.accent, secondaryShape, Math.round(count * 0.58), 5.8 * layer.intensity);
          if (!suppressRadialShells) this.spawnBrokenRing(x, y, palette.glow, radius * 0.88, 6, Math.min(0.38, layer.durationSeconds * 1.35));
        }
      }
      return;
    }
    if (layer.phase === 'sustain') {
      if (!suppressRadialShells) this.spawnProfileBloom(x, y, palette.core, palette.accent, radius * 0.72, Math.min(0.42, layer.durationSeconds), glowStrength * 0.62);
      if (layer.intent === 'pull') {
        this.spawnInwardResidualBurst(x, y, palette.glow, shape, Math.round(count * 0.74), radius * 0.84, 4.6 * layer.intensity);
      } else {
        this.spawnResidualBurst(x, y, palette.glow, shape, Math.round(count * 0.72), 3.8 * layer.intensity);
      }
      if (layer.intent === 'burst-fire') {
        this.spawnDirectionalResidualBurst(x, y, dirX, dirY, palette.core, shape, Math.round(count * 0.58), 9.2 * layer.intensity);
      } else if (layer.intent === 'channel' && layer.palette === 'fire') {
        this.spawnDirectionalResidualBurst(x, y, -dirX, -dirY, palette.accent, 'ember', Math.round(count * 0.46), 4.8 * layer.intensity);
      } else if (layer.intent === 'channel' && layer.palette === 'neutral') {
        this.spawnResidualBurst(x, y, palette.debris, 'smoke', Math.round(count * 0.62), 3.4 * layer.intensity);
      } else if (layer.intent === 'channel' && layer.palette === 'metal') {
        this.spawnResidualBurst(x, y, palette.glow, 'spark', Math.round(count * 0.58), 4.2 * layer.intensity);
      }
      return;
    }
    if (!suppressRadialShells) this.spawnProfileBloom(x, y, palette.core, palette.glow, radius * 0.55, Math.min(0.22, layer.durationSeconds), glowStrength * 0.58);
    if (layer.intent === 'pull') {
      this.spawnInwardResidualBurst(x, y, palette.accent, shape, Math.round(count * 0.62), radius * 0.72, 5.2 * layer.intensity);
    } else if (layer.intent === 'knockback' && layer.directional) {
      this.spawnDirectionalResidualBurst(x, y, dirX, dirY, palette.accent, shape, Math.round(count * 0.68), 7.2 * layer.intensity);
    } else {
      this.spawnResidualBurst(x, y, palette.accent, shape, Math.round(count * 0.62), layer.intent === 'status' ? 3.6 * layer.intensity : 5.2 * layer.intensity);
    }
  }

  private playCombatVfxTreatment(
    layer: ResolvedCombatVfxLayer,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    count: number,
    radius: number,
    palette: ReturnType<typeof getElementVfxPalette>
  ): void {
    if (layer.treatment === 'crystalline') {
      if (layer.phase === 'anticipation' || layer.intent === 'pull') {
        this.spawnInwardResidualBurst(x, y, palette.accent, 'shard', Math.max(2, Math.round(count * 0.5)), radius * 0.84, 4.2 * layer.intensity);
      } else {
        this.spawnResidualBurst(x, y, palette.core, 'shard', Math.max(2, Math.round(count * 0.46)), 4.8 * layer.intensity);
      }
      if (layer.phase === 'activation' || layer.phase === 'release') {
        this.spawnBrokenRing(x, y, palette.glow, radius * 0.88, layer.hierarchy === 'ultimate' ? 10 : 6, Math.min(0.46, layer.durationSeconds * 1.35));
      }
      return;
    }
    if (layer.treatment === 'rocket-exhaust') {
      this.spawnDirectionalResidualBurst(x, y, -dirX, -dirY, palette.accent, 'streak', Math.max(2, Math.round(count * 0.52)), 7 * layer.intensity);
      this.spawnDirectionalResidualBurst(x, y, -dirX, -dirY, palette.debris, 'debris', Math.max(2, Math.round(count * 0.26)), 4 * layer.intensity);
      return;
    }
    if (layer.treatment === 'target-lock') {
      this.spawnBrokenRing(x, y, palette.accent, radius * 0.76, 8, Math.min(0.44, layer.durationSeconds));
      this.spawnBrokenRing(x, y, palette.core, radius * 0.44, 4, Math.min(0.3, layer.durationSeconds));
      return;
    }
    if (layer.treatment === 'starburst') {
      this.spawnBrokenRing(x, y, palette.glow, radius * 1.16, 12, Math.min(0.62, layer.durationSeconds * 1.4));
      this.spawnResidualBurst(x, y, palette.debris, 'debris', Math.max(3, Math.round(count * 0.72)), 6.8 * layer.intensity);
      return;
    }
    if (layer.treatment === 'water-flow') {
      if (layer.intent === 'pull') {
        this.spawnInwardResidualBurst(x, y, palette.accent, 'ribbon', Math.max(2, Math.round(count * 0.68)), radius, 5.6 * layer.intensity);
        this.spawnInwardResidualBurst(x, y, palette.core, 'droplet', Math.max(2, Math.round(count * 0.3)), radius * 0.7, 4 * layer.intensity);
      } else if (layer.directional || layer.intent === 'dash') {
        this.spawnDirectionalResidualBurst(x, y, -dirX, -dirY, palette.accent, 'ribbon', Math.max(2, Math.round(count * 0.58)), 6.6 * layer.intensity);
        this.spawnDirectionalResidualBurst(x, y, -dirX, -dirY, palette.core, 'droplet', Math.max(2, Math.round(count * 0.28)), 4.2 * layer.intensity);
      } else {
        this.spawnResidualBurst(x, y, palette.accent, 'ribbon', Math.max(2, Math.round(count * 0.52)), 5 * layer.intensity);
        this.spawnResidualBurst(x, y, palette.core, 'droplet', Math.max(2, Math.round(count * 0.26)), 3.6 * layer.intensity);
      }
      if (layer.phase === 'activation' || layer.phase === 'release') {
        this.spawnBrokenRing(x, y, palette.glow, radius * 0.88, layer.hierarchy === 'ultimate' ? 8 : 5, Math.min(0.42, layer.durationSeconds));
      }
      return;
    }
    if (layer.treatment === 'root-growth') {
      const sideX = -dirY;
      const sideY = dirX;
      const branchCount = Math.max(2, Math.round(count * 0.24));
      this.spawnDirectionalResidualBurst(x, y, dirX, dirY, palette.accent, 'wedge', branchCount, 5.8 * layer.intensity);
      this.spawnDirectionalResidualBurst(x, y, -dirX, -dirY, palette.accent, 'wedge', branchCount, 4.8 * layer.intensity);
      this.spawnDirectionalResidualBurst(x, y, sideX, sideY, palette.glow, 'ribbon', branchCount, 5 * layer.intensity);
      this.spawnDirectionalResidualBurst(x, y, -sideX, -sideY, palette.glow, 'ribbon', branchCount, 5 * layer.intensity);
      this.spawnResidualBurst(x, y, palette.debris, 'debris', Math.max(2, Math.round(count * 0.34)), 3.8 * layer.intensity);
      return;
    }
    if (layer.treatment === 'void-tear') {
      if (layer.intent === 'pull') {
        this.spawnInwardResidualBurst(x, y, palette.accent, 'streak', Math.max(2, Math.round(count * 0.68)), radius, 6.2 * layer.intensity);
        this.spawnInwardResidualBurst(x, y, palette.glow, 'ring-fragment', Math.max(2, Math.round(count * 0.32)), radius * 0.7, 4.6 * layer.intensity);
      } else {
        this.spawnDirectionalResidualBurst(x, y, dirX, dirY, palette.core, 'streak', Math.max(2, Math.round(count * 0.54)), 7 * layer.intensity);
        this.spawnDirectionalResidualBurst(x, y, -dirX, -dirY, palette.accent, 'ring-fragment', Math.max(2, Math.round(count * 0.3)), 4.8 * layer.intensity);
      }
      if (layer.phase === 'activation' || layer.phase === 'release') {
        this.spawnBrokenRing(x, y, palette.glow, radius * 0.8, 6, Math.min(0.4, layer.durationSeconds));
      }
      return;
    }
    if (layer.treatment === 'singularity') {
      this.spawnInwardResidualBurst(x, y, palette.accent, 'streak', Math.max(3, Math.round(count * 0.82)), radius * 1.06, 7.2 * layer.intensity);
      this.spawnInwardResidualBurst(x, y, palette.glow, 'ring-fragment', Math.max(2, Math.round(count * 0.44)), radius * 0.74, 5.4 * layer.intensity);
      if (layer.phase === 'release') {
        this.spawnResidualBurst(x, y, palette.debris, 'streak', Math.max(3, Math.round(count * 0.68)), 6.8 * layer.intensity);
        this.spawnBrokenRing(x, y, palette.core, radius * 0.7, 7, Math.min(0.38, layer.durationSeconds));
      }
    }
  }

  private updateTimedGraphics(dtSeconds: number): void {
    for (const item of [...this.groundMarks, ...this.weaponEffects]) {
      if (!item.active) continue;
      item.life -= dtSeconds;
      if (item.life <= 0) {
        this.disable(item);
        continue;
      }
      const ratio = item.life / item.maxLife;
      item.node.alpha = item.maxLife > 1 ? Math.min(0.72, ratio * 0.72) : ratio;
      if (item.maxLife <= 1) item.node.scale.set(0.82 + (1 - ratio) * 0.28);
    }
  }

  private updateResiduals(dtSeconds: number): void {
    for (const particle of this.residuals) {
      if (!particle.active) continue;
      particle.life -= dtSeconds;
      if (particle.life <= 0) {
        this.disable(particle);
        continue;
      }
      particle.node.x += particle.vx * dtSeconds * 60;
      particle.node.y += particle.vy * dtSeconds * 60;
      particle.vx *= particle.drag;
      particle.vy *= particle.drag;
      particle.node.rotation += particle.spin * dtSeconds;
      const ratio = particle.life / particle.maxLife;
      particle.node.alpha = ratio * 0.82;
      particle.node.scale.set(0.7 + (1 - ratio) * particle.growth);
    }
  }

  private updateProjectileTrails(projectiles: readonly ProjectileSnapshot[], alpha: number, maxSamples: number, trailBudget: number): void {
    const active = new Set<number>();
    for (const projectile of projectiles) active.add(projectile.id);
    const visibleCount = Math.min(projectiles.length, trailBudget);
    for (let projectileIndex = 0; projectileIndex < visibleCount; projectileIndex += 1) {
      const projectile = projectiles[projectileIndex];
      if (!projectile) continue;
      const x = projectile.prevX + (projectile.x - projectile.prevX) * alpha;
      const y = projectile.prevY + (projectile.y - projectile.prevY) * alpha - projectile.arcHeight;
      const history = this.projectileTrails.get(projectile.id) ?? [];
      const last = history[history.length - 1];
      if (!last || Math.hypot(x - last.x, y - last.y) > 3) {
        history.push({ x, y });
        while (history.length > maxSamples) history.shift();
        this.projectileTrails.set(projectile.id, history);
      }
    }
    for (const id of [...this.projectileTrails.keys()]) if (!active.has(id)) this.projectileTrails.delete(id);

    this.projectileTrailGraphics.clear();
    for (let projectileIndex = 0; projectileIndex < visibleCount; projectileIndex += 1) {
      const projectile = projectiles[projectileIndex];
      if (!projectile) continue;
      const history = this.projectileTrails.get(projectile.id);
      if (!history || history.length < 2) continue;
      const recipe = getWeaponVfxRecipe(projectile.weaponId);
      for (let index = 1; index < history.length; index += 1) {
        const start = history[index - 1];
        const end = history[index];
        if (!start || !end) continue;
        const progress = index / history.length;
        this.projectileTrailGraphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({
          color: recipe.trailColor,
          width: Math.max(1.5, projectile.radius * (0.24 + progress * 0.25)),
          alpha: progress * 0.5 * this.quality.glowMultiplier
        });
      }
    }
  }

  private drawFighterAnchors(entities: readonly EntitySnapshot[], elapsedSeconds: number, dtSeconds: number, quality: VfxQualityProfile, massMode: boolean): void {
    this.fighterAnchorGraphics.clear();
    for (const pulse of this.hitPulses) pulse.life -= dtSeconds;
    for (let index = this.hitPulses.length - 1; index >= 0; index -= 1) if ((this.hitPulses[index]?.life ?? 0) <= 0) this.hitPulses.splice(index, 1);
    const crowd = entities.length > 48;
    const hitByEntity = new Map<number, HitPulse>();
    for (const hit of this.hitPulses) {
      const previous = hitByEntity.get(hit.entityId);
      if (!previous || hit.life > previous.life) hitByEntity.set(hit.entityId, hit);
    }

    for (const entity of entities) {
      if (!entity.alive) continue;
      const palette = getElementVfxPalette(entity.elements[0] ?? 'neutral');
      const ambientRadius = resolveVisualRadius(entity.radius * 1.24, quality.tier, 'ambient');
      if (quality.tier === 'high') {
        const pulse = 0.5 + Math.sin(elapsedSeconds * 2.4 + entity.id) * 0.12;
        this.fighterAnchorGraphics.circle(entity.x, entity.y, ambientRadius).stroke({ color: palette.glow, width: 2, alpha: pulse * 0.14 * quality.glowMultiplier });
      }
      const showStatuses = !crowd || entity.controller === 'player' || (!massMode && quality.tier !== 'low' && entity.id % 4 === 0);
      if (showStatuses) {
        const statusLimit = quality.tier === 'low' ? 1 : quality.tier === 'medium' ? 2 : 3;
        for (let statusIndex = 0; statusIndex < Math.min(statusLimit, entity.statuses.length); statusIndex += 1) {
          const status = entity.statuses[statusIndex];
          if (!status) continue;
          const color = STATUS_COLORS[status.statusId] ?? palette.accent;
          const radius = entity.radius * (1.08 + statusIndex * 0.12) + Math.sin(elapsedSeconds * 4 + statusIndex) * 1.5;
          this.fighterAnchorGraphics.circle(entity.x, entity.y, radius).stroke({ color, width: 2.2, alpha: (0.28 - statusIndex * 0.04) * quality.glowMultiplier });
        }
      }
      const hit = hitByEntity.get(entity.id);
      if (hit) {
        const progress = 1 - hit.life / hit.maxLife;
        this.fighterAnchorGraphics.circle(entity.x, entity.y, entity.radius * (0.62 + progress * 0.8)).fill({ color: hit.color, alpha: (1 - progress) * 0.32 });
        this.fighterAnchorGraphics.circle(entity.x, entity.y, entity.radius * (1 + progress * 0.65)).stroke({ color: hit.color, width: 3, alpha: (1 - progress) * 0.72 });
      }
    }
  }

  private drawWeaponAnchors(entities: readonly EntitySnapshot[], elapsedSeconds: number, quality: VfxQualityProfile, massMode: boolean): void {
    this.weaponAnchorGraphics.clear();
    const crowd = entities.length > 32 && quality.tier === 'low';
    const sampleStride = massMode ? 8 : 4;
    for (const entity of entities) {
      if (crowd && entity.controller !== 'player' && entity.id % sampleStride !== 0) continue;
      const attack = entity.weaponAttack;
      if (!attack || attack.phase !== 'active') continue;
      const weapon = getPrimaryAttack(attack.weaponId);
      const recipe = getWeaponVfxRecipe(attack.weaponId);
      const facing = Math.atan2(attack.direction.y, attack.direction.x);
      const progress = 1 - attack.remainingTicks / Math.max(1, attack.totalTicks);
      const furnaceNozzle = weapon.id === 'flame-fists' && entity.moduleIds.includes('furnace-nozzle');
      if (furnaceNozzle) {
        const pulse = 0.84 + Math.sin(elapsedSeconds * 24 + entity.id * 0.7) * 0.16;
        const halfAngle = 18 * Math.PI / 180;
        const startDistance = entity.radius * 0.9;
        const length = weapon.range * 0.95 * (0.92 + pulse * 0.08);
        const startX = entity.x + Math.cos(facing) * startDistance;
        const startY = entity.y + Math.sin(facing) * startDistance;
        const leftX = entity.x + Math.cos(facing - halfAngle) * length;
        const leftY = entity.y + Math.sin(facing - halfAngle) * length;
        const rightX = entity.x + Math.cos(facing + halfAngle) * length;
        const rightY = entity.y + Math.sin(facing + halfAngle) * length;
        this.weaponAnchorGraphics
          .moveTo(startX, startY)
          .lineTo(leftX, leftY)
          .lineTo(rightX, rightY)
          .closePath()
          .fill({ color: 0xff3b1f, alpha: 0.09 * quality.glowMultiplier });
        this.weaponAnchorGraphics.moveTo(startX, startY).lineTo(leftX, leftY)
          .stroke({ color: 0xff6a24, width: 5.5, alpha: 0.28 * quality.glowMultiplier });
        this.weaponAnchorGraphics.moveTo(startX, startY).lineTo(rightX, rightY)
          .stroke({ color: 0xff6a24, width: 5.5, alpha: 0.28 * quality.glowMultiplier });
        this.weaponAnchorGraphics.moveTo(startX, startY)
          .lineTo(entity.x + Math.cos(facing) * length, entity.y + Math.sin(facing) * length)
          .stroke({ color: 0xffe36e, width: 9 + pulse * 4, alpha: 0.62 * quality.glowMultiplier });
        for (let tongue = 0; tongue < 3; tongue += 1) {
          const offset = (tongue - 1) * halfAngle * 0.52 + Math.sin(elapsedSeconds * 17 + tongue * 2.1 + entity.id) * 0.045;
          const tongueLength = length * (0.66 + tongue * 0.09 + pulse * 0.08);
          this.weaponAnchorGraphics.moveTo(startX, startY)
            .lineTo(entity.x + Math.cos(facing + offset) * tongueLength, entity.y + Math.sin(facing + offset) * tongueLength)
            .stroke({ color: tongue === 1 ? 0xffff9a : 0xff8a2f, width: tongue === 1 ? 5 : 7, alpha: (0.48 + pulse * 0.18) * quality.glowMultiplier });
        }
        continue;
      }
      if (recipe.trailShape === 'slash') {
        this.drawArc(this.weaponAnchorGraphics, entity.x, entity.y, weapon.range * 0.82, facing - 1.15 + progress * 1.55, facing - 0.35 + progress * 1.55, recipe.trailColor, 8, 0.46 * quality.glowMultiplier);
      } else if (recipe.trailShape === 'thrust') {
        const length = weapon.range * (0.55 + Math.sin(progress * Math.PI) * 0.45);
        const endX = entity.x + Math.cos(facing) * length;
        const endY = entity.y + Math.sin(facing) * length;
        this.weaponAnchorGraphics.moveTo(entity.x, entity.y).lineTo(endX, endY).stroke({ color: recipe.trailColor, width: 7, alpha: 0.48 * quality.glowMultiplier });
      } else if (recipe.trailShape === 'spin' || recipe.trailShape === 'orbit') {
        const offset = elapsedSeconds * 8 + entity.id;
        this.drawArc(this.weaponAnchorGraphics, entity.x, entity.y, weapon.range * 0.82, offset, offset + Math.PI * (recipe.trailShape === 'orbit' ? 1.5 : 1), recipe.trailColor, 6, 0.42 * quality.glowMultiplier);
      } else if (recipe.trailShape === 'beam') {
        const startX = entity.x + Math.cos(facing) * entity.radius;
        const startY = entity.y + Math.sin(facing) * entity.radius;
        const length = entity.radius * 1.7;
        this.weaponAnchorGraphics.moveTo(startX, startY).lineTo(startX + Math.cos(facing) * length, startY + Math.sin(facing) * length).stroke({ color: recipe.trailColor, width: 4, alpha: 0.72 * quality.glowMultiplier });
      }
    }
  }

  private drawArenaAmbient(elapsedSeconds: number): void {
    this.arenaAmbientGraphics.clear();
    if (!this.quality || this.quality.tier === 'low') return;
    const alpha = (this.quality.tier === 'high' ? 0.07 : 0.035) * this.quality.glowMultiplier;
    for (const zone of this.arena.zones) {
      const color = zone.kind === 'lava' ? 0xff6a2f : zone.kind === 'electric' ? 0x8df6ff : zone.kind === 'water' ? 0x46d7ff : zone.kind === 'ice' ? 0xbff7ff : 0xe7fbff;
      const pulse = 0.72 + Math.sin(elapsedSeconds * 1.7 + zone.x * 0.01) * 0.18;
      if (zone.shape === 'circle') {
        this.arenaAmbientGraphics.circle(zone.x, zone.y, zone.radius * (0.82 + pulse * 0.03)).stroke({ color, width: 4, alpha: alpha * pulse });
      } else {
        this.arenaAmbientGraphics.rect(zone.x, zone.y, zone.width, zone.height).stroke({ color, width: 3, alpha: alpha * pulse });
      }
    }
  }

  private spawnWeaponEffect(x: number, y: number, dirX: number, dirY: number, range: number, angleDegrees: number, shape: string, color: number): void {
    if (this.activeCount(this.weaponEffects) >= this.budget.maxWeaponEffects) return;
    const effect = this.weaponEffects.find((item) => !item.active);
    if (!effect) return;
    effect.active = true;
    effect.life = effect.maxLife = shape === 'beam' ? 0.12 : 0.24;
    effect.node.clear();
    const facing = Math.atan2(dirY, dirX);
    if (shape === 'thrust' || shape === 'beam') {
      effect.node.moveTo(0, 0).lineTo(Math.cos(facing) * range * 0.82, Math.sin(facing) * range * 0.82).stroke({ color, width: shape === 'beam' ? 7 : 5, alpha: 0.72 });
    } else if (shape === 'spin' || shape === 'orbit') {
      this.drawArc(effect.node, 0, 0, range * 0.78, facing - Math.PI * 0.8, facing + Math.PI * 0.8, color, 7, 0.62);
    } else if (shape === 'lob') {
      effect.node.circle(Math.cos(facing) * 28, Math.sin(facing) * 28, 12).stroke({ color, width: 3, alpha: 0.6 });
    } else {
      const half = Math.max(0.18, angleDegrees * Math.PI / 360);
      const radius = range * 0.76;
      this.drawArc(effect.node, 0, 0, radius, facing - half, facing + half, color, 10, 0.72);
      this.drawArc(effect.node, 0, 0, radius * 0.84, facing - half * 0.92, facing + half * 0.92, 0xffffff, 3.2, 0.48);
      const tipX = Math.cos(facing + half) * radius;
      const tipY = Math.sin(facing + half) * radius;
      effect.node.circle(tipX, tipY, 5).fill({ color: 0xffffff, alpha: 0.72 });
    }
    effect.node.position.set(x, y);
    effect.node.alpha = 1;
    effect.node.scale.set(1);
    effect.node.visible = true;
  }

  private spawnProfileBloom(
    x: number,
    y: number,
    coreColor: number,
    glowColor: number,
    radius: number,
    life: number,
    strength: number
  ): void {
    if (this.activeCount(this.weaponEffects) >= this.budget.maxWeaponEffects) return;
    const effect = this.weaponEffects.find((item) => !item.active);
    if (!effect) return;
    effect.active = true;
    effect.life = effect.maxLife = Math.max(0.08, life);
    effect.node.clear();
    effect.node.circle(0, 0, radius).fill({ color: glowColor, alpha: 0.08 * strength });
    effect.node.circle(0, 0, radius * 0.64).fill({ color: glowColor, alpha: 0.13 * strength });
    effect.node.circle(0, 0, radius * 0.28).fill({ color: coreColor, alpha: 0.58 * strength });
    effect.node.circle(0, 0, radius * 0.16).fill({ color: 0xffffff, alpha: 0.76 * strength });
    effect.node.circle(0, 0, radius * 0.78).stroke({ color: glowColor, width: Math.max(1.5, radius * 0.035), alpha: 0.34 * strength });
    effect.node.position.set(x, y);
    effect.node.alpha = 1;
    effect.node.scale.set(1);
    effect.node.visible = true;
  }

  private spawnBrokenRing(x: number, y: number, color: number, radius: number, segments: number, life: number): void {
    if (this.activeCount(this.weaponEffects) >= this.budget.maxWeaponEffects) return;
    const effect = this.weaponEffects.find((item) => !item.active);
    if (!effect) return;
    effect.active = true;
    effect.life = effect.maxLife = Math.max(0.1, life);
    effect.node.clear();
    const count = Math.max(4, segments);
    for (let index = 0; index < count; index += 1) {
      const start = index / count * Math.PI * 2 + this.random() * 0.05;
      const end = start + Math.PI * 2 / count * (0.48 + this.random() * 0.22);
      const x1 = Math.cos(start) * radius;
      const y1 = Math.sin(start) * radius;
      const mid = (start + end) * 0.5;
      const x2 = Math.cos(end) * radius;
      const y2 = Math.sin(end) * radius;
      effect.node.moveTo(x1, y1)
        .quadraticCurveTo(Math.cos(mid) * radius * 1.08, Math.sin(mid) * radius * 1.08, x2, y2)
        .stroke({ color, width: Math.max(1.5, radius * 0.028), alpha: 0.62 });
    }
    effect.node.position.set(x, y);
    effect.node.alpha = 1;
    effect.node.scale.set(0.72);
    effect.node.visible = true;
  }

  private spawnGroundMark(x: number, y: number, kind: string, color: number, radius: number): void {
    if (kind === 'none' || !this.quality || Math.min(this.quality.maxGroundMarks, this.budget.maxGroundMarks) <= 0) return;
    const mark = this.groundMarks.find((item) => !item.active) ?? this.groundMarks.reduce((oldest, item) => item.life < oldest.life ? item : oldest, this.groundMarks[0]!);
    mark.active = true;
    mark.life = mark.maxLife = kind === 'wet' || kind === 'frost' ? 6 : 9;
    mark.node.clear();
    const r = Math.max(8, Math.min(90, radius));
    if (kind === 'scorch') {
      mark.node.circle(0, 0, r).fill({ color, alpha: 0.2 });
      mark.node.circle(0, 0, r * 0.72).stroke({ color: 0x130d0b, width: 4, alpha: 0.34 });
    } else if (kind === 'frost') {
      mark.node.circle(0, 0, r).fill({ color, alpha: 0.08 });
      for (let index = 0; index < 6; index += 1) {
        const angle = index / 6 * Math.PI * 2;
        mark.node.moveTo(0, 0).lineTo(Math.cos(angle) * r, Math.sin(angle) * r).stroke({ color, width: 2, alpha: 0.38 });
      }
    } else if (kind === 'crack') {
      for (let index = 0; index < 8; index += 1) {
        const angle = index / 8 * Math.PI * 2 + this.random() * 0.25;
        const inner = r * (0.08 + this.random() * 0.18);
        const outer = r * (0.65 + this.random() * 0.35);
        mark.node.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner).lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer).stroke({ color, width: 2.5, alpha: 0.46 });
      }
    } else if (kind === 'wet') {
      mark.node.circle(-r * 0.22, 0, r * 0.7).fill({ color, alpha: 0.12 });
      mark.node.circle(r * 0.35, r * 0.12, r * 0.48).fill({ color, alpha: 0.1 });
    } else if (kind === 'void') {
      mark.node.circle(0, 0, r).fill({ color, alpha: 0.16 });
      mark.node.circle(0, 0, r * 0.72).stroke({ color: 0xa868ff, width: 3, alpha: 0.36 });
      mark.node.circle(0, 0, r * 0.38).stroke({ color: 0x6be8ff, width: 2, alpha: 0.28 });
    }
    mark.node.position.set(x, y);
    mark.node.rotation = this.random() * Math.PI * 2;
    mark.node.alpha = 0.72;
    mark.node.scale.set(1);
    mark.node.visible = true;
  }

  private spawnResidualBurst(x: number, y: number, color: number, shape: VfxParticleShape, count: number, speed: number): void {
    const remainingBudget = Math.max(0, this.budget.maxResidualEffects - this.activeCount(this.residuals));
    if (remainingBudget <= 0) return;
    count = Math.min(count, remainingBudget);
    let created = 0;
    for (const particle of this.residuals) {
      if (particle.active) continue;
      const angle = this.random() * Math.PI * 2;
      const velocity = speed * (0.35 + this.random() * 0.75);
      particle.active = true;
      particle.life = particle.maxLife = shape === 'smoke' ? 0.9 + this.random() * 0.7 : 0.28 + this.random() * 0.48;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity - (shape === 'smoke' ? 1.2 : 0);
      particle.drag = shape === 'smoke' ? 0.975 : 0.945;
      particle.growth = shape === 'smoke' ? 1.5 : 0.35;
      particle.spin = (this.random() - 0.5) * 7;
      particle.node.clear();
      const size = 1.5 + this.random() * 4;
      drawParticleShape(particle.node, shape, size, color, shape === 'smoke' ? 0.5 : 0.94);
      particle.node.position.set(x, y);
      particle.node.alpha = 1;
      particle.node.scale.set(1);
      particle.node.visible = true;
      created += 1;
      if (created >= count) break;
    }
  }

  private spawnInwardResidualBurst(
    x: number,
    y: number,
    color: number,
    shape: VfxParticleShape,
    count: number,
    radius: number,
    speed: number
  ): void {
    const remainingBudget = Math.max(0, this.budget.maxResidualEffects - this.activeCount(this.residuals));
    if (remainingBudget <= 0) return;
    count = Math.min(count, remainingBudget);
    let created = 0;
    for (const particle of this.residuals) {
      if (particle.active) continue;
      const angle = this.random() * Math.PI * 2;
      const startRadius = radius * (0.6 + this.random() * 0.42);
      const velocity = speed * (0.45 + this.random() * 0.65);
      particle.active = true;
      particle.life = particle.maxLife = 0.24 + this.random() * 0.34;
      particle.vx = -Math.cos(angle) * velocity;
      particle.vy = -Math.sin(angle) * velocity;
      particle.drag = 0.96;
      particle.growth = -0.14;
      particle.spin = (this.random() - 0.5) * 5;
      particle.node.clear();
      const size = 1.6 + this.random() * 3.2;
      drawParticleShape(particle.node, shape, size, color, 0.92);
      particle.node.position.set(x + Math.cos(angle) * startRadius, y + Math.sin(angle) * startRadius);
      particle.node.alpha = 1;
      particle.node.scale.set(1);
      particle.node.visible = true;
      created += 1;
      if (created >= count) break;
    }
  }

  private spawnDirectionalResidualBurst(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    color: number,
    shape: VfxParticleShape,
    count: number,
    speed: number
  ): void {
    const remainingBudget = Math.max(0, this.budget.maxResidualEffects - this.activeCount(this.residuals));
    if (remainingBudget <= 0) return;
    count = Math.min(count, remainingBudget);
    const length = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / length;
    const ny = dirY / length;
    let created = 0;
    for (const particle of this.residuals) {
      if (particle.active) continue;
      const lateral = (this.random() - 0.5) * 1.15;
      const forward = 0.45 + this.random() * 0.75;
      const vx = nx * forward - ny * lateral;
      const vy = ny * forward + nx * lateral;
      const velocity = speed * (0.45 + this.random() * 0.65);
      particle.active = true;
      particle.life = particle.maxLife = shape === 'smoke' ? 0.45 + this.random() * 0.42 : 0.2 + this.random() * 0.3;
      particle.vx = vx * velocity;
      particle.vy = vy * velocity - (shape === 'smoke' ? 0.45 : 0);
      particle.drag = shape === 'smoke' ? 0.97 : 0.94;
      particle.growth = shape === 'smoke' ? 1.15 : 0.28;
      particle.spin = (this.random() - 0.5) * 6;
      particle.node.clear();
      const size = 1.8 + this.random() * 3.2;
      drawParticleShape(particle.node, shape, size, color, shape === 'smoke' ? 0.46 : 0.94);
      particle.node.position.set(x, y);
      particle.node.alpha = 1;
      particle.node.scale.set(1);
      particle.node.visible = true;
      created += 1;
      if (created >= count) break;
    }
  }

  private spawnKnockbackStreak(x: number, y: number, dirX: number, dirY: number, color: number, length: number): void {
    if (this.activeCount(this.weaponEffects) >= this.budget.maxWeaponEffects) return;
    const effect = this.weaponEffects.find((item) => !item.active);
    if (!effect) return;
    const magnitude = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / magnitude;
    const ny = dirY / magnitude;
    effect.active = true;
    effect.life = effect.maxLife = 0.18;
    effect.node.clear();
    for (let index = -1; index <= 1; index += 1) {
      const offsetX = -ny * index * 7;
      const offsetY = nx * index * 7;
      effect.node.moveTo(offsetX - nx * length * 0.55, offsetY - ny * length * 0.55)
        .lineTo(offsetX + nx * length * 0.25, offsetY + ny * length * 0.25)
        .stroke({ color, width: index === 0 ? 5 : 2.5, alpha: index === 0 ? 0.64 : 0.34 });
    }
    effect.node.position.set(x, y);
    effect.node.alpha = 1;
    effect.node.scale.set(1);
    effect.node.visible = true;
  }

  private spawnMuzzleFlash(x: number, y: number, dirX: number, dirY: number): void {
    if (this.activeCount(this.weaponEffects) >= this.budget.maxWeaponEffects) return;
    const effect = this.weaponEffects.find((item) => !item.active);
    if (!effect) return;
    const length = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / length;
    const ny = dirY / length;
    const sx = -ny;
    const sy = nx;
    effect.active = true;
    effect.life = effect.maxLife = 0.065;
    effect.node.clear();
    effect.node.moveTo(-nx * 3 + sx * 4, -ny * 3 + sy * 4)
      .lineTo(nx * 27, ny * 27)
      .lineTo(-nx * 3 - sx * 4, -ny * 3 - sy * 4)
      .closePath().fill({ color: 0xffb84e, alpha: 0.9 });
    effect.node.moveTo(0, 0).lineTo(nx * 18, ny * 18).stroke({ color: 0xffffff, width: 3, alpha: 0.98 });
    effect.node.circle(nx * 4, ny * 4, 5).fill({ color: 0xfff1b0, alpha: 0.88 });
    effect.node.position.set(x, y);
    effect.node.alpha = 1;
    effect.node.scale.set(1);
    effect.node.visible = true;
  }

  private spawnCoreFlash(x: number, y: number, color: number, radius: number, life: number): void {
    if (this.activeCount(this.weaponEffects) >= this.budget.maxWeaponEffects) return;
    const effect = this.weaponEffects.find((item) => !item.active);
    if (!effect) return;
    effect.active = true;
    effect.life = effect.maxLife = life;
    effect.node.clear().circle(0, 0, radius).fill({ color, alpha: 0.76 });
    effect.node.position.set(x, y);
    effect.node.alpha = 1;
    effect.node.scale.set(0.8);
    effect.node.visible = true;
  }

  private activeCount(items: readonly TimedGraphic[]): number {
    let count = 0;
    for (const item of items) if (item.active) count += 1;
    return count;
  }

  private enforceActiveLimit(items: readonly TimedGraphic[], limit: number): void {
    if (!Number.isFinite(limit)) return;
    const active = items.filter((item) => item.active).sort((a, b) => a.life - b.life);
    while (active.length > limit) {
      const oldest = active.shift();
      if (oldest) this.disable(oldest);
    }
  }

  private enforceGroundMarkLimit(limit: number): void {
    if (!Number.isFinite(limit)) return;
    const active = this.groundMarks.filter((mark) => mark.active).sort((a, b) => a.life - b.life);
    while (active.length > limit) {
      const oldest = active.shift();
      if (oldest) this.disable(oldest);
    }
  }

  private drawArc(graphics: Graphics, x: number, y: number, radius: number, start: number, end: number, color: number, width: number, alpha: number): void {
    const segments = Math.max(8, Math.ceil(Math.abs(end - start) / (Math.PI / 24)));
    for (let index = 0; index <= segments; index += 1) {
      const angle = start + (end - start) * index / segments;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (index === 0) graphics.moveTo(px, py);
      else graphics.lineTo(px, py);
    }
    graphics.stroke({ color, width, alpha });
  }

  private disable(item: TimedGraphic): void {
    item.active = false;
    item.node.visible = false;
  }

  private random(): number {
    this.noiseState = (Math.imul(this.noiseState, 1664525) + 1013904223) >>> 0;
    return this.noiseState / 0x100000000;
  }
}
