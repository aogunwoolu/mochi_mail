declare module "gifenc" {
  interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Uint8Array;
        delay?: number;
        /** 0 = loop forever, -1 = no loop */
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(): GIFEncoderInstance;

  export function quantize(
    data: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    opts?: {
      format?: string;
      oneBitAlpha?: boolean;
      clearAlpha?: boolean;
      clearAlphaColor?: number;
      clearAlphaThreshold?: number;
    },
  ): Uint8Array;

  export function applyPalette(
    data: Uint8ClampedArray | Uint8Array,
    palette: Uint8Array,
    format?: string,
  ): Uint8Array;
}
