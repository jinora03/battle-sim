import { Container, Text } from 'pixi.js';
import type { EntityId, EntitySnapshot, SimulationEvent, WorldSnapshot } from '@kinetic/protocol';
import { formatDamageNumber, resolveDamageNumberPresentation } from '../combatText';

interface FloatingCombatTextState {
  node: Text;
  life: number;
  maxLife: number;
  rise: number;
}

export class DamageNumberLayer {
  private readonly entityById = new Map<EntityId, EntitySnapshot>();
  private readonly items: FloatingCombatTextState[] = [];

  constructor(private readonly container: Container, private readonly maxItems = 40) {}

  consume(events: readonly SimulationEvent[], snapshot: WorldSnapshot, enabled: boolean): void {
    if (!enabled) return;

    this.entityById.clear();
    for (const entity of snapshot.entities) this.entityById.set(entity.id, entity);

    for (const event of events) {
      if (event.type !== 'damage' || event.amount <= 0) continue;
      const target = this.entityById.get(event.targetId);
      const position = event.position ?? (target ? { x: target.x, y: target.y } : null);
      if (!position) continue;

      const presentation = resolveDamageNumberPresentation(event.amount, event.prevented === true);
      const node = new Text({
        text: formatDamageNumber(event.amount, event.prevented === true),
        style: {
          fill: presentation.color,
          fontSize: presentation.fontSize,
          fontWeight: '900',
          fontFamily: 'Inter, system-ui',
          stroke: { color: 0x07101b, width: Math.max(4, Math.round(presentation.fontSize * 0.26)) }
        }
      });
      node.anchor.set(0.5);
      node.scale.set(presentation.initialScale);
      node.position.set(position.x, position.y - (target?.radius ?? 24) - 18);
      this.container.addChild(node);
      this.items.push({
        node,
        life: presentation.lifeSeconds,
        maxLife: presentation.lifeSeconds,
        rise: presentation.risePerSecond
      });

      if (this.items.length > this.maxItems) {
        const oldest = this.items.shift();
        oldest?.node.destroy();
      }
    }
  }

  update(dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      const item = this.items[index];
      if (!item) continue;
      item.life -= dt;
      item.node.y -= item.rise * dt;
      item.node.alpha = Math.max(0, item.life / item.maxLife);
      item.node.scale.set(1 + (1 - item.life / item.maxLife) * 0.08);
      if (item.life <= 0) {
        item.node.destroy();
        this.items.splice(index, 1);
      }
    }
  }

  clear(): void {
    for (const item of this.items) item.node.destroy();
    this.items.length = 0;
    this.entityById.clear();
  }
}
