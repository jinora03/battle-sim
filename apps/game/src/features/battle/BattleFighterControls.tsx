import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  getAbility,
  getAbilityActivationProfile,
  getFighter,
  getPrimaryAttack,
  getPrimaryAttackActivationProfile,
  isCustomFighter,
  type AttackForm,
  type PrimaryAttackDefinition
} from '@kinetic/content';
import type { AbilitySlot, AbilityStateSnapshot, EntitySnapshot, Vec2 } from '@kinetic/protocol';
import { getSkillPresentation } from '@kinetic/visual-engine';
import type { RecentSkillActivity, RuntimeDiagnostics } from '../../runtime/BattleRuntime';
import { hexColor } from '../../ui/FormControls';

export function DirectionPad({ onDirection, sensitivity = 1 }: {
  onDirection: (direction: Vec2) => void;
  sensitivity?: number;
}) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const onDirectionRef = useRef(onDirection);
  const targetStickRef = useRef<Vec2>({ x: 0, y: 0 });
  const currentStickRef = useRef<Vec2>({ x: 0, y: 0 });
  const targetDirectionRef = useRef<Vec2>({ x: 0, y: 0 });
  const currentDirectionRef = useRef<Vec2>({ x: 0, y: 0 });

  useEffect(() => {
    onDirectionRef.current = onDirection;
  }, [onDirection]);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      const currentStick = currentStickRef.current;
      const targetStick = targetStickRef.current;
      const currentDirection = currentDirectionRef.current;
      const targetDirection = targetDirectionRef.current;
      const stickResponse = pointerIdRef.current === null ? 0.22 : 0.34;
      const movementResponse = pointerIdRef.current === null ? 0.18 : 0.26;

      currentStick.x += (targetStick.x - currentStick.x) * stickResponse;
      currentStick.y += (targetStick.y - currentStick.y) * stickResponse;
      currentDirection.x += (targetDirection.x - currentDirection.x) * movementResponse;
      currentDirection.y += (targetDirection.y - currentDirection.y) * movementResponse;

      if (Math.abs(currentStick.x) < 0.02) currentStick.x = 0;
      if (Math.abs(currentStick.y) < 0.02) currentStick.y = 0;
      if (Math.abs(currentDirection.x) < 0.002) currentDirection.x = 0;
      if (Math.abs(currentDirection.y) < 0.002) currentDirection.y = 0;

      const intensity = Math.min(1, Math.hypot(currentDirection.x, currentDirection.y));
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${currentStick.x.toFixed(2)}px, ${currentStick.y.toFixed(2)}px) scale(${(1 + intensity * 0.06).toFixed(3)})`;
      }
      if (padRef.current) {
        padRef.current.style.setProperty('--stick-intensity', intensity.toFixed(3));
        padRef.current.style.setProperty('--stick-border-alpha', (0.16 + intensity * 0.18).toFixed(3));
        padRef.current.style.setProperty('--stick-inset-alpha', (0.07 + intensity * 0.08).toFixed(3));
        padRef.current.style.setProperty('--stick-glow-alpha', (0.05 + intensity * 0.11).toFixed(3));
        padRef.current.style.setProperty('--stick-halo-size', `${(10 + intensity * 18).toFixed(1)}px`);
        padRef.current.style.setProperty('--stick-guide-opacity', (0.34 + intensity * 0.28).toFixed(3));
        padRef.current.style.setProperty('--stick-ring-alpha', (0.18 + intensity * 0.18).toFixed(3));
        padRef.current.style.setProperty('--stick-ring-scale', (1 + intensity * 0.025).toFixed(3));
        padRef.current.style.setProperty('--stick-core-opacity', (0.72 - intensity * 0.26).toFixed(3));
        padRef.current.style.setProperty('--stick-core-scale', (1 - intensity * 0.18).toFixed(3));
        padRef.current.style.setProperty('--stick-knob-core-opacity', (0.68 + intensity * 0.28).toFixed(3));
        if (intensity > 0.03) {
          const angle = Math.atan2(currentDirection.y, currentDirection.x) * 180 / Math.PI;
          padRef.current.style.setProperty('--stick-angle', `${angle.toFixed(1)}deg`);
        }
        padRef.current.style.setProperty('--stick-arrow-opacity', Math.min(1, Math.max(0, (intensity - 0.03) * 1.7)).toFixed(3));
        padRef.current.dataset.active = pointerIdRef.current === null ? 'false' : 'true';
      }
      onDirectionRef.current({ ...currentDirection });
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updateFromClient = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = clientX - centerX;
    const rawY = clientY - centerY;
    const visualRadius = rect.width * 0.31;
    const inputRadius = rect.width * 0.42;
    const length = Math.hypot(rawX, rawY);
    const safeLength = Math.max(0.001, length);
    const clampedScale = length > visualRadius ? visualRadius / safeLength : 1;
    targetStickRef.current = { x: rawX * clampedScale, y: rawY * clampedScale };

    const deadzone = Math.max(7, rect.width * 0.065);
    if (length <= deadzone) {
      targetDirectionRef.current = { x: 0, y: 0 };
      return;
    }
    const normalized = { x: rawX / safeLength, y: rawY / safeLength };
    const linear = Math.max(0, Math.min(1, ((length - deadzone) / Math.max(1, inputRadius - deadzone)) * sensitivity));
    const eased = linear * linear * (3 - 2 * linear);
    targetDirectionRef.current = { x: normalized.x * eased, y: normalized.y * eased };
  };

  const stop = () => {
    pointerIdRef.current = null;
    targetStickRef.current = { x: 0, y: 0 };
    targetDirectionRef.current = { x: 0, y: 0 };
  };

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClient(event.clientX, event.clientY);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    updateFromClient(event.clientX, event.clientY);
  };

  return (
    <div
      ref={padRef}
      className="analog-pad"
      aria-label="Touch movement controls"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <div className="analog-pad-ring" />
      <div className="analog-pad-axis analog-pad-axis-horizontal" />
      <div className="analog-pad-axis analog-pad-axis-vertical" />
      <div className="analog-pad-arrow" aria-hidden="true" />
      <div className="analog-pad-core" />
      <div ref={knobRef} className="analog-pad-knob"><i /></div>
    </div>
  );
}

export function FighterCard({ entity, tick, stats, recentSkills, onActivate, onPreview }: {
  entity: EntitySnapshot;
  tick: number;
  stats: RuntimeDiagnostics['stats'][number] | undefined;
  recentSkills: RecentSkillActivity[];
  onActivate?: ((slot: AbilitySlot) => void) | undefined;
  onPreview?: ((slot: AbilitySlot) => void) | undefined;
}) {
  const fighter = getFighter(entity.fighterId);
  const hpRatio = Math.max(0, entity.hp / Math.max(1, entity.maxHp));
  return (
    <article className={`fighter-card team-${entity.team} ${entity.controller === 'player' ? 'player-controlled' : ''}`}>
      <div className={`fighter-icon ${fighterIconClass(fighter)}`}>{entity.id + 1}</div>
      <div className="fighter-card-copy">
        <div className="fighter-card-heading">
          <strong>{fighter.name} <em>{entity.controller === 'player' ? 'PLAYER' : 'AI'}</em>{isCustomFighter(fighter.id) && <b>CUSTOM</b>}</strong>
          <span>{Math.ceil(entity.hp)} / {Math.ceil(entity.maxHp)} HP</span>
        </div>
        <div className="hp-track"><i style={{ width: `${hpRatio * 100}%` }} /></div>
        <span className="fighter-telemetry">{stats ? `${stats.damageDealt.toFixed(0)} dmg · ${stats.abilitiesUsed} skills · ${stats.blasts} blasts · ${stats.obstaclesDestroyed} wrecked` : 'collecting telemetry…'}</span>
        {entity.activeZoneIds.length > 0 && (
          <div className="active-zone-tags">
            {entity.activeZoneIds.map((zoneId) => <span key={`${entity.id}-${zoneId}`}>{zoneId.replaceAll('-', ' ')}</span>)}
          </div>
        )}
        <div className="skill-grid">
          {entity.abilities.map((ability) => (
            <SkillIndicator
              key={`${entity.id}-${ability.slot}`}
              state={ability}
              entityId={entity.id}
              tick={tick}
              recentSkills={recentSkills}
              controllable={entity.controller === 'player'}
              onPreview={onPreview ? () => onPreview(ability.slot) : undefined}
              onActivate={onActivate ? () => onActivate(ability.slot) : undefined}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export function SkillIndicator({ state, entityId, tick, recentSkills, controllable = false, compact = false, onActivate, onPreview }: {
  state: AbilityStateSnapshot;
  entityId: number;
  tick: number;
  recentSkills: RecentSkillActivity[];
  controllable?: boolean;
  compact?: boolean;
  onActivate?: (() => void) | undefined;
  onPreview?: (() => void) | undefined;
}) {
  const touchActivatedRef = useRef(false);
  const primary = state.source === 'primaryAttack' ? getPrimaryAttack(state.abilityId) : null;
  const ability = primary ? null : getAbility(state.abilityId);
  const skillRecipe = primary ? null : getSkillPresentation(state.abilityId);
  const activation = primary ? getPrimaryAttackActivationProfile(primary) : getAbilityActivationProfile(ability!);
  const color = primary ? primaryAttackUiColor(primary.form) : skillRecipe!.color;
  const importance = primary ? 'basic' : skillRecipe!.importance;
  const icon = primary ? primaryAttackIcon(primary) : skillRecipe!.icon;
  const shortName = primary ? primary.name : skillRecipe!.shortName;
  const recent = [...recentSkills].reverse().find((item) => item.entityId === entityId && item.abilityId === state.abilityId);
  const recentlyResolved = recent?.phase === 'resolved' && tick - recent.tick <= 180;
  const cooldownRatio = state.cooldownTotalTicks > 0 ? state.cooldownRemainingTicks / state.cooldownTotalTicks : 0;
  const castRatio = state.castTotalTicks > 0 ? 1 - state.castRemainingTicks / state.castTotalTicks : 0;
  const seconds = (state.cooldownRemainingTicks / 60).toFixed(1);
  const slot = state.slot === 'ultimate' ? 'ULT' : state.slot === 'basic' ? 'B' : `S${state.slot.slice(-1)}`;
  const activatable = activation.intent !== 'reactive';
  const enabled = controllable && activatable && state.phase === 'ready';
  const armedRatio = state.armedTotalTicks > 0 ? state.armedRemainingTicks / state.armedTotalTicks : 0;
  const cooldownTicks = primary?.cooldownTicks ?? ability?.cooldownTicks ?? 0;

  return (
    <button
      type="button"
      className={`skill-indicator ${state.phase} ${importance} ${recentlyResolved ? 'just-resolved' : ''} ${compact ? 'compact' : ''} ${controllable ? 'interactive' : ''}`}
      title={`${shortName} · ${activation.intent} · ${(cooldownTicks / 60).toFixed(1)}s cooldown`}
      style={{ '--skill-color': hexColor(color), '--cooldown-cover': `${cooldownRatio * 100}%` } as CSSProperties}
      disabled={!enabled}
      onPointerEnter={onPreview}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        onPreview?.();
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
          touchActivatedRef.current = true;
          onActivate?.();
        }
      }}
      onFocus={onPreview}
      onClick={() => {
        if (touchActivatedRef.current) {
          touchActivatedRef.current = false;
          return;
        }
        onActivate?.();
      }}
    >
      <span className="skill-slot">{slot}</span>
      <strong className="skill-icon-text">{icon}</strong>
      {!activatable && <span className="passive-mark">AUTO</span>}
      {state.phase === 'armed' && <span className="armed-mark">ARMED</span>}
      {state.phase === 'cooldown' && <span className="cooldown-number">{seconds}</span>}
      {state.phase === 'casting' && <span className="cast-fill" style={{ width: `${castRatio * 100}%` }} />}
      {state.phase === 'armed' && <span className="armed-fill" style={{ width: `${armedRatio * 100}%` }} />}
      <span className="cooldown-shade" />
    </button>
  );
}

export function activityPresentation(attackOrAbilityId: string, primary: boolean): {
  shortName: string;
  icon: string;
  color: number;
  importance: 'basic' | 'skill' | 'ultimate';
} {
  if (primary) {
    const attack = getPrimaryAttack(attackOrAbilityId);
    return {
      shortName: attack.name,
      icon: primaryAttackIcon(attack),
      color: primaryAttackUiColor(attack.form),
      importance: 'basic'
    };
  }
  return getSkillPresentation(attackOrAbilityId);
}

function primaryAttackIcon(attack: PrimaryAttackDefinition): string {
  if (attack.behavior === 'spin') return 'SP';
  if (attack.behavior === 'automatic') return 'AR';
  if (attack.behavior === 'throwable') return 'TH';
  if (attack.behavior === 'slam') return 'SL';
  return attack.form.slice(0, 2).toUpperCase();
}

function primaryAttackUiColor(form: AttackForm): number {
  if (form === 'fire') return 0xff7433;
  if (form === 'water') return 0x63dfff;
  if (form === 'ice') return 0xc9f6ff;
  if (form === 'lightning') return 0xffef65;
  if (form === 'nature') return 0x9de277;
  if (form === 'void') return 0xbe82ff;
  return 0xffe2a3;
}

function fighterIconClass(fighter: ReturnType<typeof getFighter>): string {
  const element = fighter.classification.elements[0] ?? 'neutral';
  if (['water', 'fire', 'electric', 'ice', 'nature', 'void'].includes(element)) return element;
  if (fighter.id.includes('bomber')) return 'bomber';
  return 'mech';
}
