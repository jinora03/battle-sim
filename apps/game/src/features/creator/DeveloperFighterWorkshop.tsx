import type { ChangeEvent, CSSProperties, Dispatch, SetStateAction } from 'react';
import {
  ATTACK_FORM_BEHAVIORS,
  getFighterModule,
  getPassive,
  getPrimaryAttack,
  isCustomFighter,
  listCompatibleModules,
  type AttackForm,
  type FighterDefinition,
  type FighterModuleDefinition,
  type PrimaryAttackDefinition
} from '@kinetic/content';
import { serializeFighterBundle, type FighterBundle } from '@kinetic/creator';
import type { AbilitySlot, Element, ModuleSlot } from '@kinetic/protocol';
import type { MotionRecipe, VisualRecipe } from '@kinetic/visual-engine';
import {
  ColorField,
  CreatorField,
  CreatorSection,
  Metric,
  RangeField,
  Toggle,
  hexColor
} from '../../ui/FormControls';
import { FighterPortrait } from '../../ui/FighterPortrait';

const ELEMENTS: Element[] = ['neutral', 'fire', 'water', 'ice', 'electric', 'metal', 'nature', 'void'];
const SKILL_SLOTS: AbilitySlot[] = ['skill1', 'skill2', 'skill3', 'ultimate'];
const MODULE_SLOTS: ModuleSlot[] = ['offense', 'defense', 'mobility', 'utility'];

type AbilityCatalog = readonly {
  id: string;
  name: string;
  slot: AbilitySlot;
}[];

type AiProfileCatalog = readonly {
  id: string;
  movementStyle: string;
}[];

interface WorkshopValidation {
  success: boolean;
  errors: readonly string[];
}

export interface DeveloperFighterWorkshopProps {
  active: boolean;
  fighters: readonly FighterDefinition[];
  customBundles: readonly FighterBundle[];
  draft: FighterBundle;
  setDraft: Dispatch<SetStateAction<FighterBundle>>;
  validation: WorkshopValidation;
  creatorMessage: string;
  setCreatorMessage: (message: string) => void;
  importText: string;
  setImportText: (text: string) => void;
  sourceFighterId: string;
  setSourceFighterId: (fighterId: string) => void;
  primaryAttacks: readonly PrimaryAttackDefinition[];
  abilities: AbilityCatalog;
  aiProfiles: AiProfileCatalog;
  onDuplicate(): void;
  onCreateBlank(): void;
  onSave(): void;
  onTest(): void;
  onExport(): void;
  onDelete(): void;
  onImport(): void;
  onSyncIdentity(name: string, idText?: string): void;
}

