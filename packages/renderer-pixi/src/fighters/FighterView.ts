import { Container, Graphics, Text } from 'pixi.js';
import { getFighter, getPrimaryAttack, listMountedAttachments, type PrimaryAttackDefinition } from '@kinetic/content';
import type { EntitySnapshot } from '@kinetic/protocol';
import {
  computeMotionPose,
  getMotionRecipe,
  getRenderProfile,
  getSkillPresentation,
  getVisualRecipe,
  type MotionRecipe,
  type PresentationSettings,
  type VisualRecipe
} from '@kinetic/visual-engine';
import { BallastGravityRig } from './BallastGravityRig';
import { FighterHealthRing } from './FighterHealthRing';
import { PyroFurnaceAura } from './PyroFurnaceAura';
import { FighterResourceRing } from './FighterResourceRing';
import { FighterStatusIndicators } from './FighterStatusIndicators';
import { MountedAttachmentView } from './MountedAttachmentView';
import type { VisualLod } from './types';

function moduleIdsKey(moduleIds: readonly string[]): string {
  return moduleIds.join('\u001f');
}

export class FighterView {
  readonly container = new Container();
  private readonly playerMarker = new Graphics();
  private readonly statusIndicators = new FighterStatusIndicators();
  private readonly pyroFurnaceAura = new PyroFurnaceAura();
  private readonly ballastGravityRig = new BallastGravityRig();
  private readonly mountedAttachments: MountedAttachmentView;
  private readonly body = new Graphics();
  private readonly damageOverlay = new Graphics();
  private readonly core = new Graphics();
  private readonly aura = new Graphics();
  private readonly weapon = new Graphics();
  private readonly ultimateWeapon = new Graphics();
  private readonly velocityVector = new Graphics();
  private readonly healthRing: FighterHealthRing;
  private readonly resourceRing: FighterResourceRing;
  private label: Text | null = null;
  private profileId: PresentationSettings['renderProfile'];
  private lod: VisualLod;
  private readonly visual: VisualRecipe;
  private readonly motion: MotionRecipe;
  private readonly weaponDefinition: PrimaryAttackDefinition;
  private readonly equippedModuleIdsKey: string;
  private impact = 0;
  private damageFlash = 0;

  constructor(private readonly entity: EntitySnapshot, profileId: PresentationSettings['renderProfile'], lod: VisualLod) {
    const fighter = getFighter(entity.fighterId);
    this.visual = getVisualRecipe(fighter.visualRecipeId);
    this.motion = getMotionRecipe(fighter.animationRecipeId);
    this.weaponDefinition = getPrimaryAttack(entity.primaryAttackId);
    this.mountedAttachments = new MountedAttachmentView(listMountedAttachments(entity.moduleIds));
    this.healthRing = new FighterHealthRing(entity);
    this.resourceRing = new FighterResourceRing(this.visual.accentColor);
    this.equippedModuleIdsKey = moduleIdsKey(entity.moduleIds);
    this.profileId = profileId;
    this.lod = lod;
    this.container.addChild(
      this.playerMarker,
      this.pyroFurnaceAura.graphics,
      this.ballastGravityRig.graphics,
      this.statusIndicators.graphics,
      this.mountedAttachments.graphics,
      this.aura,
      this.body,
      this.core,
      this.damageOverlay,
      this.weapon,
      this.ultimateWeapon,
      this.healthRing.graphics,
      this.resourceRing.graphics,
      this.velocityVector
    );
    this.build();
  }

  matches(entity: EntitySnapshot): boolean {
    return this.entity.fighterId === entity.fighterId
      && this.entity.primaryAttackId === entity.primaryAttackId
      && this.entity.controller === entity.controller
      && this.equippedModuleIdsKey === moduleIdsKey(entity.moduleIds)
      && Math.abs(this.entity.radius - entity.radius) < 0.001;
  }

