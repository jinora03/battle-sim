import type { EncodedMp4AudioSample, EncodedMp4VideoSample } from './mp4Codecs';

export interface Mp4MuxerOptions {
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  channels: number;
  audioBitrate: number;
  maxEncodedBytes: number;
  audioEnabled: boolean;
}

const TIMESCALE = 1_000_000;
const SAMPLE_OVERHEAD_BYTES = 20;
const textEncoder = new TextEncoder();

export class Mp4Muxer {
  private readonly videoSamples: EncodedMp4VideoSample[] = [];
  private readonly audioSamples: EncodedMp4AudioSample[] = [];
  private avcConfig: Uint8Array | null = null;
  private aacConfig: Uint8Array | null = null;
  private encodedBytes = 0;

  constructor(private readonly options: Mp4MuxerOptions) {}

  get byteLength(): number {
    return this.encodedBytes;
  }

  setVideoDecoderConfig(description: Uint8Array | null): void {
    if (description && description.byteLength > 0) this.avcConfig = description.slice();
  }

  setAudioDecoderConfig(description: Uint8Array | null): void {
    if (description && description.byteLength > 0) this.aacConfig = description.slice();
  }

  addVideoSample(sample: EncodedMp4VideoSample): void {
    this.collect(sample.data.byteLength);
    this.videoSamples.push({ ...sample, data: sample.data.slice() });
  }

  addAudioSample(sample: EncodedMp4AudioSample): void {
    if (!this.options.audioEnabled) throw new Error('Cannot add AAC samples to a video-only MP4 export.');
    this.collect(sample.data.byteLength);
    this.audioSamples.push({ ...sample, data: sample.data.slice() });
  }

  finalize(): Blob {
    if (this.videoSamples.length === 0) throw new Error('Cannot create an MP4 file without H.264 video samples.');
    if (!this.avcConfig) throw new Error('The H.264 encoder did not provide the AVC decoder configuration required for MP4.');
    if (this.options.audioEnabled && !this.aacConfig) throw new Error('The AAC encoder did not provide the audio configuration required for MP4.');

    this.videoSamples.sort((a, b) => a.timestampUs - b.timestampUs);
    this.audioSamples.sort((a, b) => a.timestampUs - b.timestampUs);

    const ftyp = createFtyp();
    const moov = createMoov(this.options, this.avcConfig, this.aacConfig);
    const placeholderMoof = createMoof(this.videoSamples, this.audioSamples, 0, 0, this.options.audioEnabled);
    const videoBytes = sumBytes(this.videoSamples);
    const videoOffset = placeholderMoof.byteLength + 8;
    const audioOffset = videoOffset + videoBytes;
    const moof = createMoof(this.videoSamples, this.audioSamples, videoOffset, audioOffset, this.options.audioEnabled);
    const payloadBytes = videoBytes + sumBytes(this.audioSamples);
    const mdatHeader = boxHeader('mdat', payloadBytes);
    const parts: BlobPart[] = [ftyp as unknown as BlobPart, moov as unknown as BlobPart, moof as unknown as BlobPart, mdatHeader as unknown as BlobPart];
    for (const sample of this.videoSamples) parts.push(sample.data as unknown as BlobPart);
    for (const sample of this.audioSamples) parts.push(sample.data as unknown as BlobPart);
    const blob = new Blob(parts, { type: 'video/mp4' });
    this.encodedBytes = blob.size;
    this.videoSamples.length = 0;
    this.audioSamples.length = 0;
    return blob;
  }

  private collect(bytes: number): void {
    const next = this.encodedBytes + bytes + SAMPLE_OVERHEAD_BYTES;
    if (next > this.options.maxEncodedBytes) throw new Error('Encoded media exceeded the configured memory safeguard.');
    this.encodedBytes = next;
  }
}

function createFtyp(): Uint8Array {
  return box('ftyp', concat(
    ascii('isom'), u32(0x200), ascii('isom'), ascii('iso6'), ascii('mp41'), ascii('avc1'), ascii('mp42')
  ));
}