export function DeveloperFighterWorkshop({
  active,
  fighters,
  customBundles,
  draft,
  setDraft,
  validation,
  creatorMessage,
  setCreatorMessage,
  importText,
  setImportText,
  sourceFighterId,
  setSourceFighterId,
  primaryAttacks,
  abilities,
  aiProfiles,
  onDuplicate,
  onCreateBlank,
  onSave,
  onTest,
  onExport,
  onDelete,
  onImport,
  onSyncIdentity
}: DeveloperFighterWorkshopProps) {
  const kitSource = fighters.find((fighter) => fighter.id === draft.fighter.kitSourceFighterId);
  return (
    <section className={active ? 'creator-workspace' : 'creator-workspace view-hidden'}>
      <aside className="creator-form-column">
        <div className="panel-section creator-source-row">
          <h2>Developer Fighter Workshop</h2>
          <p className="small-note">Internal authoring only. Start from an approved fighter kit, then tune its identity, body and combat values without mixing weapons, skills or modules from unrelated fighters.</p>
          <label className="creator-source-select">
            <span>Approved kit to duplicate</span>
            <select value={sourceFighterId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSourceFighterId(event.target.value)}>
              {fighters.filter((fighter) => !isCustomFighter(fighter.id)).map((fighter) => <option key={fighter.id} value={fighter.id}>{fighter.name}</option>)}
            </select>
          </label>
          <button className="secondary" onClick={onDuplicate}>Duplicate into editable recipe</button>
          <button className="ghost-button" onClick={onCreateBlank}>New Volt-based prototype</button>
        </div>

        <CreatorSection title="Identity & classification">
          <div className="creator-kit-source-card">
            <span>Locked kit source</span>
            <strong>{kitSource?.name ?? 'Legacy unrestricted recipe'}</strong>
            <small>{kitSource ? `Weapon, skills, passives and approved modules stay inside the ${kitSource.name} kit.` : 'Choose a built-in fighter and duplicate it to enable authored compatibility rules.'}</small>
          </div>
          <CreatorField label="Name"><input value={draft.fighter.name} onChange={(event: ChangeEvent<HTMLInputElement>) => onSyncIdentity(event.target.value)} /></CreatorField>
          <CreatorField label="ID"><input value={draft.fighter.id} onChange={(event: ChangeEvent<HTMLInputElement>) => onSyncIdentity(draft.fighter.name, event.target.value)} /></CreatorField>
          <CreatorField label="Archetype"><input value={draft.fighter.classification.archetype} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, classification: { ...current.fighter.classification, archetype: event.target.value } } }))} /></CreatorField>
          <CreatorField label="Primary element">
            <select value={draft.fighter.classification.elements[0]} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, classification: { ...current.fighter.classification, elements: [event.target.value as Element] } } }))}>
              {ELEMENTS.map((element) => <option key={element} value={element}>{element}</option>)}
            </select>
          </CreatorField>
          <CreatorField label="Traits"><input value={draft.fighter.classification.traits.join(', ')} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, classification: { ...current.fighter.classification, traits: splitTags(event.target.value) } } }))} /></CreatorField>
        </CreatorSection>

        <CreatorSection title="Physics & combat stats">
          <RangeField label="HP" value={draft.fighter.stats.maxHp} min={40} max={2000} step={5} onChange={(value) => updateFighterStats(setDraft, draft, 'maxHp', value)} />
          <RangeField label="Radius" value={draft.fighter.physics.radius} min={45} max={100} step={1} onChange={(value) => updateFighterPhysics(setDraft, draft, 'radius', value)} />
          <RangeField label="Mass" value={draft.fighter.physics.mass} min={0.2} max={15} step={0.05} onChange={(value) => updateFighterPhysics(setDraft, draft, 'mass', value)} />
          <RangeField label="Bounce" value={draft.fighter.physics.restitution} min={0} max={1.2} step={0.01} onChange={(value) => updateFighterPhysics(setDraft, draft, 'restitution', value)} />
          <RangeField label="Damping" value={draft.fighter.physics.linearDamping} min={0.95} max={1} step={0.001} onChange={(value) => updateFighterPhysics(setDraft, draft, 'linearDamping', value)} />
          <RangeField label="Max speed" value={draft.fighter.physics.maxSpeed} min={2} max={30} step={0.1} onChange={(value) => updateFighterPhysics(setDraft, draft, 'maxSpeed', value)} />
          <RangeField label="Acceleration" value={draft.fighter.stats.moveAcceleration} min={0.02} max={0.8} step={0.01} onChange={(value) => updateFighterStats(setDraft, draft, 'moveAcceleration', value)} />
        </CreatorSection>

        <CreatorSection title="Primary attack identity">
          <PrimaryAttackEditor draft={draft} setDraft={setDraft} primaryAttacks={primaryAttacks} kitSource={kitSource} />
        </CreatorSection>

        <CreatorSection title="AI & skill loadout">
          <CreatorField label="AI profile">
            <select value={draft.fighter.aiProfileId ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, aiProfileId: event.target.value || null } }))}>
              <option value="">No AI profile</option>
              {aiProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.id} · {profile.movementStyle}</option>)}
            </select>
          </CreatorField>
          <CreatorField label="Basic">
            <div className="primary-basic-summary"><small>Basic</small><strong>{getPrimaryAttack(draft.fighter.primaryAttackId).name}</strong><span>Inherited from the approved kit source</span></div>
          </CreatorField>
          {SKILL_SLOTS.map((slot) => {
            const approvedId = kitSource?.abilitySlots[slot] ?? null;
            const approvedAbility = approvedId ? abilities.find((ability) => ability.id === approvedId) : null;
            const currentId = draft.fighter.abilitySlots[slot] ?? '';
            const invalidCurrent = Boolean(kitSource && currentId && currentId !== approvedId);
            return (
              <CreatorField label={slot === 'ultimate' ? 'Ultimate' : `Skill ${slot.slice(-1)}`} key={slot}>
                <select value={currentId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDraft((current) => ({ ...current, fighter: { ...current.fighter, abilitySlots: { ...current.fighter.abilitySlots, [slot]: event.target.value || null } } }))}>
                  <option value="">Empty</option>
                  {kitSource
                    ? approvedAbility && <option value={approvedAbility.id}>{approvedAbility.name} · approved</option>
                    : abilities.filter((ability) => ability.slot === slot).map((ability) => <option key={ability.id} value={ability.id}>{ability.name}</option>)}
                  {invalidCurrent && <option value={currentId} disabled>{currentId} · incompatible</option>}
                </select>
              </CreatorField>
            );
          })}
        </CreatorSection>

        <CreatorSection title="Default module loadout">
          <ModuleLoadoutEditor draft={draft} setDraft={setDraft} kitSource={kitSource} />
        </CreatorSection>
      </aside>

      <div className="creator-preview-column">
        <div className="creator-preview-card">
          <div className="creator-preview-heading">
            <div><p className="eyebrow">Live recipe preview</p><h2>{draft.fighter.name || 'Unnamed Fighter'}</h2><span>{kitSource ? `${kitSource.name} kit` : 'Legacy recipe'}</span></div>
            <span className={`validation-badge ${validation.success ? 'valid' : 'invalid'}`}>{validation.success ? 'VALID' : `${validation.errors.length} ISSUES`}</span>
          </div>
          <FighterRecipePreview fighter={draft.fighter} visual={draft.visualRecipe} motion={draft.motionRecipe} />
          <div className="creator-stat-board" aria-label="Fighter recipe statistics">
            <RecipeStat label="HP" value={String(draft.fighter.stats.maxHp)} hint="Maximum durability" />
            <RecipeStat label="Radius" value={draft.fighter.physics.radius.toFixed(0)} hint="Arena body size" />
            <RecipeStat label="Mass" value={draft.fighter.physics.mass.toFixed(2)} hint="Knockback resistance" />
            <RecipeStat label="Speed" value={draft.fighter.physics.maxSpeed.toFixed(1)} hint="Top movement speed" />
          </div>
          <div className="creator-preview-loadout">
            <div className="creator-skill-summary">
              {SKILL_SLOTS.map((slot) => {
                const abilityId = draft.fighter.abilitySlots[slot];
                const ability = abilityId ? abilities.find((item) => item.id === abilityId) : null;
                return <span className={slot === 'ultimate' ? 'ultimate' : ''} key={slot}><small>{slot === 'ultimate' ? 'Ultimate' : slot}</small><strong>{ability?.name ?? 'Empty'}</strong></span>;
              })}
            </div>
            <div className="creator-passive-summary">
              <small>Passives</small>
              {(draft.fighter.passiveIds ?? []).length === 0
                ? <span>No passive assigned</span>
                : (draft.fighter.passiveIds ?? []).map((passiveId) => {
                  const passive = safePassive(passiveId);
                  return passive
                    ? <span key={passive.id}><strong>{passive.name}</strong><i>{passive.description}</i></span>
                    : <span key={passiveId}><strong>Unknown passive</strong><i>{passiveId}</i></span>;
                })}
            </div>
          </div>
        </div>

        <CreatorSection title="Visual recipe">
          <div className="creator-grid two-column">
            <CreatorField label="Body template">
              <select value={draft.visualRecipe.shape} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateVisual(setDraft, draft, { shape: event.target.value as VisualRecipe['shape'] })}>
                <option value="orb">Orb</option><option value="mech">Mech</option><option value="water">Water</option><option value="bomber">Bomber</option>
              </select>
            </CreatorField>
            <ColorField label="Body" value={draft.visualRecipe.bodyColor} onChange={(value) => updateVisual(setDraft, draft, { bodyColor: value })} />
            <ColorField label="Body dark" value={draft.visualRecipe.bodyDarkColor} onChange={(value) => updateVisual(setDraft, draft, { bodyDarkColor: value })} />
            <ColorField label="Core" value={draft.visualRecipe.coreColor} onChange={(value) => updateVisual(setDraft, draft, { coreColor: value })} />
            <ColorField label="Aura" value={draft.visualRecipe.auraColor} onChange={(value) => updateVisual(setDraft, draft, { auraColor: value })} />
            <ColorField label="Accent" value={draft.visualRecipe.accentColor} onChange={(value) => updateVisual(setDraft, draft, { accentColor: value })} />
            <Toggle label="Horns" checked={draft.visualRecipe.horns} onChange={(value) => updateVisual(setDraft, draft, { horns: value })} />
          </div>
        </CreatorSection>

        <CreatorSection title="Motion recipe">
          <RangeField label="Speed stretch" value={draft.motionRecipe.speedStretch} min={0} max={0.5} step={0.01} onChange={(value) => updateMotion(setDraft, draft, 'speedStretch', value)} />
          <RangeField label="Impact squash" value={draft.motionRecipe.impactSquash} min={0} max={0.5} step={0.01} onChange={(value) => updateMotion(setDraft, draft, 'impactSquash', value)} />
          <RangeField label="Lean" value={draft.motionRecipe.lean} min={0} max={0.5} step={0.01} onChange={(value) => updateMotion(setDraft, draft, 'lean', value)} />
          <RangeField label="Idle pulse" value={draft.motionRecipe.pulseAmount} min={0} max={0.15} step={0.005} onChange={(value) => updateMotion(setDraft, draft, 'pulseAmount', value)} />
          <RangeField label="Pulse speed" value={draft.motionRecipe.pulseSpeed} min={0} max={8} step={0.1} onChange={(value) => updateMotion(setDraft, draft, 'pulseSpeed', value)} />
          <RangeField label="Weapon spin" value={draft.motionRecipe.weaponSpin} min={0} max={12} step={0.1} onChange={(value) => updateMotion(setDraft, draft, 'weaponSpin', value)} />
        </CreatorSection>
      </div>

      <aside className="creator-output-column">
        <div className="panel-section creator-actions">
          <p className="eyebrow">Content pipeline</p>
          <h2>Validate, save, test</h2>
          <p className="creator-message">{creatorMessage}</p>
          <button onClick={onSave} disabled={!validation.success}>Save to engine</button>
          <button className="accent-button" onClick={onTest} disabled={!validation.success}>Save & test fight</button>
          <button className="secondary" onClick={onExport} disabled={!validation.success}>Export fighter JSON</button>
          <button className="danger-button" onClick={onDelete} disabled={!isCustomFighter(draft.fighter.id)}>Delete custom fighter</button>
        </div>

        <div className="panel-section">
          <h2>Validation</h2>
          {validation.success
            ? <div className="validation-ok">✓ Schema, kit ownership and content references are valid.</div>
            : validation.errors.map((error) => <div className="validation-error" key={error}>• {error}</div>)}
        </div>

        <div className="panel-section">
          <h2>Import bundle</h2>
          <textarea className="import-textarea" value={importText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setImportText(event.target.value)} placeholder="Paste a .fighter.json bundle here" />
          <button className="secondary" onClick={onImport}>Load into editor</button>
          <label className="file-import-button">Choose JSON file<input type="file" accept="application/json,.json" onChange={(event: ChangeEvent<HTMLInputElement>) => void readImportFile(event, setImportText, setCreatorMessage)} /></label>
        </div>

        <div className="panel-section custom-library">
          <h2>Custom library</h2>
          {customBundles.length === 0 ? <p className="small-note">No saved custom fighters yet.</p> : customBundles.map((bundle) => (
            <button className="custom-library-item" key={bundle.fighter.id} onClick={() => {
              setDraft(bundle);
              if (bundle.fighter.kitSourceFighterId) setSourceFighterId(bundle.fighter.kitSourceFighterId);
              setCreatorMessage(`${bundle.fighter.name} loaded from the local library.`);
            }}>
              <span style={{ background: hexColor(bundle.visualRecipe.bodyColor) }} />
              <strong>{bundle.fighter.name}</strong>
              <small>{bundle.fighter.id}</small>
            </button>
          ))}
        </div>

        <details className="panel-section json-preview">
          <summary>Generated JSON</summary>
          <pre>{serializeFighterBundle(draft)}</pre>
        </details>
      </aside>
    </section>
  );
}

