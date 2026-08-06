import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  getAbility,
  getAbilityActivationProfile,
  getFighter,
  getFighterModule,
  getPrimaryAttack,
  getPrimaryAttackActivationProfile,
  listCompatibleModules,
  type FighterDefinition
} from '@kinetic/content';
import type { AbilitySlot, ModuleSlot } from '@kinetic/protocol';
import type { AppSettings, MovementMode } from '@kinetic/platform';
import { DrawerHeader, DrawerScrim, NeonButton } from './ui/NeonUI';
import { DisclosureGroup } from './ui/FormControls';
import { TrainingControlDeck } from './features/training/TrainingControlDeck';
import {
  DEFAULT_TRAINING_OPTIONS,
  DEFAULT_TRAINING_SETUP,
  TrainingRuntime,
  type TrainingDiagnostics,
  type TrainingOptions,
  type TrainingSetup,
  type TrainingSpeed,
  type TrainingTargetPattern
} from './runtime/TrainingRuntime';

const SLOTS: AbilitySlot[] = ['basic', 'skill1', 'skill2', 'skill3', 'ultimate'];
const KEY_TO_SLOT: Record<string, AbilitySlot> = {
  ' ': 'basic', '1': 'basic', q: 'skill1', '2': 'skill1', e: 'skill2', '3': 'skill2', r: 'skill3', '4': 'skill3', f: 'ultimate', '5': 'ultimate'
};

interface TrainingLabViewProps {
  fighters: FighterDefinition[];
  settings: AppSettings;
  active: boolean;
  onSettingChange<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
}