function createMoov(options: Mp4MuxerOptions, avcConfig: Uint8Array, aacConfig: Uint8Array | null): Uint8Array {
  const children = [
    createMvhd(),
    createVideoTrak(options, avcConfig),
    ...(options.audioEnabled && aacConfig ? [createAudioTrak(options, aacConfig)] : []),
    box('mvex', concat(
      createTrex(1),
      ...(options.audioEnabled ? [createTrex(2)] : [])
    ))
  ];
  return box('moov', concat(...children));
}

function createMvhd(): Uint8Array {
  return fullBox('mvhd', 0, 0, concat(
    u32(0), u32(0), u32(1000), u32(0),
    u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0),
    identityMatrix(),
    zeros(24),
    u32(3)
  ));
}

function createVideoTrak(options: Mp4MuxerOptions, avcConfig: Uint8Array): Uint8Array {
  return box('trak', concat(
    createTkhd(1, options.width, options.height, false),
    box('mdia', concat(
      createMdhd(),
      createHdlr('vide', 'VideoHandler'),
      box('minf', concat(
        fullBox('vmhd', 0, 1, concat(u16(0), u16(0), u16(0), u16(0))),
        createDinf(),
        createVideoStbl(options, avcConfig)
      ))
    ))
  ));
}

function createAudioTrak(options: Mp4MuxerOptions, aacConfig: Uint8Array): Uint8Array {
  return box('trak', concat(
    createTkhd(2, 0, 0, true),
    box('mdia', concat(
      createMdhd(),
      createHdlr('soun', 'SoundHandler'),
      box('minf', concat(
        fullBox('smhd', 0, 0, concat(u16(0), u16(0))),
        createDinf(),
        createAudioStbl(options, aacConfig)
      ))
    ))
  ));
}

function createTkhd(trackId: number, width: number, height: number, audio: boolean): Uint8Array {
  return fullBox('tkhd', 0, 0x000007, concat(
    u32(0), u32(0), u32(trackId), u32(0), u32(0), u32(0), u32(0),
    u16(0), u16(0), u16(audio ? 0x0100 : 0), u16(0),
    identityMatrix(), fixed16_16(width), fixed16_16(height)
  ));
}

function createMdhd(): Uint8Array {
  return fullBox('mdhd', 0, 0, concat(u32(0), u32(0), u32(TIMESCALE), u32(0), u16(0x55c4), u16(0)));
}

function createHdlr(handler: 'vide' | 'soun', name: string): Uint8Array {
  return fullBox('hdlr', 0, 0, concat(u32(0), ascii(handler), zeros(12), ascii(`${name}\0`)));
}

function createDinf(): Uint8Array {
  const url = fullBox('url ', 0, 1, new Uint8Array());
  return box('dinf', fullBox('dref', 0, 0, concat(u32(1), url)));
}

function createVideoStbl(options: Mp4MuxerOptions, avcConfig: Uint8Array): Uint8Array {
  const sampleEntry = box('avc1', concat(
    zeros(6), u16(1), u16(0), u16(0), zeros(12),
    u16(options.width), u16(options.height), fixed16_16(72), fixed16_16(72), u32(0), u16(1),
    compressorName('Kinetic Battle Engine'), u16(0x0018), u16(0xffff),
    box('avcC', avcConfig)
  ));
  return box('stbl', concat(
    fullBox('stsd', 0, 0, concat(u32(1), sampleEntry)),
    emptyTable('stts'), emptyTable('stsc'),
    fullBox('stsz', 0, 0, concat(u32(0), u32(0))),
    emptyTable('stco')
  ));
}

function createAudioStbl(options: Mp4MuxerOptions, aacConfig: Uint8Array): Uint8Array {
  const sampleEntry = box('mp4a', concat(
    zeros(6), u16(1), zeros(8), u16(options.channels), u16(16), u16(0), u16(0), fixed16_16(options.sampleRate),
    createEsds(aacConfig, options.audioBitrate)
  ));
  return box('stbl', concat(
    fullBox('stsd', 0, 0, concat(u32(1), sampleEntry)),
    emptyTable('stts'), emptyTable('stsc'),
    fullBox('stsz', 0, 0, concat(u32(0), u32(0))),
    emptyTable('stco')
  ));
}

