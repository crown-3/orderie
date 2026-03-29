// In-memory store for the enrolled speaker embedding.
// A kiosk serves one session at a time, so a singleton is sufficient.
// Module-level state persists across API route invocations in the same process.

export const speakerStore: { embedding: Float32Array | null } = {
  embedding: null,
};
