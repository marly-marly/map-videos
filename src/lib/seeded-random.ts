/**
 * Deterministic PRNG for anything that must look random but render identically
 * on every frame and every machine.
 *
 * Remotion renders frames independently (and potentially out of order across
 * several browser tabs), so Math.random() would give a different scatter/tilt
 * on every frame and the photos would jitter. A seeded generator re-derives the
 * same sequence from the same seed each time, which is what makes photo
 * placement stable across the whole video.
 *
 * This is the Lehmer / MINSTD generator (16807, 2^31-1). Not cryptographic,
 * but cheap and perfectly adequate for scatter and tilt.
 */
export function seededRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