export function TrainingLabView({ fighters, settings, active, onSettingChange }: TrainingLabViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<TrainingRuntime | null>(null);
  const pressedRef = useRef(new Set<string>());
  const [setup, setSetup] = useState<TrainingSetup>(DEFAULT_TRAINING_SETUP);
  const [options, setOptions] = useState<TrainingOptions>(DEFAULT_TRAINING_OPTIONS);
  const [diagnostics, setDiagnostics] = useState<TrainingDiagnostics | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const trainer = useMemo(() => getFighter(setup.trainerFighterId), [setup.trainerFighterId]);
  const selectedPrimaryAttack = setup.selectedSlot === 'basic' ? getPrimaryAttack(trainer.primaryAttackId) : null;
  const selectedAbilityId = setup.selectedSlot === 'basic' ? null : trainer.abilitySlots[setup.selectedSlot] ?? null;
  const selectedAbility = selectedAbilityId ? getAbility(selectedAbilityId) : null;
  const selectedActivation = selectedPrimaryAttack
    ? getPrimaryAttackActivationProfile(selectedPrimaryAttack)
    : selectedAbility
      ? getAbilityActivationProfile(selectedAbility)
      : null;
  const selectedActionName = selectedPrimaryAttack?.name ?? selectedAbility?.name ?? 'Empty slot';
  const player = diagnostics?.snapshot.entities.find((entity) => entity.id === diagnostics.playerEntityId) ?? null;
  const targets = diagnostics?.snapshot.entities.filter((entity) => diagnostics.targetEntityIds.includes(entity.id)) ?? [];
  const slotControls = SLOTS.map((slot) => {
    const primary = slot === 'basic' ? getPrimaryAttack(trainer.primaryAttackId) : null;
    const abilityId = slot === 'basic' ? null : trainer.abilitySlots[slot];
    const ability = abilityId ? getAbility(abilityId) : null;
    const state = player?.abilities.find((item) => item.slot === slot);
    return {
      slot,
      label: slotLabel(slot),
      name: primary?.name ?? ability?.name ?? 'Empty',
      status: state ? `${state.phase}${state.cooldownRemainingTicks ? ` · ${state.cooldownRemainingTicks}t` : ''}` : 'unavailable',
      available: Boolean(primary || ability),
      selected: setup.selectedSlot === slot
    };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const runtime = new TrainingRuntime(host, settings, setDiagnostics, setup, options, active);
    runtimeRef.current = runtime;
    let cancelled = false;
    void runtime.start()
      .then(() => { if (!cancelled) setReady(true); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Ability Lab failed to start.'); });
    return () => {
      cancelled = true;
      runtime.destroy();
      runtimeRef.current = null;
    };
    // The runtime owns setup changes after boot; it should only be constructed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachTrainingHost = useCallback((node: HTMLDivElement | null) => {
    hostRef.current = node;
    if (node) runtimeRef.current?.attachHost(node);
  }, []);

  useEffect(() => { runtimeRef.current?.setSettings(settings); }, [settings]);
  useEffect(() => { runtimeRef.current?.setOptions(options); }, [options]);
  useEffect(() => { runtimeRef.current?.setSelectedSlot(setup.selectedSlot); }, [setup.selectedSlot]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (!active) {
      runtime.setActive(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const host = hostRef.current;
      if (host) runtime.attachHost(host);
      runtime.setActive(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => {
    const syncVisibility = () => runtimeRef.current?.setSystemSuspended(document.visibilityState !== 'visible');
    const suspend = () => runtimeRef.current?.setSystemSuspended(true);
    const resume = () => syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', resume);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('pageshow', resume);
    };
  }, []);

  useEffect(() => {
    if (!active) setSidebarOpen(false);
  }, [active]);

  useEffect(() => {
    let settleTimer = 0;
    const refresh = () => {
      runtimeRef.current?.refreshRendererLayout();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => runtimeRef.current?.refreshRendererLayout(), 220);
    };
    window.addEventListener('resize', refresh, { passive: true });
    window.addEventListener('orientationchange', refresh, { passive: true });
    window.visualViewport?.addEventListener('resize', refresh, { passive: true });
    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      window.visualViewport?.removeEventListener('resize', refresh);
    };
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const movement = () => {
      if (settings.movementMode !== 'wasd') {
        runtimeRef.current?.setPlayerMovement({ x: 0, y: 0 });
        return;
      }
      const keys = pressedRef.current;
      const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      runtimeRef.current?.setPlayerMovement({ x, y });
    };
    const onDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!active || target?.matches('input, select, textarea, button')) return;
      const key = event.key.toLowerCase();
      if (KEY_TO_SLOT[key]) {
        event.preventDefault();
        runtimeRef.current?.activateAbility(KEY_TO_SLOT[key]);
        return;
      }
      if (settings.movementMode === 'wasd') {
        pressedRef.current.add(key);
        movement();
      }
    };
    const onUp = (event: KeyboardEvent) => {
      pressedRef.current.delete(event.key.toLowerCase());
      movement();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      pressedRef.current.clear();
      runtimeRef.current?.setPlayerMovement({ x: 0, y: 0 });
    };
  }, [active, settings.movementMode]);

  const restartWith = (next: TrainingSetup) => {
    setSetup(next);
    runtimeRef.current?.restart(next);
  };

  const changeSetup = <K extends keyof TrainingSetup>(key: K, value: TrainingSetup[K], restart = true) => {
    const next = { ...setup, [key]: value };
    if (restart) restartWith(next);
    else setSetup(next);
  };

  const changeTrainerModule = (slot: ModuleSlot, moduleId: string) => {
    const nextModuleIds = setup.trainerModuleIds.filter((id) => safeTrainingModuleSlot(id) !== slot);
    if (moduleId) nextModuleIds.push(moduleId);
    changeSetup('trainerModuleIds', nextModuleIds);
  };

  const aim = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    if (settings.movementMode === 'mouse') {
      runtimeRef.current?.setPlayerMouseDriveFromClient(event.clientX, event.clientY);
      return;
    }
    runtimeRef.current?.setPlayerAimFromClient(event.clientX, event.clientY);
  };

  const stopPointerMovement = () => {
    if (settings.movementMode === 'mouse') runtimeRef.current?.setPlayerMovement({ x: 0, y: 0 });
  };

  const unlockAudio = () => { void runtimeRef.current?.enableAudio().catch(() => undefined); };
  const paused = diagnostics?.paused ?? false;

  return (
    <section className={`training-lab ${active ? '' : 'training-workspace-dormant'} ${sidebarOpen ? 'training-drawer-open' : ''}`} onPointerDown={unlockAudio} aria-hidden={!active}>
      <aside className={`training-sidebar ui-mobile-drawer ${sidebarOpen ? 'open' : ''}`} id="training-settings-drawer" aria-label="Ability Lab setup and rules">
        <DrawerHeader eyebrow="Ability Lab" title="Trainer settings" onClose={() => setSidebarOpen(false)} />
        <div className="panel-section training-intro-card">
          <p className="eyebrow">v1.1 Stage 7.4 hotfix</p>
          <h2>Ability Lab</h2>
          <p>The Ability Lab now shares the same responsive canvas lifecycle, internal render scaling, safe mobile sizing and visibility suspension as Battle Lab.</p>
        </div>

        <DisclosureGroup eyebrow="Loadout" title="Trainer and targets" defaultOpen className="panel-section training-setup-card training-settings-group">
          <label className="field-label stacked-label">Trainer fighter
            <select
              value={setup.trainerFighterId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => restartWith({ ...setup, trainerFighterId: event.target.value, trainerModuleIds: [] })}
            >
              {fighters.map((fighter) => <option value={fighter.id} key={fighter.id}>{fighter.name}</option>)}
            </select>
          </label>
          <TrainingModuleSelectors fighter={trainer} selectedModuleIds={setup.trainerModuleIds} onChange={changeTrainerModule} />
          <label className="field-label stacked-label">Target fighter
            <select value={setup.targetFighterId} onChange={(event: ChangeEvent<HTMLSelectElement>) => changeSetup('targetFighterId', event.target.value)}>
              {fighters.map((fighter) => <option value={fighter.id} key={fighter.id}>{fighter.name}</option>)}
            </select>
          </label>
          <label className="field-label stacked-label">Target pattern
            <select value={setup.targetPattern} onChange={(event: ChangeEvent<HTMLSelectElement>) => changeSetup('targetPattern', event.target.value as TrainingTargetPattern)}>
              <option value="stationary">Stationary dummy</option>
              <option value="moving">Moving dummy</option>
              <option value="group-3">Grouped targets · 3</option>
              <option value="group-5">Grouped targets · 5</option>
            </select>
          </label>
          <label className="field-label stacked-label">Movement mode
            <select value={settings.movementMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSettingChange('movementMode', event.target.value as MovementMode)}>
              <option value="mouse">Mouse move + aim</option>
              <option value="wasd">WASD / arrows move</option>
            </select>
          </label>
          <div className="training-reset-row">
            <NeonButton tone="danger" onClick={() => runtimeRef.current?.restart(setup)}>Reset arena</NeonButton>
            <NeonButton tone="random" onClick={() => restartWith({ ...setup, seed: (Math.random() * 0xffffffff) >>> 0 })}>New seed</NeonButton>
          </div>
        </DisclosureGroup>

        <DisclosureGroup eyebrow="Simulation controls" title="Rules and overlays" defaultOpen className="panel-section training-options-card training-settings-group">
          <TrainingToggle label="Apply HP damage" checked={options.damageEnabled} onChange={(checked) => setOptions((current) => ({ ...current, damageEnabled: checked }))} />
          <TrainingToggle label="Use cooldowns" checked={options.cooldownsEnabled} onChange={(checked) => setOptions((current) => ({ ...current, cooldownsEnabled: checked }))} />
          <TrainingToggle label="Invulnerable targets" checked={options.invulnerableTargets} onChange={(checked) => setOptions((current) => ({ ...current, invulnerableTargets: checked }))} />
          <hr />
          <TrainingToggle label="Show selected range" checked={options.showRange} onChange={(checked) => setOptions((current) => ({ ...current, showRange: checked }))} />
          <TrainingToggle label="Show hitboxes" checked={options.showHitboxes} onChange={(checked) => setOptions((current) => ({ ...current, showHitboxes: checked }))} />
          <TrainingToggle label="Show projectile paths" checked={options.showProjectilePaths} onChange={(checked) => setOptions((current) => ({ ...current, showProjectilePaths: checked }))} />
          <TrainingToggle label="Show damage numbers" checked={options.showDamageNumbers} onChange={(checked) => setOptions((current) => ({ ...current, showDamageNumbers: checked }))} />
        </DisclosureGroup>
      </aside>
      <DrawerScrim open={sidebarOpen} onClose={() => setSidebarOpen(false)} label="Close Ability Lab settings" className="training-drawer-scrim" />

      <div className="training-main-column">
        <div className="training-topbar panel-section">
          <div><p className="eyebrow">Training grid</p><strong>{trainer.name} · {selectedActionName}</strong></div>
          <div className="training-playback-controls">
            <NeonButton tone="ghost" size="small" className="training-settings-trigger" onClick={() => setSidebarOpen(true)} aria-controls="training-settings-drawer" aria-expanded={sidebarOpen}>Lab setup</NeonButton>
            <NeonButton tone={paused ? 'success' : 'pause'} size="small" className={paused ? 'paused' : ''} onClick={() => runtimeRef.current?.setPaused(!paused)}>{paused ? '▶ Play' : 'Ⅱ Pause'}</NeonButton>
            <NeonButton tone="utility" size="small" disabled={!paused} onClick={() => runtimeRef.current?.stepOneTick()}>Step 1 tick</NeonButton>
            <label>Speed
              <select value={diagnostics?.speed ?? 1} onChange={(event: ChangeEvent<HTMLSelectElement>) => runtimeRef.current?.setSpeed(Number(event.target.value) as TrainingSpeed)}>
                <option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1">1×</option>
              </select>
            </label>
          </div>
        </div>

        <div className="training-arena-wrap" onPointerMove={aim} onPointerDown={aim} onPointerLeave={stopPointerMovement}>
          <div className="training-arena-frame" ref={attachTrainingHost} />
          {!ready && !error && <div className="arena-loading" role="status"><span className="loading-spinner" /><strong>Preparing Ability Lab…</strong><small>Loading deterministic combat, projectiles and debug overlays.</small></div>}
          {error && <div className="arena-loading error" role="alert"><strong>The Ability Lab could not start</strong><small>{error}</small><button onClick={() => window.location.reload()}>Reload application</button></div>}
          {paused && ready && <div className="training-pause-badge">Paused · use Step 1 tick for frame inspection</div>}
        </div>

        <div className="training-action-deck panel-section">
          <div className="training-selected-action">
            <div>
              <p className="eyebrow">Selected test</p>
              <h3>{selectedActionName}</h3>
              <p>{selectedActivation ? `${selectedActivation.intent} · ${selectedActivation.targeting} · ${Math.round(selectedActivation.minRange)}–${Math.round(selectedActivation.maxRange)} range` : 'Choose a populated skill slot.'}</p>
              {selectedPrimaryAttack && <span className="weapon-spec-chip">{selectedPrimaryAttack.form} · {selectedPrimaryAttack.behavior} · {selectedPrimaryAttack.damage} damage</span>}
            </div>
            <NeonButton tone={setup.selectedSlot === 'ultimate' ? 'ultimate' : 'success'} size="large" className="training-fire-button" disabled={!selectedPrimaryAttack && !selectedAbility} onClick={() => runtimeRef.current?.activateAbility(setup.selectedSlot)}>Fire selected {setup.selectedSlot === 'basic' ? 'Basic' : 'skill'}</NeonButton>
          </div>
          <TrainingControlDeck
            slots={slotControls}
            onSelect={(slot) => changeSetup('selectedSlot', slot, false)}
            onMove={(direction) => runtimeRef.current?.setPlayerMovement(direction)}
          />
          <div className="training-control-hint">{settings.movementMode === 'mouse' ? 'Pointer steering moves + aims · 1–5 or Q/E/R/F activate skills' : 'WASD / arrows move · pointer aims · 1–5 or Q/E/R/F activate skills'}</div>
        </div>

        <div className="training-inspector-grid">
          <article className="panel-section training-inspector-card">
            <p className="eyebrow">Live target inspection</p><h3>Status effects and HP</h3>
            {targets.length === 0 ? <p className="small-note">Targets were defeated. Reset the arena to spawn them again.</p> : targets.map((target) => (
              <div className="training-target-row" key={target.id}>
                <div><strong>#{target.id} {getFighter(target.fighterId).name}</strong><span>{Math.ceil(target.hp)} / {Math.ceil(target.maxHp)} HP</span></div>
                <div className="training-status-list">
                  {target.statuses.length === 0 ? <em>No active status</em> : target.statuses.map((status) => <span key={status.statusId}>{status.statusId}{status.stacks > 1 ? ` ×${status.stacks}` : ''} · {status.remainingTicks}t</span>)}
                </div>
              </div>
            ))}
          </article>

          <article className="panel-section training-inspector-card">
            <p className="eyebrow">Damage recorder</p><h3>Recent validated hits</h3>
            {!diagnostics || diagnostics.recentDamage.length === 0 ? <p className="small-note">Fire an attack to record damage.</p> : diagnostics.recentDamage.slice(-8).reverse().map((record, index) => (
              <div className="training-damage-row" key={`${record.tick}-${record.targetId}-${index}`}>
                <b>{record.prevented ? 'TEST' : 'HIT'}</b><strong>{record.amount.toFixed(1)} {record.element}</strong><span>target #{record.targetId} · tick {record.tick} · HP {record.hpAfter.toFixed(1)}</span>
              </div>
            ))}
          </article>

          <article className="panel-section training-inspector-card training-metrics-card">
            <p className="eyebrow">Deterministic diagnostics</p><h3>Current frame</h3>
            <div className="training-metric-grid">
              <span><small>Tick</small><strong>{diagnostics?.tick.toLocaleString() ?? '0'}</strong></span>
              <span><small>Checksum</small><strong className="mono">{diagnostics?.checksum ?? '--------'}</strong></span>
              <span><small>Projectiles</small><strong>{diagnostics?.snapshot.projectiles.length ?? 0}</strong></span>
              <span><small>Quality</small><strong>{diagnostics?.renderDiagnostics ? `${Math.round(diagnostics.renderDiagnostics.qualityScale * 100)}%` : "0%"}</strong></span>
              <span><small>VFX tier</small><strong>{diagnostics?.renderDiagnostics.vfxQuality ?? 'high'}</strong></span>
              <span><small>Ground marks</small><strong>{diagnostics?.renderDiagnostics.groundMarks ?? 0}</strong></span>
              <span><small>Residual FX</small><strong>{diagnostics?.renderDiagnostics.residualParticles ?? 0}</strong></span>
              <span><small>Resolution</small><strong>{diagnostics?.renderDiagnostics ? `${diagnostics.renderDiagnostics.resolution.toFixed(2)}×` : '1×'}</strong></span>
              <span><small>Canvas CSS</small><strong>{diagnostics?.renderDiagnostics ? `${diagnostics.renderDiagnostics.cssWidth}×${diagnostics.renderDiagnostics.cssHeight}` : '—'}</strong></span>
              <span><small>Canvas pixels</small><strong>{diagnostics?.renderDiagnostics ? `${diagnostics.renderDiagnostics.pixelWidth}×${diagnostics.renderDiagnostics.pixelHeight}` : '—'}</strong></span>
              <span><small>Targets</small><strong>{targets.length}</strong></span>
              <span><small>Audio voices</small><strong>{diagnostics?.audioDiagnostics.activeVoices ?? 0}</strong></span>
            </div>
          </article>
        </div>

      </div>
    </section>
  );
}

