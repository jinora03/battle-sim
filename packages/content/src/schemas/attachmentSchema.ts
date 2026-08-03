export type MountedAttachmentKind = 'targeting-drone' | 'missile-pod' | 'deflector-plate' | 'thruster' | 'ember-satellite';
export type MountedAttachmentPoint = 'front' | 'rear' | 'left' | 'right' | 'top' | 'orbit';
export type MountedAttachmentRotation = 'body' | 'target' | 'counter-rotate' | 'orbit';

/**
 * Declarative visual placement for a physical component supplied by a module.
 * Gameplay remains in the module modifiers; the renderer only consumes this
 * immutable presentation recipe.
 */
export interface MountedAttachmentDefinition {
  id: string;
  kind: MountedAttachmentKind;
  mountPoint: MountedAttachmentPoint;
  rotationMode: MountedAttachmentRotation;
  /** Forward offset measured in fighter-radius units. */
  forward?: number;
  /** Lateral offset measured in fighter-radius units. Negative is screen-left. */
  lateral?: number;
  scale?: number;
  primaryColor: number;
  accentColor: number;
  glowColor?: number;
  /** Outer silhouette color. Defaults to soft white for arena readability. */
  outlineColor?: number;
  /** Outline width measured in fighter-radius units. */
  outlineWidthScale?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  hideInMassBattle?: boolean;
}
