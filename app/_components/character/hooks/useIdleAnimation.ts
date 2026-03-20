import { useEffect, useRef, useState } from "react";

const PUPIL_POSITIONS = [-100, -50, 0, 50, 100];

export const useIdleAnimation = () => {
  const [faceOffset, setFaceOffset] = useState({ x: 0, y: 0 });
  const [pupilX, setPupilX] = useState(0);
  const faceTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pupilTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

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

  useEffect(() => {
    const schedule = () => {
      pupilTimerRef.current = setTimeout(() => {
        setPupilX(PUPIL_POSITIONS[Math.floor(Math.random() * PUPIL_POSITIONS.length)]);
        schedule();
      }, 1500 + Math.random() * 3500);
    };
    schedule();
    return () => { if (pupilTimerRef.current) clearTimeout(pupilTimerRef.current); };
  }, []);

  return { faceOffset, pupilX };
};
