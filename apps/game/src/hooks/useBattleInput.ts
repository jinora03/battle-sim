import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react';
import type { AbilitySlot, Vec2 } from '@kinetic/protocol';
import type { MovementMode } from '@kinetic/platform';
import type { ReleaseView } from '../ReleaseHome';
import type { BattleRuntime } from '../runtime/BattleRuntime';
import type { BattleLaunchPhase } from '../ui/battleLaunch';

const skillKeyMap: Record<string, AbilitySlot> = {
  ' ': 'basic',
  '1': 'basic',
  q: 'skill1',
  '2': 'skill1',
  e: 'skill2',
  '3': 'skill2',
  r: 'skill3',
  '4': 'skill3',
  f: 'ultimate',
  '5': 'ultimate'
};

export interface UseBattleInputOptions {
  runtimeRef: RefObject<BattleRuntime | null>;
  view: ReleaseView;
  battleLaunchPhase: BattleLaunchPhase;
  movementMode: MovementMode;
  touchControlsVisible: boolean;
  hasPlayerEntity: boolean;
}

export interface BattleInputController {
  movePlayer(direction: Vec2): void;
  activate(slot: AbilitySlot): void;
  previewAbility(slot: AbilitySlot): void;
  stopPlayerMovement(): void;
  aimFromPointer(event: ReactPointerEvent<HTMLDivElement>): void;
  aimAndFireFromPointer(event: ReactPointerEvent<HTMLDivElement>): void;
  handleArenaPointerLeave(): void;
}

export function useBattleInput(options: UseBattleInputOptions): BattleInputController {
  const {
    runtimeRef,
    view,
    battleLaunchPhase,
    movementMode,
    touchControlsVisible,
    hasPlayerEntity
  } = options;
  const pressedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    const updateMovement = () => {
      if (movementMode !== 'wasd') {
        runtimeRef.current?.setPlayerMovement({ x: 0, y: 0 });
        return;
      }
      const keys = pressedKeysRef.current;
      const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0)
        - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
        - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      runtimeRef.current?.setPlayerMovement({ x, y });
    };
    const isTyping = (target: EventTarget | null) => target instanceof HTMLInputElement
      || target instanceof HTMLSelectElement
      || target instanceof HTMLTextAreaElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || view !== 'battle' || battleLaunchPhase !== 'running') return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (movementMode === 'wasd') {
          event.preventDefault();
          pressedKeysRef.current.add(key);
          updateMovement();
        }
      }
      const slot = skillKeyMap[key];
      if (slot && !event.repeat) {
        event.preventDefault();
        runtimeRef.current?.activatePlayerAbility(slot);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key.toLowerCase());
      updateMovement();
    };
    const stop = () => {
      pressedKeysRef.current.clear();
      runtimeRef.current?.setPlayerMovement({ x: 0, y: 0 });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', stop);
    };
  }, [battleLaunchPhase, movementMode, runtimeRef, view]);

  const movePlayer = useCallback((direction: Vec2) => {
    if (battleLaunchPhase !== 'running') return;
    runtimeRef.current?.setPlayerMovement(direction);
    if (touchControlsVisible && (Math.abs(direction.x) > 0.001 || Math.abs(direction.y) > 0.001)) {
      runtimeRef.current?.setPlayerAim(direction);
    }
  }, [battleLaunchPhase, runtimeRef, touchControlsVisible]);

  const activate = useCallback((slot: AbilitySlot) => {
    if (battleLaunchPhase === 'running') runtimeRef.current?.activatePlayerAbility(slot);
  }, [battleLaunchPhase, runtimeRef]);

  const previewAbility = useCallback((slot: AbilitySlot) => {
    runtimeRef.current?.previewPlayerAbility(slot);
  }, [runtimeRef]);

  const stopPlayerMovement = useCallback(() => {
    runtimeRef.current?.setPlayerMovement({ x: 0, y: 0 });
  }, [runtimeRef]);

  const aimFromPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (battleLaunchPhase !== 'running') return;
    const target = event.target as HTMLElement;
    if (target.closest('.touch-controls')) return;
    if (event.pointerType === 'touch') return;
    if (movementMode === 'mouse' && hasPlayerEntity && event.pointerType === 'mouse') {
      runtimeRef.current?.setPlayerMouseDriveFromClient(event.clientX, event.clientY);
      return;
    }
    runtimeRef.current?.setPlayerAimFromClient(event.clientX, event.clientY);
  }, [battleLaunchPhase, hasPlayerEntity, movementMode, runtimeRef]);

  const aimAndFireFromPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    aimFromPointer(event);
    if (event.pointerType === 'mouse' && event.button === 0 && hasPlayerEntity) activate('basic');
  }, [activate, aimFromPointer, hasPlayerEntity]);

  const handleArenaPointerLeave = useCallback(() => {
    if (movementMode === 'mouse') stopPlayerMovement();
  }, [movementMode, stopPlayerMovement]);

  return {
    movePlayer,
    activate,
    previewAbility,
    stopPlayerMovement,
    aimFromPointer,
    aimAndFireFromPointer,
    handleArenaPointerLeave
  };
}