function PrimaryAttackEditor({ draft, setDraft, primaryAttacks, kitSource }: {
  draft: FighterBundle;
  setDraft: Dispatch<SetStateAction<FighterBundle>>;
  primaryAttacks: readonly PrimaryAttackDefinition[];
  kitSource: FighterDefinition | undefined;
}) {
  const attack = getPrimaryAttack(draft.fighter.primaryAttackId);
  const approvedAttack = kitSource ? getPrimaryAttack(kitSource.primaryAttackId) : null;
  const forms = [...new Set(primaryAttacks.map((item) => item.form))];
  const behaviors = ATTACK_FORM_BEHAVIORS[attack.form];
  const selectAttack = (nextAttack: PrimaryAttackDefinition) => {
    setDraft((current) => ({ ...current, fighter: { ...current.fighter, primaryAttackId: nextAttack.id } }));
  };

  return (
    <>
      {kitSource ? (
        <div className="creator-approved-weapon">
          <span>Approved weapon source</span>
          <strong>{approvedAttack?.name ?? kitSource.primaryAttackId}</strong>
          <small>{approvedAttack?.form} · {approvedAttack?.behavior} · inherited from {kitSource.name}</small>
          {attack.id !== approvedAttack?.id && <button className="secondary" onClick={() => approvedAttack && selectAttack(approvedAttack)}>Restore approved weapon</button>}
        </div>
      ) : (
        <>
          <CreatorField label="Attack source / form">
            <select value={attack.form} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const form = event.target.value as AttackForm;
              const next = primaryAttacks.find((item) => item.form === form) ?? attack;
              selectAttack(next);
            }}>
              {forms.map((form) => <option key={form} value={form}>{form}</option>)}
            </select>
          </CreatorField>
          <CreatorField label="Attack behavior">
            <select value={attack.behavior} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const behavior = event.target.value as PrimaryAttackDefinition['behavior'];
              const next = primaryAttacks.find((item) => item.form === attack.form && item.behavior === behavior);
              if (next) selectAttack(next);
            }}>
              {behaviors.map((behavior) => {
                const available = primaryAttacks.some((item) => item.form === attack.form && item.behavior === behavior);
                return <option key={behavior} value={behavior} disabled={!available}>{behavior}{available ? '' : ' · add definition first'}</option>;
              })}
            </select>
          </CreatorField>
          <CreatorField label="Primary attack">
            <select value={attack.id} onChange={(event: ChangeEvent<HTMLSelectElement>) => selectAttack(getPrimaryAttack(event.target.value))}>
              {primaryAttacks.filter((item) => item.form === attack.form && item.behavior === attack.behavior).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </CreatorField>
        </>
      )}
      <div className="weapon-spec-grid">
        <Metric label="Form" value={attack.form} />
        <Metric label="Behavior" value={attack.behavior} />
        <Metric label="Range" value={`${attack.minRange}–${attack.range}`} />
        <Metric label="Damage" value={attack.damage.toFixed(1)} />
        <Metric label="Visual scale" value={`${attack.visualScale.toFixed(2)}×`} />
        <Metric label="Cadence" value={attack.burstCount && attack.burstCount > 1 ? `${attack.burstCount}-round burst` : `${attack.cooldownTicks} ticks`} />
      </div>
      <p className="small-note">The primary attack is the fighter’s Basic and the authoritative weapon rendered on its body. A sourced recipe cannot equip another fighter’s weapon.</p>
    </>
  );
}

