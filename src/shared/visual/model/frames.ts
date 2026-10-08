/**
 * Memory for visual frames: the last measured height of each block, so a
 * frame that unmounts and comes back takes the same space, and a cap on how
 * many frames are alive at once across the app.
 */

export const LIVE_FRAME_LIMIT = 6;

const heights = new Map<string, number>();

export function cachedVisualHeight(hash: string): number | undefined {
  return heights.get(hash);
}

export function cacheVisualHeight(hash: string, height: number) {
  if (height > 0) heights.set(hash, height);
}

export type FrameRegistry = {
  /** Marks an entry as used now; the least recent one past the limit gets
   * its `onEvict` called and leaves. */
  touch(id: string, onEvict: () => void): void;
  release(id: string): void;
  size(): number;
};

export function createFrameRegistry(limit = LIVE_FRAME_LIMIT): FrameRegistry {
  const order = new Map<string, () => void>();
  return {
    touch(id, onEvict) {
      order.delete(id);
      order.set(id, onEvict);
      if (order.size <= limit) return;
      const [oldest, evict] = order.entries().next().value as [
        string,
        () => void,
      ];
      order.delete(oldest);
      evict();
    },
    release(id) {
      order.delete(id);
    },
    size() {
      return order.size;
    },
  };
}

/** The registry every frame in the app shares. */
export const liveFrames = createFrameRegistry();
