import { isAnimatedGifBuffer, isAnimatedGif } from '../image_utils.js';
import { expect } from 'expect';

describe("Image Utils", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns false for non-GIF data", () => {
    const buffer = new Uint8Array([0x00, 0x01, 0x02]);
    expect(isAnimatedGifBuffer(buffer.buffer)).toBe(false);
  });

  it("returns false for a GIF with no frames detected", () => {
    // Header: GIF89a
    const buffer = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(isAnimatedGifBuffer(buffer.buffer)).toBe(false);
  });

  it("returns false for a static GIF (1 frame)", () => {
    // Header + 1 frame sequence
    // Frame header signature: 00 21 F9 04 xx xx xx xx 00 2C
    const frameHeader = [0x00, 0x21, 0xF9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2C];
    const buffer = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      ...frameHeader
    ]);
    expect(isAnimatedGifBuffer(buffer.buffer)).toBe(false);
  });

  it("returns true for an animated GIF (2 frames)", () => {
     // Header + 2 frame sequences
    const frameHeader = [0x00, 0x21, 0xF9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2C];
    const buffer = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      ...frameHeader,
      0x00, // Dummy data
      ...frameHeader
    ]);
    expect(isAnimatedGifBuffer(buffer.buffer)).toBe(true);
  });
  
  it("handles the 0x21 variant for image separator", () => {
     // Header + 2 frame sequences using 0x21 at index 9
    const frameHeader = [0x00, 0x21, 0xF9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21];
    const buffer = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      ...frameHeader,
      ...frameHeader
    ]);
    expect(isAnimatedGifBuffer(buffer.buffer)).toBe(true);
  });

  describe("isAnimatedGif (async fetch wrapper)", () => {
    it("returns false for data: URIs", async () => {
        expect(await isAnimatedGif("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")).toBe(false);
    });

    it("fetches and checks URL", async () => {
        const buffer = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // Static GIF header
        global.fetch = async (url) => {
            return {
                arrayBuffer: async () => buffer.buffer
            };
        };
        expect(await isAnimatedGif("http://example.com/image.gif")).toBe(false);
    });
  });
});