  prepareForReuse(): void {
    this.impact = 0;
    this.damageFlash = 0;
    this.container.visible = true;
    this.weapon.position.set(0, 0);
    this.ultimateWeapon.clear();
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

  update(
    entity: EntitySnapshot,
    alpha: number,
    elapsedSeconds: number,
    reducedMotion = false,
    victory = false,
    showMountedAttachments = true,
    showFighterHealthRings = true
  ): void {
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
    this.updateKillZoneWeapon(entity, elapsedSeconds, reducedMotion);
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
    this.pyroFurnaceAura.update(entity, elapsedSeconds, reducedMotion, this.lod);
    this.ballastGravityRig.update(entity, elapsedSeconds, reducedMotion, this.lod);
    this.statusIndicators.update(entity, elapsedSeconds, uiAngle, reducedMotion, this.lod);
    this.mountedAttachments.update(entity, elapsedSeconds, uiAngle, reducedMotion, this.lod, showMountedAttachments);
    this.healthRing.update(entity, elapsedSeconds, uiAngle, this.lod, this.profileId, showFighterHealthRings);
    this.resourceRing.update(entity, elapsedSeconds, uiAngle, this.lod, this.profileId, showFighterHealthRings);

    if (this.label) {
      this.label.text = `#${entity.id}  hp ${Math.ceil(entity.hp)}\nv ${speed.toFixed(1)} m ${entity.mass.toFixed(1)}`;
      this.label.rotation = uiAngle;
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private updateKillZoneWeapon(entity: EntitySnapshot, elapsedSeconds: number, reducedMotion: boolean): void {
    this.ultimateWeapon.clear();
    if (entity.fighterId !== 'gunner' || !entity.statuses.some((status) => status.statusId === 'kill-zone-overdrive')) return;

    const r = entity.radius;
    const spin = reducedMotion ? 0 : elapsedSeconds * 28;
    const barrelStart = r * 0.7;
    const barrelEnd = r * 2.45;
    const outline = 0xf7fcff;
    const body = 0x1a252f;
    const brass = 0xffbd58;

    this.ultimateWeapon.circle(r * 0.58, 0, r * 0.34).fill({ color: 0x101820, alpha: 0.98 });
    this.ultimateWeapon.circle(r * 0.58, 0, r * 0.34)
      .stroke({ color: outline, width: Math.max(2, r * 0.055), alpha: 0.92 });
    this.ultimateWeapon.circle(r * 0.58, 0, r * 0.22)
      .stroke({ color: brass, width: Math.max(2.5, r * 0.07), alpha: 0.96 });

    for (let index = 0; index < 5; index += 1) {
      const phase = spin + index * Math.PI * 2 / 5;
      const offset = Math.sin(phase) * r * 0.18;
      this.ultimateWeapon.moveTo(barrelStart, offset).lineTo(barrelEnd, offset)
        .stroke({ color: outline, width: Math.max(4.5, r * 0.13), alpha: 0.78 });
      this.ultimateWeapon.moveTo(barrelStart, offset).lineTo(barrelEnd, offset)
        .stroke({ color: body, width: Math.max(2.8, r * 0.075), alpha: 1 });
    }

    const pulse = reducedMotion ? 0.72 : 0.72 + Math.sin(elapsedSeconds * 48) * 0.24;
    this.ultimateWeapon.moveTo(barrelEnd, -r * 0.26).lineTo(barrelEnd + r * (0.72 + pulse * 0.35), 0).lineTo(barrelEnd, r * 0.26)
      .closePath().fill({ color: 0xffa132, alpha: 0.38 + pulse * 0.34 });
    this.ultimateWeapon.moveTo(barrelEnd + r * 0.12, -r * 0.13).lineTo(barrelEnd + r * (0.55 + pulse * 0.25), 0).lineTo(barrelEnd + r * 0.12, r * 0.13)
      .closePath().fill({ color: 0xfff1a4, alpha: 0.72 + pulse * 0.18 });
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
      case 'burst': {
        const rounds = Math.max(1, this.weaponDefinition.burstCount ?? 1);
        const recoilPulse = attack.phase === 'active'
          ? Math.max(0, Math.sin(progress * Math.PI * rounds * 2))
          : 0;
        this.weapon.rotation = -recoilPulse * 0.025;
        this.weapon.x = socketX - r * 0.2 * recoilPulse;
        break;
      }
      case 'shot':
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

    if (attack.visualId === 'skip-stone') {
      const stoneX = size * 0.62;
      this.weapon.moveTo(size * 0.08, 0).lineTo(stoneX - size * 0.18, 0)
        .stroke({ color: 0x6e5a88, width: Math.max(3, r * 0.1), alpha: 0.72 });
      this.weapon.circle(stoneX, 0, size * 0.22).fill({ color: 0x241a30, alpha: 1 });
      this.weapon.circle(stoneX, 0, size * 0.22)
        .stroke({ color: 0x91edff, width: Math.max(2, r * 0.07), alpha: 0.95 });
      this.weapon.circle(stoneX - size * 0.05, -size * 0.05, size * 0.06)
        .fill({ color: 0xdccfff, alpha: 0.82 });
      return;
    }

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
      const outline = 0xf4fbff;
      const receiverX = size * 0.12;
      const receiverY = -size * 0.14;
      const receiverW = size * 0.86;
      const receiverH = size * 0.28;
      // Rear stock makes the rifle silhouette readable even when the fighter is
      // moving sideways; the bright outline keeps it separated from the body.
      this.weapon.moveTo(-size * 0.34, 0).lineTo(receiverX + size * 0.08, 0)
        .stroke({ color: 0x1a242e, width: Math.max(11, r * 0.42), alpha: 1 });
      this.weapon.moveTo(-size * 0.34, 0).lineTo(receiverX + size * 0.08, 0)
        .stroke({ color: outline, width: Math.max(2, r * 0.055), alpha: 0.72 });
      this.weapon.rect(receiverX, receiverY, receiverW, receiverH).fill({ color: 0x202b36, alpha: 1 });
      this.weapon.rect(receiverX, receiverY, receiverW, receiverH)
        .stroke({ color: outline, width: Math.max(2, r * 0.055), alpha: 0.82 });
      this.weapon.rect(size * 0.3, -size * 0.075, size * 0.48, size * 0.15).fill({ color: accent, alpha: 0.92 });
      this.weapon.rect(size * 0.43, -size * 0.25, size * 0.32, size * 0.09).fill({ color: 0x111820, alpha: 1 });
      this.weapon.rect(size * 0.48, -size * 0.29, size * 0.22, size * 0.06).fill({ color: core, alpha: 0.94 });
      this.weapon.moveTo(size * 0.92, 0).lineTo(size * 1.36, 0)
        .stroke({ color: 0x1a242e, width: Math.max(7, r * 0.2), alpha: 1 });
      this.weapon.moveTo(size * 0.95, 0).lineTo(size * 1.39, 0)
        .stroke({ color: core, width: Math.max(3, r * 0.09), alpha: 0.98 });
      this.weapon.rect(size * 1.34, -size * 0.1, size * 0.12, size * 0.2).fill({ color: 0x10171e, alpha: 1 });
      this.weapon.rect(size * 1.34, -size * 0.1, size * 0.12, size * 0.2)
        .stroke({ color: outline, width: Math.max(2, r * 0.045), alpha: 0.76 });
      this.weapon.moveTo(size * 0.5, size * 0.14).lineTo(size * 0.58, size * 0.4).lineTo(size * 0.76, size * 0.14)
        .fill({ color: 0x111820, alpha: 0.98 });
      this.weapon.moveTo(size * 0.5, size * 0.14).lineTo(size * 0.58, size * 0.4).lineTo(size * 0.76, size * 0.14)
        .stroke({ color: outline, width: Math.max(2, r * 0.045), alpha: 0.65 });
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
    this.pyroFurnaceAura.reset();
    this.ballastGravityRig.reset();
    this.statusIndicators.reset();
    this.mountedAttachments.reset();
    this.aura.clear();
    this.body.clear();
    this.damageOverlay.clear();
    this.core.clear();
    this.weapon.clear();
    this.velocityVector.clear();
    this.healthRing.resetRenderCache();
    this.resourceRing.resetRenderCache();
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
