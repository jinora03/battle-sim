import { Container, Graphics, Text } from 'pixi.js';
import { getAbility } from '@kinetic/content';
import type { EntityId, EntitySnapshot, Vec2, WorldSnapshot } from '@kinetic/protocol';
import { getAbilityCombatVfxProfile, getSkillPresentation, type SkillPresentationRecipe } from '@kinetic/visual-engine';

export class SkillTelegraphRenderer {
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
        const beamTelegraph = getAbilityCombatVfxProfile(recipe.abilityId)?.telegraph;
        if (beamTelegraph?.kind === 'dual-eye-beam') {
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
          const eyeChargeEnd = beamTelegraph.eyeChargeTicks;
          const beamStart = beamTelegraph.beamStartTicks;
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
            const length = beamTelegraph.range;
            const endX = x + dx * length;
            const endY = y + dy * length;
            const activeTicks = elapsedTicks - beamStart;
            const ramp = activeTicks < 54 ? 0 : activeTicks < 108 ? 1 : 2;
            const outerWidth = 18 + ramp * 5 + pulse * 3;
            const middleWidth = 8 + ramp * 2;
            const coreWidth = 2.8 + ramp * 0.8;
            const beamAlpha = 0.58 + beamProgress * 0.32;

            for (const [eyeX, eyeY] of [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]] as const) {
              this.graphics.moveTo(eyeX, eyeY).lineTo(endX, endY).stroke({ color: beamTelegraph.outerColor, width: outerWidth, alpha: 0.13 + ramp * 0.025 });
              this.graphics.moveTo(eyeX, eyeY).lineTo(endX, endY).stroke({ color: beamTelegraph.middleColor, width: middleWidth, alpha: beamAlpha });
              this.graphics.moveTo(eyeX, eyeY).lineTo(endX, endY).stroke({ color: beamTelegraph.coreColor, width: coreWidth, alpha: 0.98 });
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
