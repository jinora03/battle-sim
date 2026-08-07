import type { BroadcastLayoutId } from './broadcastLayout';

const LANDSCAPE_THUMBNAIL = { width: 1280, height: 720 } as const;
const VERTICAL_THUMBNAIL = { width: 1080, height: 1920 } as const;

export function captureCreatorThumbnail(
  source: HTMLCanvasElement,
  layout: BroadcastLayoutId
): HTMLCanvasElement {
  const size = layout === 'vertical' ? VERTICAL_THUMBNAIL : LANDSCAPE_THUMBNAIL;
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.dataset.creatorThumbnail = layout;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('The browser could not create the creator thumbnail canvas.');
  context.drawImage(source, 0, 0, source.width, source.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function encodeCreatorThumbnail(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the selected thumbnail frame.'));
    }, 'image/png');
  });
}
