import type { AbilityActivationProfile, AbilityDefinition, FighterDefinition, PrimaryAttackDefinition } from '../schemas';
import { getAbility, getPrimaryAttack, getSkillProjectile } from '../registries/contentRegistry';

/**
 * Returns the reusable activation contract for an ability. Content may override
 * any field, while older definitions receive deterministic defaults derived
 * from their trigger/action composition.
 */
const ABILITY_ACTIVATION_PROFILE_CACHE = new WeakMap<AbilityDefinition, AbilityActivationProfile>();

export function getAbilityActivationProfile(
  abilityOrId: AbilityDefinition | string,
  fighterOrId?: FighterDefinition | string | null
): AbilityActivationProfile {
  const ability = typeof abilityOrId === 'string' ? getAbility(abilityOrId) : abilityOrId;
  void fighterOrId;
  // The profile is a pure function of the ability definition (the fighter arg is
  // intentionally unused), so memoize per ability object. Re-registered content
  // produces a new object identity and therefore recomputes.
  const cachedProfile = ABILITY_ACTIVATION_PROFILE_CACHE.get(ability);
  if (cachedProfile) return cachedProfile;
  const allActions = ability.triggers.flatMap((trigger) => trigger.actions);
  const activateActions = ability.triggers.filter((trigger) => trigger.event === 'ON_ACTIVATE').flatMap((trigger) => trigger.actions);
  const hasCollision = ability.triggers.some((trigger) => trigger.event === 'ON_COLLISION');
  const hasDirectTarget = allActions.some((action) => action.type === 'DEAL_DAMAGE_TARGET' || action.type === 'APPLY_STATUS_TARGET' || action.type === 'APPLY_KNOCKBACK_TARGET' || action.type === 'EXPLODE_AT_TARGET' || action.type === 'AREA_EFFECT_AT_TARGET' || (action.type === 'LAUNCH_PROJECTILES' && action.targetMode !== 'distributed'));
  const hasArea = allActions.some((action) => action.type === 'RADIAL_DAMAGE' || action.type === 'DIRECTIONAL_DAMAGE' || action.type === 'RADIAL_STATUS' || action.type === 'RADIAL_IMPULSE' || action.type === 'EXPLODE' || action.type === 'EXPLODE_AT_TARGET' || action.type === 'AREA_EFFECT_AT_TARGET' || action.type === 'DETONATE_STATUS' || (action.type === 'LAUNCH_PROJECTILES' && (action.pattern === 'radial' || action.targetMode === 'distributed')));
  const hasHeal = activateActions.some((action) => action.type === 'HEAL_SELF');
  const hasSelfStatus = activateActions.some((action) => action.type === 'APPLY_STATUS_SELF');
  const hasImpulseSelf = activateActions.some((action) => action.type === 'APPLY_IMPULSE_SELF');
  const hasDamage = allActions.some((action) => action.type === 'DEAL_DAMAGE_TARGET' || action.type === 'RADIAL_DAMAGE' || action.type === 'DIRECTIONAL_DAMAGE' || action.type === 'DETONATE_STATUS' || action.type === 'LAUNCH_PROJECTILES' || ((action.type === 'EXPLODE' || action.type === 'EXPLODE_AT_TARGET' || action.type === 'AREA_EFFECT_AT_TARGET') && action.damage > 0));

  let intent: AbilityActivationProfile['intent'] = 'offensive';
  if (!hasDamage && hasHeal) intent = 'defensive';
  else if (!hasDamage && hasSelfStatus && !hasImpulseSelf) intent = 'defensive';
  else if (!hasDamage && hasImpulseSelf) intent = 'movement';
  else if (!hasDamage) intent = 'support';

  let targeting: AbilityActivationProfile['targeting'] = 'target';
  if (intent === 'defensive' || intent === 'support') targeting = 'self';
  else if (hasArea) targeting = 'area';
  else if (intent === 'movement') targeting = 'direction';
  else if (hasDirectTarget || hasCollision) targeting = 'target';

  const radii = allActions.flatMap((action) => {
    if (action.type === 'RADIAL_DAMAGE' || action.type === 'RADIAL_STATUS' || action.type === 'RADIAL_IMPULSE' || action.type === 'EXPLODE' || action.type === 'EXPLODE_AT_TARGET' || action.type === 'AREA_EFFECT_AT_TARGET' || action.type === 'DETONATE_STATUS') return [action.radius];
    if (action.type === 'DIRECTIONAL_DAMAGE') return [action.range];
    if (action.type === 'LAUNCH_PROJECTILES') {
      const projectile = getSkillProjectile(action.projectileId);
      return [projectile.projectile.speed * projectile.projectile.lifetimeTicks];
    }
    return [];
  });
  const effectRadius = radii.length > 0 ? Math.max(...radii) : 0;
  const slotPriority: Record<AbilityDefinition['slot'], number> = { basic: 25, skill1: 44, skill2: 54, skill3: 64, ultimate: 80 };
  const derived: AbilityActivationProfile = {
    intent,
    targeting,
    priority: intent === 'defensive' ? 92 : slotPriority[ability.slot],
    minRange: 0,
    maxRange: (targeting === 'self' ? 99999 : targeting === 'area' ? Math.max(80, effectRadius) : targeting === 'direction' ? 540 : hasCollision ? 125 : 260),
    requiresLineOfSight: targeting === 'target' || targeting === 'direction',
    minimumTargets: targeting === 'area' && hasDamage ? 1 : 1,
    collisionWindowTicks: hasCollision ? (ability.slot === 'basic' ? 42 : 100) : 0,
    aimToleranceDegrees: targeting === 'target' || targeting === 'direction' ? 95 : 180
  };
  const profile: AbilityActivationProfile = { ...derived, ...ability.activation };
  ABILITY_ACTIVATION_PROFILE_CACHE.set(ability, profile);
  return profile;
}

export function getPrimaryAttackActivationProfile(
  attackOrId: PrimaryAttackDefinition | string
): AbilityActivationProfile {
  const attack = typeof attackOrId === 'string' ? getPrimaryAttack(attackOrId) : attackOrId;
  return {
    intent: 'offensive',
    targeting: attack.behavior === 'spin' || attack.behavior === 'continuous' || attack.behavior === 'orbit' || attack.behavior === 'slam' ? 'area' : 'target',
    priority: 30,
    minRange: attack.minRange,
    maxRange: attack.range,
    requiresLineOfSight: !['melee', 'spin', 'continuous', 'orbit', 'slam'].includes(attack.behavior),
    minimumTargets: 1,
    collisionWindowTicks: 0,
    aimToleranceDegrees: attack.behavior === 'spin' || attack.behavior === 'orbit' ? 180 : Math.max(15, Math.min(140, attack.attackAngleDegrees / 2 + 35))
  };
}