function createEsds(config: Uint8Array, bitrate: number): Uint8Array {
  const decoderSpecific = descriptor(0x05, config);
  const decoderConfig = descriptor(0x04, concat(
    Uint8Array.of(0x40, 0x15), u24(0), u32(bitrate), u32(bitrate), decoderSpecific
  ));
  const slConfig = descriptor(0x06, Uint8Array.of(0x02));
  const esDescriptor = descriptor(0x03, concat(u16(1), Uint8Array.of(0), decoderConfig, slConfig));
  return fullBox('esds', 0, 0, esDescriptor);
}

function createTrex(trackId: number): Uint8Array {
  return fullBox('trex', 0, 0, concat(u32(trackId), u32(1), u32(0), u32(0), u32(0)));
}

function createMoof(
  videoSamples: readonly EncodedMp4VideoSample[],
  audioSamples: readonly EncodedMp4AudioSample[],
  videoDataOffset: number,
  audioDataOffset: number,
  audioEnabled: boolean
): Uint8Array {
  return box('moof', concat(
    fullBox('mfhd', 0, 0, u32(1)),
    createTraf(1, videoSamples, videoDataOffset, true),
    ...(audioEnabled ? [createTraf(2, audioSamples, audioDataOffset, false)] : [])
  ));
}

function createTraf(
  trackId: number,
  samples: readonly (EncodedMp4VideoSample | EncodedMp4AudioSample)[],
  dataOffset: number,
  video: boolean
): Uint8Array {
  const rows: Uint8Array[] = [];
  for (const sample of samples) {
    const keyFrame = video && 'keyFrame' in sample ? sample.keyFrame : true;
    rows.push(
      u32(Math.max(1, Math.round(sample.durationUs))),
      u32(sample.data.byteLength),
      u32(keyFrame ? 0x02000000 : 0x01010000)
    );
  }
  const trunFlags = 0x000001 | 0x000100 | 0x000200 | 0x000400;
  return box('traf', concat(
    fullBox('tfhd', 0, 0x020000, u32(trackId)),
    fullBox('tfdt', 1, 0, u64(0)),
    fullBox('trun', 0, trunFlags, concat(u32(samples.length), i32(dataOffset), ...rows))
  ));
}

function emptyTable(type: string): Uint8Array {
  return fullBox(type, 0, 0, u32(0));
}

function descriptor(tag: number, payload: Uint8Array): Uint8Array {
  return concat(Uint8Array.of(tag), descriptorLength(payload.byteLength), payload);
}

function descriptorLength(value: number): Uint8Array {
  const bytes = [value & 0x7f];
  let remaining = value >>> 7;
  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  return Uint8Array.from(bytes);
}

function compressorName(name: string): Uint8Array {
  const bytes = new Uint8Array(32);
  const encoded = textEncoder.encode(name).slice(0, 31);
  bytes[0] = encoded.length;
  bytes.set(encoded, 1);
  return bytes;
}

function identityMatrix(): Uint8Array {
  return concat(
    u32(0x00010000), u32(0), u32(0),
    u32(0), u32(0x00010000), u32(0),
    u32(0), u32(0), u32(0x40000000)
  );
}

function fixed16_16(value: number): Uint8Array {
  return u32(Math.round(value * 65536));
}

function fullBox(type: string, version: number, flags: number, payload: Uint8Array): Uint8Array {
  return box(type, concat(Uint8Array.of(version), u24(flags), payload));
}

function box(type: string, payload: Uint8Array): Uint8Array {
  return concat(boxHeader(type, payload.byteLength), payload);
}

function boxHeader(type: string, payloadLength: number): Uint8Array {
  return concat(u32(payloadLength + 8), ascii(type));
}

function sumBytes(samples: readonly { data: Uint8Array }[]): number {
  return samples.reduce((total, sample) => total + sample.data.byteLength, 0);
}

function u16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value & 0xffff);
  return bytes;
}

function u24(value: number): Uint8Array {
  return Uint8Array.of((value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0);
  return bytes;
}

function i32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value | 0);
  return bytes;
}

function u64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  const high = Math.floor(value / 0x1_0000_0000);
  const low = value >>> 0;
  view.setUint32(0, high >>> 0);
  view.setUint32(4, low);
  return bytes;
}

function zeros(length: number): Uint8Array {
  return new Uint8Array(length);
}

function ascii(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}