function ModuleLoadoutEditor({ draft, setDraft, kitSource }: {
  draft: FighterBundle;
  setDraft: Dispatch<SetStateAction<FighterBundle>>;
  kitSource: FighterDefinition | undefined;
}) {
  if (!kitSource) return <p className="small-note">Duplicate a built-in fighter to unlock authored module compatibility.</p>;
  const selectedIds = draft.fighter.defaultModuleIds ?? [];

  return (
    <div className="creator-module-editor">
      <p className="small-note">One approved module may be selected per slot. Preview cards stay body-only; these defaults apply when the fighter is saved or launched in a test fight.</p>
      {MODULE_SLOTS.map((slot) => {
        const modules = listCompatibleModules(kitSource, slot);
        if (modules.length === 0) return null;
        const selected = selectedIds.find((moduleId) => modules.some((module) => module.id === moduleId)) ?? '';
        const selectedModule = modules.find((module) => module.id === selected);
        return (
          <CreatorField label={`${titleCase(slot)} module`} key={slot}>
            <select value={selected} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDefaultModule(setDraft, slot, event.target.value, modules)}>
              <option value="">Standard configuration</option>
              {modules.map((module) => <option value={module.id} key={module.id}>{module.name}</option>)}
            </select>
            <small className="creator-module-description">{selectedModule?.description ?? `No ${slot} modifier equipped.`}</small>
          </CreatorField>
        );
      })}
    </div>
  );
}

