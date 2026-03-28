import { useState, useRef, useCallback } from "react";
import type { MutableRefObject } from "react";

export function useAudioLevel<T>(cartItemsRef: MutableRefObject<T[]>) {
  const [audioLevel, setAudioLevel] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  const start = useCallback(
    async (stream: MediaStream) => {
      const ctx = new AudioContext();
      await ctx.resume();
      ctxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        // Skip React state updates in cart mode: the Face is hidden so
        // audioLevel is unused, and 60fps re-renders starve the WebRTC loop.
        if (cartItemsRef.current.length === 0) {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) {
            const n = (v - 128) / 128;
            sum += n * n;
          }
          setAudioLevel(Math.min(1, Math.sqrt(sum / buf.length) * 8));
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [cartItemsRef],
  );

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close();
    ctxRef.current = null;
    setAudioLevel(0);
  }, []);

  return { audioLevel, start, stop };
}
