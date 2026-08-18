import type { BroadcastRect } from './broadcastLayout';

export type FighterCardTextAlign = 'left' | 'center' | 'right';

export interface FighterIdentityGeometry {
  textX: number;
  textAlign: FighterCardTextAlign;
  maxWidth: number;
  nameY: number;
  identityY: number;
}

export interface FighterWeaponGeometry {
  centerX: number;
  previewY: number;
  previewSize: number;
  labelY: number;
  labelWidth: number;
  fallbackLabelY: number;
  fallbackLabelWidth: number;
}

export interface FighterHpGeometry {
  labelY: number | null;
  bar: BroadcastRect;
  valueY: number;
}

export interface VerticalFighterCardGeometry {
  padding: number;
  name: {
    textX: number;
    textAlign: FighterCardTextAlign;
    maxWidth: number;
    y: number;
  };
  portrait: {
    centerX: number;
    centerY: number;
    radius: number;
    facing: 'left' | 'right';
  };
  hp: BroadcastRect;
}

export interface LandscapeFighterCardGeometry {
  padding: number;
  identity: FighterIdentityGeometry;
  eyebrowY: number;
  weapon: FighterWeaponGeometry | null;
  hp: FighterHpGeometry;
}

/**
 * Resolves the compact vertical creator fighter card. The fighter body and
 * viewer-facing name form one centered mirrored group, with only a thin HP
 * bar retained underneath. Weapon/archetype metadata stays out of Shorts.
 */
export function getVerticalFighterCardGeometry(
  rect: BroadcastRect,
  alignRight: boolean
): VerticalFighterCardGeometry {
  const padding = 28;
  const portraitRadius = 58;
  const nameWidth = 150;
  const groupGap = 18;
  const portraitDiameter = portraitRadius * 2;
  const groupWidth = nameWidth + groupGap + portraitDiameter;
  const groupLeft = rect.x + (rect.width - groupWidth) / 2;

  const nameCenterX = alignRight
    ? groupLeft + portraitDiameter + groupGap + nameWidth / 2
    : groupLeft + nameWidth / 2;
  const portraitCenterX = alignRight
    ? groupLeft + portraitRadius
    : groupLeft + nameWidth + groupGap + portraitRadius;

  return {
    padding,
    name: {
      textX: nameCenterX,
      textAlign: 'center',
      maxWidth: nameWidth,
      y: rect.y + 102
    },
    portrait: {
      centerX: portraitCenterX,
      centerY: rect.y + 86,
      radius: portraitRadius,
      facing: alignRight ? 'left' : 'right'
    },
    hp: {
      x: rect.x + 42,
      y: rect.y + rect.height - 30,
      width: rect.width - 84,
      height: 12
    }
  };
}

/**
 * Resolves the identity/weapon/HP geometry at the top of a landscape fighter
 * rail. Ability, resource and status placement remain owned by fighterHud.
 */
export function getLandscapeFighterCardGeometry(
  rect: BroadcastRect,
  alignRight: boolean,
  showWeapon: boolean
): LandscapeFighterCardGeometry {
  const padding = 24;
  const weaponColumnWidth = showWeapon ? 112 : 0;
  const textX = alignRight ? rect.x + rect.width - padding : rect.x + padding;
  const textAlign: FighterCardTextAlign = alignRight ? 'right' : 'left';

  return {
    padding,
    eyebrowY: rect.y + 34,
    identity: {
      textX,
      textAlign,
      maxWidth: rect.width - padding * 2 - weaponColumnWidth,
      nameY: rect.y + 76,
      identityY: rect.y + 106
    },
    weapon: showWeapon ? {
      centerX: alignRight ? rect.x + 62 : rect.x + rect.width - 62,
      previewY: rect.y + 108,
      previewSize: 46,
      labelY: rect.y + 154,
      labelWidth: 106,
      fallbackLabelY: rect.y + 152,
      fallbackLabelWidth: 98
    } : null,
    hp: {
      labelY: rect.y + 169,
      bar: {
        x: rect.x + padding,
        y: rect.y + 182,
        width: rect.width - padding * 2,
        height: 24
      },
      valueY: rect.y + 226
    }
  };
}
