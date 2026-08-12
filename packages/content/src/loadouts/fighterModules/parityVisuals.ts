import type {
  MountedAttachmentDefinition,
  MountedAttachmentKind,
  MountedAttachmentPoint,
  MountedAttachmentRotation
} from '../../schemas';

interface ParityAttachmentOptions {
  id: string;
  kind: MountedAttachmentKind;
  mountPoint: MountedAttachmentPoint;
  primaryColor: number;
  accentColor: number;
  glowColor?: number;
  rotationMode?: MountedAttachmentRotation;
  forward?: number;
  lateral?: number;
  scale?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
}

/** Shared presentation defaults for Stage 9B roster-parity modules. */
export function parityAttachment(options: ParityAttachmentOptions): MountedAttachmentDefinition {
  return {
    id: options.id,
    kind: options.kind,
    mountPoint: options.mountPoint,
    rotationMode: options.rotationMode ?? (options.mountPoint === 'orbit' ? 'orbit' : 'body'),
    ...(options.forward !== undefined ? { forward: options.forward } : {}),
    ...(options.lateral !== undefined ? { lateral: options.lateral } : {}),
    scale: options.scale ?? 1.24,
    primaryColor: options.primaryColor,
    accentColor: options.accentColor,
    ...(options.glowColor !== undefined ? { glowColor: options.glowColor } : {}),
    outlineColor: 0xffffff,
    outlineWidthScale: 0.07,
    ...(options.orbitRadius !== undefined ? { orbitRadius: options.orbitRadius } : {}),
    ...(options.orbitSpeed !== undefined ? { orbitSpeed: options.orbitSpeed } : {}),
    hideInMassBattle: true
  };
}
