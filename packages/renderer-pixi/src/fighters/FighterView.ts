import { Container, Graphics, Text } from 'pixi.js';
import { getFighter, getPrimaryAttack, listMountedAttachments, type PrimaryAttackDefinition } from '@kinetic/content';
import type { EntitySnapshot } from '@kinetic/protocol';
import {
  computeMotionPose,
  getCombatVfxPersistentRig,
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
import { resolveKnockbackAngularImpulse, type KnockbackReactionKind } from '../fighterReactions';
import {
  resolvePrimaryAttackVisualMounts,
  resolveWeaponVisualMountPose,
  type ResolvedWeaponVisualMount
} from '../weaponMounts';
import {
  resolveFighterAnatomy,
  resolveFighterArmPose,
  resolveHeldWeaponPoint,
  resolveHeldWeaponPose,
  type HeldWeaponPose
} from '../fighterAnatomy';
import {
  getChargePresentationProfile,
  resolveChargeBodyPose,
  resolveChargeReleasePose,
  resolveChargeShake,
  resolveChargeTravelAbility,
  resolveChargeTravelWeaponPose,
  resolveChargeWeaponPose,
  resolveChargeWeaponTipScale,
  type ChargePresentationProfile
} from '../chargePresentation';
import { resolveMeleeSkillWeaponPose } from '../meleeSkillPresentation';
import { resolveSwingSmear, resolveThrustStreak } from '../meleeStrikeSmear';
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
  private readonly meleeArmRig = new Graphics();
  private readonly weaponRig = new Container();
  private readonly chargeFx = new Graphics();
  private readonly weaponChargeFx = new Graphics();
  private readonly meleeAttackFx = new Graphics();
  private readonly weaponMountViews: Array<{ mount: ResolvedWeaponVisualMount; graphics: Graphics }>;
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
  private weaponGeometryScale = 1;
  private heldWeaponPose: HeldWeaponPose | null = null;
  private impact = 0;
  private damageFlash = 0;
  private knockbackRotation = 0;
  private knockbackAngularVelocity = 0;
  private lastElapsedSeconds = 0;

  constructor(private readonly entity: EntitySnapshot, profileId: PresentationSettings['renderProfile'], lod: VisualLod) {
    const fighter = getFighter(entity.fighterId);
    this.visual = getVisualRecipe(fighter.visualRecipeId);
    this.motion = getMotionRecipe(fighter.animationRecipeId);
    this.weaponDefinition = getPrimaryAttack(entity.primaryAttackId);
    this.weaponMountViews = resolvePrimaryAttackVisualMounts(this.weaponDefinition).map((mount) => ({
      mount,
      graphics: new Graphics()
    }));
    for (const view of this.weaponMountViews) this.weaponRig.addChild(view.graphics);
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
      this.chargeFx,
      this.body,
      this.core,
      this.damageOverlay,
      this.meleeArmRig,
      this.weaponRig,
      this.meleeAttackFx,
      this.weaponChargeFx,
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
    this.knockbackRotation = 0;
    this.knockbackAngularVelocity = 0;
    this.lastElapsedSeconds = 0;
    this.container.visible = true;
    for (const view of this.weaponMountViews) {
      view.graphics.position.set(0, 0);
      view.graphics.rotation = 0;
      view.graphics.scale.set(1);
    }
    this.ultimateWeapon.clear();
    this.chargeFx.clear();
    this.weaponChargeFx.clear();
    this.meleeAttackFx.clear();
    this.meleeArmRig.clear();
    this.meleeAttackFx.clear();
    this.heldWeaponPose = null;
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

  knockback(direction: { x: number; y: number }, force: number, kind: KnockbackReactionKind, facingRadians: number, mass: number): void {
    const impulse = resolveKnockbackAngularImpulse({ direction, force, kind, facingRadians, mass });
    this.knockbackAngularVelocity = Math.max(-36, Math.min(36, this.knockbackAngularVelocity + impulse));
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
    const chargeProfile = cast ? getChargePresentationProfile(cast.abilityId) : null;
    const chargeRelease = resolveChargeReleasePose(entity.statuses, entity.radius);
    const travelChargeAbilityId = resolveChargeTravelAbility(entity.fighterId, entity.statuses, entity.abilities);
    const travelChargeProfile = travelChargeAbilityId ? getChargePresentationProfile(travelChargeAbilityId) : null;
    const travelChargeRecipe = travelChargeAbilityId ? getSkillPresentation(travelChargeAbilityId) : null;
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
        case 'vortex': rotationOffset = castProgress * Math.PI * 4; castScaleX = castScaleY = 1 + Math.sin(castProgress * Math.PI) * 0.12; break;
        case 'gather': castScaleX = castScaleY = 1 - castProgress * 0.12 + Math.abs(castPulse) * 0.04; break;
        case 'rocket': castScaleX = 1.12 + castProgress * 0.18; castScaleY = 0.88; break;
        case 'brace': castScaleX = 1.14; castScaleY = 0.86; break;
        case 'spin': rotationOffset = castProgress * Math.PI * 8; castScaleX = 1.08; castScaleY = 0.94; break;
        case 'spiral': rotationOffset = castProgress * Math.PI * 4; castScaleX = 1.24; castScaleY = 0.84; break;
        case 'sweep': rotationOffset = Math.sin(castProgress * Math.PI) * 2.2; castScaleX = 1.16; castScaleY = 0.9; break;
        case 'recoil': rotationOffset = -Math.sin(castProgress * Math.PI) * 0.48; castScaleX = 1.08 - Math.sin(castProgress * Math.PI) * 0.18; castScaleY = 1.08; jitterY = Math.sin(castProgress * Math.PI * 6) * 1.4; break;
        case 'charge': rotationOffset = Math.sin(castProgress * Math.PI) * 0.5; castScaleX = 1.28 + castProgress * 0.1; castScaleY = 0.82; break;
        case 'charge-sweep': {
          const chargeEnd = 0.58;
          if (castProgress < chargeEnd) {
            const chargeProgress = castProgress / chargeEnd;
            rotationOffset = -0.22 * chargeProgress;
            castScaleX = 1.12 + chargeProgress * 0.22;
            castScaleY = 0.9 - chargeProgress * 0.06;
          } else {
            const sweepProgress = (castProgress - chargeEnd) / (1 - chargeEnd);
            rotationOffset = -0.22 + Math.sin(sweepProgress * Math.PI) * 2.15;
            castScaleX = 1.34;
            castScaleY = 0.84;
          }
          break;
        }
        case 'flow': rotationOffset = Math.sin(castProgress * Math.PI * 2) * 1.1; castScaleX = 1.18; castScaleY = 0.86 + Math.sin(castProgress * Math.PI) * 0.12; break;
        case 'phase': rotationOffset = castProgress * Math.PI * 6; castScaleX = 1.16 + Math.sin(castProgress * Math.PI) * 0.12; castScaleY = 0.88; break;
        case 'pivot': rotationOffset = Math.sin(castProgress * Math.PI) * 1.7; castScaleX = 1.18; castScaleY = 0.84; break;
        case 'tremble': jitterX = Math.sin(elapsedSeconds * 70) * (1 + castProgress * 4); jitterY = Math.cos(elapsedSeconds * 83) * (1 + castProgress * 3); castScaleX = castScaleY = 1 + castProgress * 0.12; break;
        case 'overdrive': rotationOffset = Math.sin(elapsedSeconds * 18) * 0.08; castScaleX = castScaleY = 1 + castProgress * 0.18 + Math.abs(castPulse) * 0.06; break;
        case 'fuse-pop': castScaleX = castScaleY = 1.08; break;
        case 'snap': castScaleX = 1.12; castScaleY = 0.92; break;
      }
    }
    if (chargeProfile) {
      const chargeBody = resolveChargeBodyPose(chargeProfile, castProgress);
      castScaleX = chargeBody.scaleX;
      castScaleY = chargeBody.scaleY;
      rotationOffset = chargeBody.rotation;
      const shake = resolveChargeShake(
        chargeProfile,
        cast?.castDirection ?? null,
        elapsedSeconds,
        castProgress,
        entity.radius,
        reducedMotion
      );
      jitterX += shake.x;
      jitterY += shake.y;
    }
    this.updateChargePresentation(castRecipe, chargeProfile, castProgress, elapsedSeconds, reducedMotion);
    this.impact *= 0.86;
    const knockbackRotation = this.updateKnockbackReaction(elapsedSeconds, reducedMotion);

    const victoryLift = victory && !reducedMotion ? Math.sin(elapsedSeconds * 2.6) * 2.2 - 3 : 0;
    const victoryPulse = victory && !reducedMotion ? 1 + Math.sin(elapsedSeconds * 3.2) * 0.025 : 1;
    this.container.x = x + jitterX;
    this.container.y = y + jitterY + victoryLift;
    const weaponAttack = entity.weaponAttack;
    const attackFacing = weaponAttack ? Math.atan2(weaponAttack.direction.y, weaponAttack.direction.x) : null;
    const castFacing = cast?.castDirection ? Math.atan2(cast.castDirection.y, cast.castDirection.x) : null;
    const presentationRotation = rotationOffset + knockbackRotation;
    if (this.profileId !== 'debug') this.container.rotation = (castFacing ?? attackFacing ?? entity.rotation) + presentationRotation;
    else this.container.rotation = 0;
    // Ranged barrels must remain on the authoritative attack direction even if
    // the fighter body is visually tumbling or performing a presentation pose.
    // Otherwise bullets travel on the simulation line while the gun points
    // somewhere else, which reads as shots coming out of the body.
    const stabilizeRangedAim = attackFacing !== null
      && (this.weaponDefinition.form === 'rifle' || this.weaponDefinition.form === 'launcher');
    this.weaponRig.rotation = stabilizeRangedAim && this.profileId !== 'debug' ? -presentationRotation : 0;
    // The Gunner rotary-cannon is a sibling of weaponRig, so it must cancel
    // presentation-only body wobble independently. Otherwise Kill Zone rounds
    // fly on the authoritative aim line while the visible ult barrel drifts.
    this.ultimateWeapon.rotation = this.profileId !== 'debug' ? -presentationRotation : 0;
    this.container.scale.set(pose.scaleX * castScaleX * victoryPulse, pose.scaleY * castScaleY * victoryPulse);
    this.updateWeaponPose(
      weaponAttack,
      reducedMotion,
      chargeProfile,
      castProgress,
      chargeRelease,
      travelChargeAbilityId,
      cast?.abilityId ?? null
    );
    this.updateHeldArmRig();
    this.updateMeleeAttackPresentation(
      weaponAttack,
      cast?.abilityId ?? null,
      castProgress,
      reducedMotion
    );
    this.updateWeaponChargePresentation(
      castRecipe ?? travelChargeRecipe,
      chargeProfile ?? travelChargeProfile,
      cast ? castProgress : travelChargeProfile ? 1 : 0,
      elapsedSeconds,
      reducedMotion,
      chargeRelease
    );
    this.updateProfiledUltimateWeapon(entity, elapsedSeconds, reducedMotion);
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

  private updateChargePresentation(
    recipe: ReturnType<typeof getSkillPresentation> | null,
    profile: ChargePresentationProfile | null,
    progress: number,
    elapsedSeconds: number,
    reducedMotion: boolean
  ): void {
    this.chargeFx.clear();
    if (!recipe || !profile || this.lod === 'army') return;

    const r = this.entity.radius;
    const t = Math.max(0, Math.min(1, progress));
    const build = 0.22 + t * 0.78;
    const pulse = reducedMotion ? 0.9 : 0.86 + Math.sin(elapsedSeconds * 15) * 0.14;

    // Keep the body cue minimal: the charge should read from the weapon, not
    // from soft circular trails behind the fighter.
    this.chargeFx.circle(0, 0, r * (1.03 + t * 0.08))
      .stroke({ color: recipe.color, width: Math.max(2.5, r * 0.06), alpha: 0.16 + build * 0.2 });
    this.chargeFx.circle(0, 0, r * (0.8 + t * 0.08))
      .fill({ color: recipe.color, alpha: 0.025 + build * 0.035 });

    // Rear tension is shown with clean directional streaks/chevrons rather
    // than bubble-like circles. This preserves charge readability while keeping
    // the silhouette aggressive.
    const rearStreaks = profile.kind === 'brace' ? 4 : profile.kind === 'sweep' ? 3 : 2;
    for (let index = 0; index < rearStreaks; index += 1) {
      const lane = index - (rearStreaks - 1) / 2;
      const startX = -r * (0.92 + index * 0.26 + t * 0.12);
      const endX = startX - r * (0.32 + t * 0.22);
      const y = lane * r * 0.22;
      const alpha = Math.max(0.16, 0.28 + build * 0.24 - index * 0.04);
      this.chargeFx.moveTo(startX, y).lineTo(endX, y)
        .stroke({ color: index % 2 === 0 ? recipe.accentColor : recipe.color, width: Math.max(2, r * 0.042), alpha });
      this.chargeFx.moveTo(endX, y)
        .lineTo(endX + r * 0.12, y - r * 0.08)
        .moveTo(endX, y)
        .lineTo(endX + r * 0.12, y + r * 0.08)
        .stroke({ color: recipe.accentColor, width: Math.max(1.5, r * 0.032), alpha: alpha * 0.82 });
    }

    // A small front spearhead/pressure wedge makes the release direction clear.
    const front = r * (0.92 + t * 0.18);
    this.chargeFx.moveTo(front, 0)
      .lineTo(front - r * 0.24, -r * 0.12)
      .moveTo(front, 0)
      .lineTo(front - r * 0.24, r * 0.12)
      .stroke({ color: recipe.accentColor, width: Math.max(2.5, r * 0.055), alpha: 0.36 + build * 0.42 });

    // Held-weapon charges get a clear forward arrow so viewers can read the
    // intended lane before release. Because +X is anatomy-front, this remains
    // aligned with the same direction the weapon and simulation use.
    if (this.weaponDefinition.visualGrip) {
      const arrowStart = r * 1.08;
      const arrowEnd = r * (1.72 + t * 0.48);
      const arrowAlpha = 0.28 + build * 0.62;
      const head = r * (0.24 + t * 0.08);
      this.chargeFx.moveTo(arrowStart, 0).lineTo(arrowEnd, 0)
        .stroke({ color: recipe.accentColor, width: Math.max(4, r * 0.085), alpha: arrowAlpha * 0.72 });
      this.chargeFx.moveTo(arrowEnd, 0)
        .lineTo(arrowEnd - head, -head * 0.62)
        .moveTo(arrowEnd, 0)
        .lineTo(arrowEnd - head, head * 0.62)
        .stroke({ color: 0xffffff, width: Math.max(3, r * 0.065), alpha: arrowAlpha });
    }

    if (profile.kind === 'electric') {
      const tail = r * (1.45 + t * 0.55);
      this.chargeFx.moveTo(-r * 0.72, -r * 0.1)
        .lineTo(-tail * 0.68, r * 0.08)
        .lineTo(-tail, -r * 0.06)
        .stroke({ color: recipe.accentColor, width: Math.max(2, r * 0.05), alpha: 0.62 * build });
    } else if (profile.kind === 'unstable') {
      for (let index = 0; index < 3; index += 1) {
        const angle = (reducedMotion ? index * 2.1 : elapsedSeconds * (3.1 + index) + index * 2.1);
        const distance = r * (0.88 + t * 0.24);
        this.chargeFx.circle(Math.cos(angle) * distance, Math.sin(angle) * distance, r * 0.065)
          .fill({ color: recipe.accentColor, alpha: 0.36 * build });
      }
    } else if (profile.kind === 'gravity') {
      this.chargeFx.circle(0, 0, r * (1.3 + t * 0.1))
        .stroke({ color: recipe.accentColor, width: Math.max(2, r * 0.05), alpha: 0.34 * build });
      this.chargeFx.circle(0, 0, r * (1.48 - t * 0.12))
        .stroke({ color: recipe.color, width: Math.max(2, r * 0.04), alpha: 0.22 * build });
    } else if (profile.kind === 'heavy' || profile.kind === 'brace') {
      this.chargeFx.moveTo(-r * 0.7, -r * 0.68).lineTo(-r * (1.15 + t * 0.18), -r * 0.82)
        .stroke({ color: recipe.accentColor, width: Math.max(2.5, r * 0.05), alpha: 0.3 * build });
      this.chargeFx.moveTo(-r * 0.7, r * 0.68).lineTo(-r * (1.15 + t * 0.18), r * 0.82)
        .stroke({ color: recipe.accentColor, width: Math.max(2.5, r * 0.05), alpha: 0.3 * build });
    }
  }

  private updateMeleeAttackPresentation(
    attack: EntitySnapshot['weaponAttack'],
    castAbilityId: string | null,
    castProgress: number,
    reducedMotion: boolean
  ): void {
    this.meleeAttackFx.clear();
    const grip = this.weaponDefinition.visualGrip;
    const pose = this.heldWeaponPose;
    if (!grip || !pose || this.lod === 'army') return;

    const r = this.entity.radius;
    const form = this.weaponDefinition.form;
    const swingSkill = castAbilityId === 'crosscut'
      || castAbilityId === 'duelist-step'
      || castAbilityId === 'execution-arc'
      || castAbilityId === 'pike-sweep';
    const thrustSkill = castAbilityId === 'vault-thrust';
    const basicSwing = attack?.style === 'swing' && attack.phase === 'active';
    const basicThrust = attack?.style === 'thrust' && attack.phase === 'active';
    if (!basicSwing && !basicThrust && !swingSkill && !thrustSkill) return;

    const progress = attack
      ? 1 - attack.remainingTicks / Math.max(1, attack.totalTicks)
      : Math.max(0, Math.min(1, castProgress));
    const intensity = reducedMotion ? 0.72 : 0.72 + Math.sin(progress * Math.PI) * 0.28;
    const tipScale = form === 'sword' ? 2.16 : form === 'spear' ? 1.78 : resolveChargeWeaponTipScale(form);
    const tip = resolveHeldWeaponPoint(
      this.weaponDefinition,
      r,
      pose,
      tipScale,
      0,
      this.weaponGeometryScale
    );
    const hand = pose.hand;
    const dx = tip.x - hand.x;
    const dy = tip.y - hand.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    if (basicSwing || swingSkill) {
      const ultimateBoost = castAbilityId === 'execution-arc' ? 1.22 : 1;
      const sweepRadius = length * ultimateBoost;
      const smear = resolveSwingSmear({
        handX: hand.x,
        handY: hand.y,
        bladeAngle: angle,
        reach: sweepRadius,
        progress,
        intensity,
        samples: reducedMotion ? 3 : 6
      });
      // Faint outer swoosh bounding the arc the blade has actually crossed.
      this.meleeAttackFx.arc(hand.x, hand.y, sweepRadius, angle - smear.spanRadians, angle)
        .stroke({ color: this.visual.accentColor, width: Math.max(8, r * 0.17), alpha: 0.2 * intensity });
      // Ghost blades fanned across the swept arc; oldest drawn first so the bright edge sits on top.
      for (let i = smear.slices.length - 1; i >= 1; i -= 1) {
        const slice = smear.slices[i];
        if (!slice) continue;
        this.meleeAttackFx
          .moveTo(hand.x, hand.y)
          .lineTo(hand.x + Math.cos(slice.angle) * slice.radius, hand.y + Math.sin(slice.angle) * slice.radius)
          .stroke({ color: this.visual.coreColor, width: Math.max(3, r * 0.075), alpha: 0.5 * slice.alpha });
      }
      // Bright leading blade edge and a concise tip flash.
      this.meleeAttackFx.moveTo(hand.x, hand.y).lineTo(smear.leadTip.x, smear.leadTip.y)
        .stroke({ color: 0xffffff, width: Math.max(2.5, r * 0.06), alpha: 0.82 * intensity });
      this.meleeAttackFx.circle(smear.leadTip.x, smear.leadTip.y, Math.max(3, r * 0.09))
        .fill({ color: 0xffffff, alpha: 0.5 * intensity });
      return;
    }

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const extension = r * (thrustSkill ? 0.82 : 0.58);
    const streak = resolveThrustStreak({
      handX: hand.x,
      handY: hand.y,
      thrustAngle: angle,
      reach: length,
      extension,
      progress,
      intensity,
      samples: reducedMotion ? 3 : 5
    });
    // Receding motion-blur echoes behind the lunging point; oldest first.
    for (let i = streak.segments.length - 1; i >= 1; i -= 1) {
      const seg = streak.segments[i];
      if (!seg) continue;
      this.meleeAttackFx
        .moveTo(hand.x + nx * seg.fromDist, hand.y + ny * seg.fromDist)
        .lineTo(hand.x + nx * seg.toDist, hand.y + ny * seg.toDist)
        .stroke({ color: this.visual.accentColor, width: Math.max(6, r * 0.14), alpha: 0.4 * seg.alpha });
    }
    // Bright thrust core out to the leading tip.
    this.meleeAttackFx.moveTo(hand.x, hand.y).lineTo(streak.tip.x, streak.tip.y)
      .stroke({ color: this.visual.coreColor, width: Math.max(4, r * 0.085), alpha: 0.66 * intensity });
    const head = r * 0.2;
    this.meleeAttackFx.moveTo(streak.tip.x, streak.tip.y)
      .lineTo(streak.tip.x - nx * head - ny * head * 0.6, streak.tip.y - ny * head + nx * head * 0.6)
      .moveTo(streak.tip.x, streak.tip.y)
      .lineTo(streak.tip.x - nx * head + ny * head * 0.6, streak.tip.y - ny * head - nx * head * 0.6)
      .stroke({ color: 0xffffff, width: Math.max(2.5, r * 0.06), alpha: 0.82 * intensity });
    this.meleeAttackFx.circle(streak.tip.x, streak.tip.y, Math.max(2.5, r * 0.07))
      .fill({ color: 0xffffff, alpha: 0.5 * intensity });
  }

  private updateWeaponChargePresentation(
    recipe: ReturnType<typeof getSkillPresentation> | null,
    profile: ChargePresentationProfile | null,
    progress: number,
    elapsedSeconds: number,
    reducedMotion: boolean,
    release: ReturnType<typeof resolveChargeReleasePose>
  ): void {
    this.weaponChargeFx.clear();
    const grip = this.weaponDefinition.visualGrip;
    const pose = this.heldWeaponPose;
    if (!recipe || !profile || !grip || !pose || this.lod === 'army') return;

    const r = this.entity.radius;
    const t = Math.max(0, Math.min(1, progress));
    const build = 0.18 + t * 0.82;
    const weaponTipScale = resolveChargeWeaponTipScale(this.weaponDefinition.form);
    const hand = pose.hand;
    const tip = resolveHeldWeaponPoint(
      this.weaponDefinition,
      r,
      pose,
      weaponTipScale,
      0,
      this.weaponGeometryScale
    );
    const dx = tip.x - hand.x;
    const dy = tip.y - hand.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / length;
    const ny = dy / length;
    const sx = -ny;
    const sy = nx;
    const pulse = reducedMotion ? 0.92 : 0.82 + Math.sin(elapsedSeconds * (12 + profile.shakeFrequency * 0.08)) * 0.18;

    // The weapon itself is the charge meter: the read should stay on the blade,
    // spear, halberd, scythe, or gauntlet rather than behind-body circles.
    this.weaponChargeFx.moveTo(hand.x, hand.y).lineTo(tip.x, tip.y)
      .stroke({ color: recipe.color, width: Math.max(11, r * (0.19 + t * 0.1)), alpha: 0.1 + build * 0.24 });
    this.weaponChargeFx.moveTo(hand.x, hand.y).lineTo(tip.x, tip.y)
      .stroke({ color: recipe.accentColor, width: Math.max(4, r * 0.085), alpha: 0.38 + build * 0.56 });
    this.weaponChargeFx.moveTo(hand.x, hand.y).lineTo(tip.x, tip.y)
      .stroke({ color: 0xffffff, width: Math.max(1.6, r * 0.03), alpha: 0.18 + build * 0.28 });

    // Use converging charge streaks into the weapon instead of circular beads.
    const gatherCount = profile.kind === 'brace' ? 6 : profile.kind === 'sweep' ? 5 : 4;
    for (let index = 0; index < gatherCount; index += 1) {
      const cycle = (elapsedSeconds * (0.72 + index * 0.05) + index / gatherCount + t * 0.9) % 1;
      const along = 0.12 + cycle * 0.82;
      const wobble = reducedMotion ? 0 : Math.sin(elapsedSeconds * (7 + index) + index * 1.4) * r * 0.055 * (1 - t * 0.6);
      const px = hand.x + dx * along + sx * wobble;
      const py = hand.y + dy * along + sy * wobble;
      const rear = r * (0.18 + (1 - along) * 0.22);
      const alpha = (0.22 + build * 0.48) * (0.55 + along * 0.45);
      this.weaponChargeFx.moveTo(px - nx * rear, py - ny * rear).lineTo(px, py)
        .stroke({ color: index % 2 === 0 ? recipe.accentColor : recipe.color, width: Math.max(2, r * 0.038), alpha });
    }

    // The loaded tip becomes unmistakable shortly before release.
    const tipRadius = r * (0.13 + t * 0.1) * (0.94 + pulse * 0.14);
    this.weaponChargeFx.circle(tip.x, tip.y, tipRadius * 1.9)
      .stroke({ color: recipe.color, width: Math.max(2.5, r * 0.05), alpha: 0.24 + build * 0.42 });
    this.weaponChargeFx.circle(tip.x, tip.y, tipRadius)
      .fill({ color: recipe.accentColor, alpha: 0.48 + build * 0.46 });

    if (t > 0.52) {
      const pressure = (t - 0.52) / 0.48;
      const rear = r * (0.54 + pressure * 0.34);
      this.weaponChargeFx.moveTo(hand.x - nx * rear + sx * r * 0.14, hand.y - ny * rear + sy * r * 0.14)
        .lineTo(hand.x + nx * r * 0.06, hand.y + ny * r * 0.06)
        .stroke({ color: recipe.accentColor, width: Math.max(2.4, r * 0.055), alpha: 0.28 + pressure * 0.54 });
      this.weaponChargeFx.moveTo(hand.x - nx * rear - sx * r * 0.14, hand.y - ny * rear - sy * r * 0.14)
        .lineTo(hand.x + nx * r * 0.04, hand.y + ny * r * 0.04)
        .stroke({ color: recipe.color, width: Math.max(2, r * 0.05), alpha: 0.24 + pressure * 0.48 });
    }

    // During the short authored follow-through, draw a hard directional streak
    // through the real weapon. It visually connects charge -> weapon release ->
    // target launch instead of letting the VFX end before the strike happens.
    if (release) {
      const releaseAlpha = Math.max(0, 1 - release.progress);
      const streakStartX = hand.x - nx * r * 0.4;
      const streakStartY = hand.y - ny * r * 0.4;
      const streakEndX = tip.x + nx * r * (0.55 + (1 - release.progress) * 0.45);
      const streakEndY = tip.y + ny * r * (0.55 + (1 - release.progress) * 0.45);
      this.weaponChargeFx.moveTo(streakStartX, streakStartY).lineTo(streakEndX, streakEndY)
        .stroke({ color: recipe.accentColor, width: Math.max(6, r * 0.13), alpha: 0.58 * releaseAlpha });
      this.weaponChargeFx.moveTo(hand.x, hand.y).lineTo(streakEndX, streakEndY)
        .stroke({ color: 0xffffff, width: Math.max(2.5, r * 0.055), alpha: 0.7 * releaseAlpha });
    }
  }

  private updateProfiledUltimateWeapon(entity: EntitySnapshot, elapsedSeconds: number, reducedMotion: boolean): void {
    this.ultimateWeapon.clear();
    const rig = entity.statuses
      .map((status) => getCombatVfxPersistentRig(status.statusId))
      .find((candidate) => candidate !== undefined);
    if (rig?.kind !== 'rotary-cannon') return;

    const r = entity.radius;
    const spin = reducedMotion ? 0 : elapsedSeconds * 28;
    const barrelStart = r * 0.7;
    // Match the persistent ult barrel tip to the same muzzle distance used by
    // Gunner's rifle/projectile spawn path instead of maintaining a second
    // hard-coded length that can drift out of alignment.
    const barrelEnd = r * (this.weaponDefinition.muzzleOffsetScale ?? 2.55);
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

  private updateKnockbackReaction(elapsedSeconds: number, reducedMotion: boolean): number {
    if (reducedMotion) {
      this.knockbackRotation = 0;
      this.knockbackAngularVelocity = 0;
      this.lastElapsedSeconds = elapsedSeconds;
      return 0;
    }

    const dtSeconds = this.lastElapsedSeconds > 0
      ? Math.max(0, Math.min(0.05, elapsedSeconds - this.lastElapsedSeconds))
      : 1 / 60;
    this.lastElapsedSeconds = elapsedSeconds;
    this.knockbackRotation += this.knockbackAngularVelocity * dtSeconds;
    this.knockbackAngularVelocity *= Math.exp(-4.1 * dtSeconds);
    this.knockbackRotation *= Math.exp(-2.35 * dtSeconds);
    if (Math.abs(this.knockbackAngularVelocity) < 0.015) this.knockbackAngularVelocity = 0;
    if (Math.abs(this.knockbackRotation) < 0.001) this.knockbackRotation = 0;
    return Math.max(-Math.PI * 2.25, Math.min(Math.PI * 2.25, this.knockbackRotation));
  }

  private updateWeaponPose(
    attack: EntitySnapshot['weaponAttack'],
    reducedMotion: boolean,
    chargeProfile: ChargePresentationProfile | null,
    chargeProgress: number,
    chargeRelease: ReturnType<typeof resolveChargeReleasePose>,
    travelChargeAbilityId: string | null,
    castAbilityId: string | null
  ): void {
    const r = this.entity.radius;
    this.heldWeaponPose = null;
    const progress = attack ? 1 - attack.remainingTicks / Math.max(1, attack.totalTicks) : 0;
    const eased = progress * progress * (3 - 2 * progress);

    for (const view of this.weaponMountViews) {
      const mountPose = resolveWeaponVisualMountPose(view.mount, r);
      const heldBy = this.weaponDefinition.visualGrip?.hand;
      let motionX = 0;
      let motionY = 0;
      let rotation = this.weaponDefinition.visualGrip ? 0 : mountPose.rotation;
      const sideSwing = heldBy === 'left' || (!heldBy && view.mount.side === 'left') ? -0.82 : 1;
      view.graphics.scale.set(mountPose.scale);

      if (attack && !reducedMotion) {
        switch (attack.style) {
          case 'swing':
            rotation += sideSwing * (attack.phase === 'windup'
              ? -1.2 + eased * 0.42
              : attack.phase === 'active'
                ? -0.78 + eased * 2.28
                : 1.5 - eased * 1.5);
            break;
          case 'thrust':
            motionX += attack.phase === 'windup'
              ? -r * 0.28 * eased
              : attack.phase === 'active'
                ? r * 0.78 * Math.sin(progress * Math.PI)
                : r * 0.28 * (1 - eased);
            break;
          case 'overhead':
          case 'slam':
            rotation += attack.phase === 'windup'
              ? -1.55 + eased * 0.3
              : attack.phase === 'active'
                ? -1.25 + eased * 1.9
                : 0.65 - eased * 0.65;
            break;
          case 'spin':
          case 'orbit':
            rotation += attack.phase === 'active'
              ? progress * Math.PI * 5 * (heldBy === 'left' || (!heldBy && view.mount.side === 'left') ? -1 : 1)
              : attack.phase === 'windup'
                ? -0.45 * eased
                : 0;
            break;
          case 'burst': {
            const rounds = Math.max(1, this.weaponDefinition.burstCount ?? 1);
            const recoilPulse = attack.phase === 'active'
              ? Math.max(0, Math.sin(progress * Math.PI * rounds * 2))
              : 0;
            rotation -= recoilPulse * 0.025;
            motionX -= r * 0.2 * recoilPulse;
            break;
          }
          case 'shot':
          case 'stream':
            motionX -= attack.phase === 'active' ? r * (this.weaponDefinition.form === 'launcher' ? 0.42 : 0.26) * Math.sin(progress * Math.PI * 2) : 0;
            break;
          case 'lob':
            rotation += attack.phase === 'windup'
              ? -0.95 * eased
              : attack.phase === 'active'
                ? -0.95 + eased * 1.9
                : 0.95 - eased * 0.95;
            motionY -= attack.phase === 'windup' ? r * 0.2 * eased : 0;
            break;
        }
      }

      const meleeSkillPose = this.weaponDefinition.visualGrip
        ? resolveMeleeSkillWeaponPose(castAbilityId, chargeProgress, r)
        : null;
      if (meleeSkillPose) {
        motionX += meleeSkillPose.x;
        motionY += meleeSkillPose.y;
        rotation += meleeSkillPose.rotation;
      } else if (chargeProfile && this.weaponDefinition.visualGrip) {
        const chargeWeapon = resolveChargeWeaponPose(chargeProfile, chargeProgress, r);
        motionX += chargeWeapon.x;
        motionY += chargeWeapon.y;
        rotation += chargeWeapon.rotation;
      } else if (chargeRelease && this.weaponDefinition.visualGrip) {
        motionX += chargeRelease.x;
        motionY += chargeRelease.y;
        rotation += chargeRelease.rotation;
      } else if (travelChargeAbilityId && this.weaponDefinition.visualGrip) {
        const travelPose = resolveChargeTravelWeaponPose(travelChargeAbilityId, r);
        motionX += travelPose.x;
        motionY += travelPose.y;
        rotation += travelPose.rotation;
      }

      const heldPose = resolveHeldWeaponPose(
        this.weaponDefinition,
        r,
        rotation,
        mountPose.scale * this.weaponGeometryScale,
        { x: motionX, y: motionY }
      );
      if (heldPose) {
        if (!this.heldWeaponPose) this.heldWeaponPose = heldPose;
        view.graphics.position.set(heldPose.x, heldPose.y);
        view.graphics.rotation = heldPose.rotation;
      } else {
        view.graphics.position.set(mountPose.x + motionX, mountPose.y + motionY);
        view.graphics.rotation = rotation;
      }
    }
  }

  private updateHeldArmRig(): void {
    this.meleeArmRig.clear();
    const grip = this.weaponDefinition.visualGrip;
    const pose = this.heldWeaponPose;
    if (!grip || !pose || this.lod === 'army') return;

    const r = this.entity.radius;
    const anatomy = resolveFighterAnatomy(r);
    const outline = this.visual.bodyDarkColor;
    const armColor = this.visual.accentColor;
    const handColor = this.visual.coreColor;
    const armWidth = Math.max(5, r * 0.18);
    const outlineWidth = armWidth + Math.max(2, r * 0.07);

    const drawArm = (side: 'left' | 'right', shoulder: { x: number; y: number }, hand: { x: number; y: number }) => {
      const arm = resolveFighterArmPose(shoulder, hand, side, r);
      this.meleeArmRig.moveTo(arm.shoulder.x, arm.shoulder.y)
        .lineTo(arm.elbow.x, arm.elbow.y)
        .lineTo(arm.hand.x, arm.hand.y)
        .stroke({ color: outline, width: outlineWidth, alpha: 0.9 });
      this.meleeArmRig.moveTo(arm.shoulder.x, arm.shoulder.y)
        .lineTo(arm.elbow.x, arm.elbow.y)
        .lineTo(arm.hand.x, arm.hand.y)
        .stroke({ color: armColor, width: armWidth, alpha: 0.96 });
      this.meleeArmRig.circle(arm.elbow.x, arm.elbow.y, Math.max(3, r * 0.08))
        .fill({ color: armColor, alpha: 0.98 });
      this.meleeArmRig.circle(arm.hand.x, arm.hand.y, Math.max(3.5, r * 0.1))
        .fill({ color: handColor, alpha: 0.98 });
    };

    const primarySocket = grip.hand === 'left'
      ? { shoulder: anatomy.leftShoulder, hand: pose.hand }
      : { shoulder: anatomy.rightShoulder, hand: pose.hand };
    drawArm(grip.hand, primarySocket.shoulder, primarySocket.hand);

    if (grip.support) {
      const supportPoint = resolveHeldWeaponPoint(
        this.weaponDefinition,
        r,
        pose,
        grip.support.x,
        grip.support.y ?? 0,
        this.weaponGeometryScale
      );
      const supportShoulder = grip.support.hand === 'left' ? anatomy.leftShoulder : anatomy.rightShoulder;
      drawArm(grip.support.hand, supportShoulder, supportPoint);
    }
  }

  private drawConfiguredWeapon(weapon: Graphics, r: number, attack: PrimaryAttackDefinition): void {
    const accent = this.visual.accentColor;
    const core = this.visual.coreColor;
    const size = r * attack.visualScale;

    if (attack.visualId === 'skip-stone') {
      const stoneX = size * 0.62;
      weapon.moveTo(size * 0.08, 0).lineTo(stoneX - size * 0.18, 0)
        .stroke({ color: 0x6e5a88, width: Math.max(3, r * 0.1), alpha: 0.72 });
      weapon.circle(stoneX, 0, size * 0.22).fill({ color: 0x241a30, alpha: 1 });
      weapon.circle(stoneX, 0, size * 0.22)
        .stroke({ color: 0x91edff, width: Math.max(2, r * 0.07), alpha: 0.95 });
      weapon.circle(stoneX - size * 0.05, -size * 0.05, size * 0.06)
        .fill({ color: 0xdccfff, alpha: 0.82 });
      return;
    }

    if (attack.form === 'fire') {
      weapon.circle(size * 0.58, 0, size * 0.28).fill({ color: 0xff5b28, alpha: 0.92 });
      weapon.circle(size * 0.67, -size * 0.08, size * 0.18).fill({ color: 0xffb33d, alpha: 0.96 });
      weapon.moveTo(size * 0.52, -size * 0.22).lineTo(size * 0.82, -size * 0.52).lineTo(size * 0.76, -size * 0.08).fill({ color: 0xffe16f, alpha: 0.9 });
      return;
    }
    if (attack.form === 'water') {
      weapon.circle(size * 0.7, 0, size * 0.28).fill({ color: 0x4fd3ff, alpha: 0.72 });
      weapon.circle(size * 0.7, 0, size * 0.31).stroke({ color: 0xc9f8ff, width: Math.max(2, r * 0.1), alpha: 0.85 });
      weapon.circle(size * 0.61, -size * 0.09, size * 0.08).fill({ color: 0xffffff, alpha: 0.72 });
      return;
    }
    if (attack.form === 'lightning') {
      weapon.circle(size * 0.48, 0, size * 0.23).fill({ color: 0xffef4e, alpha: 0.95 });
      weapon.circle(size * 0.48, 0, size * 0.32).stroke({ color: 0x8df6ff, width: 3, alpha: 0.8 });
      weapon.moveTo(size * 0.68, -size * 0.2).lineTo(size * 0.58, 0).lineTo(size * 0.84, -size * 0.03).lineTo(size * 0.72, size * 0.22).stroke({ color: 0xffffff, width: 3, alpha: 0.95 });
      return;
    }
    if (attack.form === "gauntlet") {
      // Long gauntlet, but with the original thicker/heavier proportions.
      weapon
        .rect(size * 0.02, -size * 0.22, size * 1.18, size * 0.44)
        .fill({ color: 0x334657, alpha: 1 });

      weapon
        .rect(size * 1.02, -size * 0.32, size * 0.62, size * 0.64)
        .fill({ color: accent, alpha: 0.95 });

      weapon
        .rect(size * 0.2, -size * 0.08, size * 1.14, size * 0.16)
        .fill({ color: core, alpha: 0.9 });
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
      weapon.moveTo(-size * 0.34, 0).lineTo(receiverX + size * 0.08, 0)
        .stroke({ color: 0x1a242e, width: Math.max(11, r * 0.42), alpha: 1 });
      weapon.moveTo(-size * 0.34, 0).lineTo(receiverX + size * 0.08, 0)
        .stroke({ color: outline, width: Math.max(2, r * 0.055), alpha: 0.72 });
      weapon.rect(receiverX, receiverY, receiverW, receiverH).fill({ color: 0x202b36, alpha: 1 });
      weapon.rect(receiverX, receiverY, receiverW, receiverH)
        .stroke({ color: outline, width: Math.max(2, r * 0.055), alpha: 0.82 });
      weapon.rect(size * 0.3, -size * 0.075, size * 0.48, size * 0.15).fill({ color: accent, alpha: 0.92 });
      weapon.rect(size * 0.43, -size * 0.25, size * 0.32, size * 0.09).fill({ color: 0x111820, alpha: 1 });
      weapon.rect(size * 0.48, -size * 0.29, size * 0.22, size * 0.06).fill({ color: core, alpha: 0.94 });
      weapon.moveTo(size * 0.92, 0).lineTo(size * 1.36, 0)
        .stroke({ color: 0x1a242e, width: Math.max(7, r * 0.2), alpha: 1 });
      weapon.moveTo(size * 0.95, 0).lineTo(size * 1.39, 0)
        .stroke({ color: core, width: Math.max(3, r * 0.09), alpha: 0.98 });
      weapon.rect(size * 1.34, -size * 0.1, size * 0.12, size * 0.2).fill({ color: 0x10171e, alpha: 1 });
      weapon.rect(size * 1.34, -size * 0.1, size * 0.12, size * 0.2)
        .stroke({ color: outline, width: Math.max(2, r * 0.045), alpha: 0.76 });
      weapon.moveTo(size * 0.5, size * 0.14).lineTo(size * 0.58, size * 0.4).lineTo(size * 0.76, size * 0.14)
        .fill({ color: 0x111820, alpha: 0.98 });
      weapon.moveTo(size * 0.5, size * 0.14).lineTo(size * 0.58, size * 0.4).lineTo(size * 0.76, size * 0.14)
        .stroke({ color: outline, width: Math.max(2, r * 0.045), alpha: 0.65 });
      return;
    }
    if (attack.form === 'launcher') {
      if (attack.visualId === 'guided-rocket-launcher') {
        const outline = 0xf6fbff;
        const shell = 0x18232d;
        const dark = 0x0d141b;
        const rail = 0x3d4f5d;
        const rocket = 0xff8a38;
        const hot = 0xffe281;
        const rear = -size * 0.3;
        const muzzle = size * 1.42;

        // Vanguard launcher v3: deliberately slimmer and better proportioned
        // to the fighter. The long tube and exposed rocket carry the identity;
        // bulky square masses are kept small so it no longer swallows the body.
        weapon.rect(rear, -size * 0.13, size * 1.46, size * 0.26)
          .fill({ color: shell, alpha: 1 });
        weapon.rect(rear, -size * 0.13, size * 1.46, size * 0.26)
          .stroke({ color: outline, width: Math.max(2, r * 0.045), alpha: 0.82 });
        weapon.rect(-size * 0.18, -size * 0.08, size * 0.82, size * 0.16)
          .fill({ color: rail, alpha: 0.95 });
        weapon.rect(-size * 0.02, -size * 0.22, size * 0.56, size * 0.07)
          .fill({ color: core, alpha: 0.94 });

        // Loaded rocket is readable without turning the launcher into a giant
        // muzzle block.
        weapon.moveTo(size * 0.48, -size * 0.07)
          .lineTo(size * 1.18, -size * 0.07)
          .lineTo(muzzle, 0)
          .lineTo(size * 1.18, size * 0.07)
          .lineTo(size * 0.48, size * 0.07)
          .closePath().fill({ color: rocket, alpha: 0.98 });
        weapon.moveTo(size * 0.62, 0).lineTo(size * 1.25, 0)
          .stroke({ color: hot, width: Math.max(2.5, r * 0.065), alpha: 0.94 });

        // Compact rear exhaust, grip and muzzle collars preserve the military
        // launcher silhouette without exceeding the fighter's visual mass.
        weapon.rect(rear - size * 0.09, -size * 0.17, size * 0.16, size * 0.34)
          .fill({ color: dark, alpha: 1 });
        weapon.rect(rear - size * 0.09, -size * 0.17, size * 0.16, size * 0.34)
          .stroke({ color: outline, width: Math.max(2, r * 0.04), alpha: 0.68 });
        weapon.moveTo(size * 0.08, size * 0.12)
          .lineTo(size * 0.02, size * 0.31)
          .lineTo(size * 0.28, size * 0.13)
          .closePath().fill({ color: dark, alpha: 1 });
        weapon.rect(size * 1.08, -size * 0.17, size * 0.22, size * 0.34)
          .stroke({ color: outline, width: Math.max(2, r * 0.045), alpha: 0.78 });
        weapon.rect(size * 1.14, -size * 0.1, size * 0.1, size * 0.2)
          .stroke({ color: 0xffbd58, width: Math.max(2.5, r * 0.065), alpha: 0.94 });
      } else if (attack.visualId.includes('rocket')) {
        weapon.rect(size * 0.08, -size * 0.19, size * 0.98, size * 0.38).fill({ color: 0x29343d, alpha: 1 });
        weapon.rect(size * 0.18, -size * 0.12, size * 0.72, size * 0.24).fill({ color: accent, alpha: 0.8 });
        weapon.circle(size * 1.03, 0, size * 0.22).stroke({ color: 0xffc15d, width: Math.max(3, r * 0.11), alpha: 0.95 });
        weapon.moveTo(size * 0.16, size * 0.18).lineTo(size * 0.03, size * 0.38).lineTo(size * 0.35, size * 0.19).fill({ color: 0x171f27, alpha: 1 });
      } else {
        const x = size * 0.66;
        weapon.circle(x, 0, size * 0.26).fill({ color: 0x171a22, alpha: 1 });
        weapon.circle(x, 0, size * 0.22).stroke({ color: 0xff883a, width: 3, alpha: 0.92 });
        weapon.moveTo(x + size * 0.14, -size * 0.14).lineTo(x + size * 0.28, -size * 0.34).stroke({ color: 0xcab58e, width: 3, alpha: 0.95 });
        weapon.circle(x + size * 0.29, -size * 0.35, Math.max(3, r * 0.13)).fill({ color: 0xffd05a, alpha: 1 });
      }
      return;
    }
    if (attack.form === 'claws') {
      for (let index = -1; index <= 1; index += 1) {
        weapon.moveTo(size * 0.08, index * size * 0.08).lineTo(size * 1.42, index * size * 0.14 - size * 0.08).stroke({ color: index === 0 ? core : accent, width: Math.max(3, r * 0.11), alpha: 0.94 });
      }
      return;
    }
    if (attack.form === 'void') {
      const end = size * 1.58;
      weapon.moveTo(size * 0.04, size * 0.05).lineTo(end * 0.76, 0).stroke({ color: 0x58307f, width: Math.max(4, r * 0.13), alpha: 0.98 });
      weapon.moveTo(end * 0.7, 0).quadraticCurveTo(end, -size * 0.38, end * 1.12, -size * 0.08).lineTo(end * 0.92, size * 0.02).quadraticCurveTo(end * 0.84, -size * 0.17, end * 0.7, 0).fill({ color: accent, alpha: 0.94 });
      return;
    }
    if (attack.form === 'axe' || attack.form === 'hammer') {
      const end = size * 1.00;
      weapon.moveTo(size * 0.02, 0).lineTo(end, 0).stroke({ color: attack.form === 'axe' ? 0xc5f4ff : 0x8095a5, width: Math.max(4, r * 0.12), alpha: 0.97 });
      if (attack.form === 'axe') {
        weapon.moveTo(end - size * 0.1, -size * 0.26).lineTo(end + size * 0.3, 0).lineTo(end - size * 0.1, size * 0.26).lineTo(end - size * 0.24, 0).fill({ color: 0x8ee9ff, alpha: 0.94 });
      } else {
        weapon.rect(end - size * 0.1, -size * 0.2, size * 0.52, size * 0.4).fill({ color: accent, alpha: 0.96 });
      }
      return;
    }
    if (attack.form === 'spear') {
      const end = size * 1.78;
      weapon.moveTo(-size * 0.02, 0).lineTo(end, 0).stroke({ color: 0xa9c7d7, width: Math.max(4, r * 0.12), alpha: 0.98 });
      weapon.moveTo(end, 0).lineTo(end - size * 0.32, -size * 0.15).lineTo(end - size * 0.17, 0).lineTo(end - size * 0.32, size * 0.15).lineTo(end, 0).fill({ color: core, alpha: 0.98 });
      return;
    }
    // Sword fallback: longer blade with a deliberately slimmer top-down profile.
    const handleStart = -size * 0.16;
    const guardX = size * 0.12;
    const end = size * 1.82;
    weapon.moveTo(handleStart, 0).lineTo(guardX, 0).stroke({ color: 0x5a3624, width: Math.max(5, r * 0.15), alpha: 1 });
    weapon.circle(handleStart, 0, Math.max(3, r * 0.1)).fill({ color: 0xd9ad5e, alpha: 0.98 });
    weapon.moveTo(guardX, -size * 0.18).lineTo(guardX, size * 0.18).stroke({ color: core, width: Math.max(4, r * 0.12), alpha: 1 });
    weapon.moveTo(guardX + size * 0.04, -size * 0.1).lineTo(end - size * 0.14, -size * 0.16).lineTo(end + size * 0.34, 0).lineTo(end - size * 0.14, size * 0.16).lineTo(guardX + size * 0.04, size * 0.1).fill({ color: accent, alpha: 0.98 });
    weapon.moveTo(guardX + size * 0.12, 0).lineTo(end, 0).stroke({ color: 0xffffff, width: Math.max(2, r * 0.06), alpha: 0.55 });
  }

  private drawIdentityWeaponSilhouette(weapon: Graphics, r: number, attack: PrimaryAttackDefinition): void {
    this.drawConfiguredWeapon(weapon, r * 0.8, attack);
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
    this.meleeArmRig.clear();
    this.meleeAttackFx.clear();
    this.heldWeaponPose = null;
    this.body.clear();
    this.damageOverlay.clear();
    this.core.clear();
    for (const view of this.weaponMountViews) view.graphics.clear();
    this.velocityVector.clear();
    this.healthRing.resetRenderCache();
    this.resourceRing.resetRenderCache();
    if (this.label) { this.label.destroy(); this.label = null; }

    if (this.entity.controller === 'player') {
      this.playerMarker.circle(0, 0, r * 1.48).stroke({ color: 0xffffff, width: 2.2, alpha: 0.48 });
    }

    this.weaponGeometryScale = profile.showCharacterLayers && this.lod !== 'army' ? 1 : 0.8;

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

      // Every fighter now exposes the same subtle +X/front cue. This makes
      // anatomical right/left visually inspectable instead of inferred from a
      // rotationally symmetric body.
      const anatomy = resolveFighterAnatomy(r);
      this.body.moveTo(r * 0.5, -r * 0.16)
        .lineTo(anatomy.front.x, 0)
        .lineTo(r * 0.5, r * 0.16)
        .closePath()
        .fill({ color: this.visual.accentColor, alpha: 0.2 });
      this.body.moveTo(r * 0.58, 0).lineTo(anatomy.front.x, 0)
        .stroke({ color: this.visual.coreColor, width: Math.max(2, r * 0.055), alpha: 0.52 });

      this.damageOverlay.circle(0, 0, r * 0.98).fill({ color: 0xff172f, alpha: 0.98 });
      this.damageOverlay.circle(0, 0, r * 1.08).stroke({ color: 0xff5364, width: Math.max(4, r * 0.16), alpha: 0.94 });
      this.damageOverlay.circle(-r * 0.24, -r * 0.24, r * 0.46).fill({ color: 0xffffff, alpha: 0.42 });
      this.damageOverlay.alpha = 0;
      this.core.circle(0, 0, r * 0.3).fill({ color: this.visual.coreColor, alpha: 1 });
      this.core.circle(0, 0, r * 0.5).stroke({ color: this.visual.coreColor, width: 2, alpha: 0.42 });
      if (this.visual.horns && this.lod === 'hero') {
        // Horns now act as a forward crown/brow around the canonical +X front
        // instead of sitting on the old screen-top axis and contradicting the
        // anatomy rig.
        const hornBaseX = r * 0.46;
        const hornTipX = anatomy.front.x + r * 0.08;
        this.body.moveTo(hornBaseX, -r * 0.18).lineTo(hornTipX, -r * 0.3)
          .stroke({ color: this.visual.accentColor, width: Math.max(4, r * 0.12), alpha: 0.96 });
        this.body.moveTo(hornBaseX, r * 0.18).lineTo(hornTipX, r * 0.3)
          .stroke({ color: this.visual.accentColor, width: Math.max(4, r * 0.12), alpha: 0.96 });
        this.body.moveTo(r * 0.58, -r * 0.08).lineTo(anatomy.front.x, 0).lineTo(r * 0.58, r * 0.08)
          .stroke({ color: this.visual.accentColor, width: Math.max(2.5, r * 0.07), alpha: 0.74 });
      }
      for (const view of this.weaponMountViews) this.drawConfiguredWeapon(view.graphics, r, this.weaponDefinition);
    } else {
      const color = this.visual.bodyColor;
      this.body.circle(0, 0, r).fill({ color, alpha: this.lod === 'army' || this.profileId === 'minimal' ? 0.9 : 0.08 });
      this.body.circle(0, 0, r).stroke({ color: this.profileId === 'debug' ? 0xffffff : this.visual.accentColor, width: this.profileId === 'debug' ? 2 : 3, alpha: 0.95 });
      this.core.circle(0, 0, Math.max(3, r * 0.25)).fill({ color: this.visual.coreColor, alpha: 1 });
      this.body.moveTo(-r * 0.45, -r * 0.52).lineTo(r * 0.36, r * 0.5).stroke({ color: this.visual.bodyDarkColor, width: Math.max(2, r * 0.13), alpha: 0.62 });
      this.damageOverlay.circle(0, 0, r).fill({ color: 0xff1730, alpha: 0.98 });
      this.damageOverlay.circle(0, 0, r * 1.08).stroke({ color: 0xff5a68, width: Math.max(3, r * 0.14), alpha: 0.92 });
      this.damageOverlay.alpha = 0;
      for (const view of this.weaponMountViews) this.drawIdentityWeaponSilhouette(view.graphics, r, this.weaponDefinition);
    }

    if (profile.showLabels && this.lod !== 'army') {
      this.label = new Text({ text: `#${this.entity.id}`, style: { fill: 0xffffff, fontSize: 12, fontFamily: 'monospace' } });
      this.label.x = this.entity.radius + 8;
      this.label.y = -this.entity.radius - 8;
      this.container.addChild(this.label);
    }
  }
}