function TrainingModuleSelectors({ fighter, selectedModuleIds, onChange }: {
  fighter: FighterDefinition;
  selectedModuleIds: readonly string[];
  onChange(slot: ModuleSlot, moduleId: string): void;
}) {
  const slots: readonly ModuleSlot[] = ['offense', 'defense', 'mobility', 'utility'];
  const available = slots
    .map((slot) => ({ slot, modules: listCompatibleModules(fighter, slot) }))
    .filter((entry) => entry.modules.length > 0);
  if (available.length === 0) return null;
  return (
    <div className="training-module-selectors" aria-label={`${fighter.name} training modules`}>
      {available.map(({ slot, modules }) => {
        const selected = selectedModuleIds.find((id) => safeTrainingModuleSlot(id) === slot) ?? '';
        return (
          <label className="field-label stacked-label" key={slot}>{slot} module
            <select value={selected} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(slot, event.target.value)}>
              <option value="">Standard configuration</option>
              {modules.map((module) => <option value={module.id} key={module.id}>{module.name}</option>)}
            </select>
          </label>
        );
      })}
    </div>
  );
}

function safeTrainingModuleSlot(moduleId: string): ModuleSlot | null {
  try {
    return getFighterModule(moduleId).slot;
  } catch {
    return null;
  }
}

function TrainingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="training-toggle"><input type="checkbox" checked={checked} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)} /><span>{label}</span><i /></label>;
}

function slotLabel(slot: AbilitySlot): string {
  if (slot === 'basic') return '1 · BASIC';
  if (slot === 'skill1') return '2 · Q';
  if (slot === 'skill2') return '3 · E';
  if (slot === 'skill3') return '4 · R';
  return '5 · F · ULT';
}