function FighterRecipePreview({ fighter, visual, motion }: {
  fighter: FighterDefinition;
  visual: VisualRecipe;
  motion: MotionRecipe;
}) {
  const style = {
    '--preview-pulse': `${Math.max(0.45, 2.4 / Math.max(0.2, motion.pulseSpeed))}s`
  } as CSSProperties;

  return (
    <div className="recipe-preview-stage" style={style}>
      <FighterPortrait fighter={fighter} visual={visual} size="large" className="creator-live-portrait" />
    </div>
  );
}


function safePassive(id: string) {
  try {
    return getPassive(id);
  } catch {
    return null;
  }
}

function RecipeStat({ label, value, hint, wide = false }: { label: string; value: string; hint: string; wide?: boolean }) {
  return <article className={wide ? 'creator-stat wide' : 'creator-stat'}><small>{label}</small><strong>{value}</strong><span>{hint}</span></article>;
}

function setDefaultModule(
  setter: Dispatch<SetStateAction<FighterBundle>>,
  slot: ModuleSlot,
  moduleId: string,
  modules: readonly FighterModuleDefinition[]
) {
  setter((current) => {
    const currentIds = current.fighter.defaultModuleIds ?? [];
    const nextIds = currentIds.filter((id) => {
      try {
        return getFighterModule(id).slot !== slot;
      } catch {
        return false;
      }
    });
    if (moduleId && modules.some((module) => module.id === moduleId)) nextIds.push(moduleId);
    return { ...current, fighter: { ...current.fighter, defaultModuleIds: nextIds } };
  });
}

