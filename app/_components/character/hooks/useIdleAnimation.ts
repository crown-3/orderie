import { useEffect, useRef, useState } from "react";

export const useIdleAnimation = () => {
  const [faceOffset, setFaceOffset] = useState({ x: 0, y: 0 });
  const faceTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const schedule = () => {
      faceTimerRef.current = setTimeout(() => {
        setFaceOffset({
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 8,
        });
        schedule();
      }, 2000 + Math.random() * 3000);
    };
    schedule();
    return () => { if (faceTimerRef.current) clearTimeout(faceTimerRef.current); };
  }, []);

  return { faceOffset };
};
