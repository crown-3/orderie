// Shared speaker-verification pipeline — loaded once per Node.js process.
// Both /enroll and /verify import from here so the model is not loaded twice.

import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "Xenova/wavlm-base-plus-sv";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getExtractor(): Promise<any> {
  if (!cached) {
    cached = pipeline("feature-extraction", MODEL_ID, { dtype: "fp32" });
  }
  return cached;
}

export async function embed(samples: Float32Array): Promise<Float32Array> {
  const extractor = await getExtractor();
  const out = await extractor(samples, { pooling: "mean", normalize: true });
  return out.data instanceof Float32Array
    ? out.data
    : new Float32Array(Array.from(out.data as number[]));
}

export function cosSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