function updateFighterPhysics<K extends keyof FighterDefinition['physics']>(
  setter: Dispatch<SetStateAction<FighterBundle>>,
  draft: FighterBundle,
  key: K,
  value: FighterDefinition['physics'][K]
) {
  setter({ ...draft, fighter: { ...draft.fighter, physics: { ...draft.fighter.physics, [key]: value } } });
}

function updateFighterStats<K extends keyof FighterDefinition['stats']>(
  setter: Dispatch<SetStateAction<FighterBundle>>,
  draft: FighterBundle,
  key: K,
  value: FighterDefinition['stats'][K]
) {
  setter({ ...draft, fighter: { ...draft.fighter, stats: { ...draft.fighter.stats, [key]: value } } });
}

function updateVisual(
  setter: Dispatch<SetStateAction<FighterBundle>>,
  draft: FighterBundle,
  patch: Partial<VisualRecipe>
) {
  setter({ ...draft, visualRecipe: { ...draft.visualRecipe, ...patch } });
}

function updateMotion<K extends keyof Omit<MotionRecipe, 'id'>>(
  setter: Dispatch<SetStateAction<FighterBundle>>,
  draft: FighterBundle,
  key: K,
  value: MotionRecipe[K]
) {
  setter({ ...draft, motionRecipe: { ...draft.motionRecipe, [key]: value } });
}

async function readImportFile(
  event: ChangeEvent<HTMLInputElement>,
  setText: (value: string) => void,
  setMessage: (value: string) => void
): Promise<void> {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    setText(await file.text());
    setMessage(`${file.name} loaded. Click “Load into editor” to validate it.`);
  } catch {
    setMessage('Could not read that file.');
  }
  event.target.value = '';
}

function splitTags(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
