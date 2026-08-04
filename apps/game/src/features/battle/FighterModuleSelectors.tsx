import type { ChangeEvent } from 'react';
import {
  getFighterModule,
  listCompatibleModules,
  type FighterDefinition
} from '@kinetic/content';
import type { ModuleSlot } from '@kinetic/protocol';

export function FighterModuleSelectors({ fighter, selectedModuleIds, side, onChange }: {
  fighter: FighterDefinition;
  selectedModuleIds: readonly string[];
  side: 'A' | 'B';
  onChange(side: 'A' | 'B', slot: ModuleSlot, moduleId: string): void;
}) {
  const slots: readonly ModuleSlot[] = ['offense', 'defense', 'mobility', 'utility'];
  const availableSlots = slots
    .map((slot) => ({ slot, modules: listCompatibleModules(fighter, slot) }))
    .filter((entry) => entry.modules.length > 0);

  if (availableSlots.length === 0) return null;

  return (
    <div className="fighter-module-selectors" aria-label={`${fighter.name} modules`}>
      {availableSlots.map(({ slot, modules }) => {
        const selected = selectedModuleIds.find((id) => safeModuleSlot(id) === slot) ?? '';
        const selectedModule = selected ? modules.find((module) => module.id === selected) : undefined;
        const selectId = `fighter-${side.toLowerCase()}-${slot}-module`;
        return (
          <details className={`fighter-module-field ${selectedModule ? 'configured' : 'standard'}`} key={slot}>
            <summary>
              <span><small>{slot} module</small><strong>{selectedModule?.name ?? 'Standard configuration'}</strong></span>
              <i aria-hidden="true" />
            </summary>
            <div className="fighter-module-field-content">
              <label className="field-label" htmlFor={selectId}>Choose {slot} module</label>
              <select
                id={selectId}
                value={selected}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(side, slot, event.target.value)}
              >
                <option value="">Standard configuration</option>
                {modules.map((module) => (
                  <option value={module.id} key={module.id}>
                    {module.name}{module.attachments?.length ? ' · mounted' : ''}
                  </option>
                ))}
              </select>
              <small className="fighter-module-description">
                <span>{selectedModule?.description ?? `Use ${fighter.name}'s standard developer-authored configuration.`}</span>
                {(selectedModule?.attachments?.length ?? 0) > 0 && <strong className="mounted-module-badge">Mounted attachment</strong>}
              </small>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function safeModuleSlot(moduleId: string): ModuleSlot | null {
  try {
    return getFighterModule(moduleId).slot;
  } catch {
    return null;
  }
}
