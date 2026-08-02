import type { Vec2 } from '@kinetic/protocol';

export interface ExternalImpulseState extends Vec2 {
  retention: number;
  maxSpeed: number;
  minWallBounces: number;
  wallBounces: number;
  trailStrength: number;
}
