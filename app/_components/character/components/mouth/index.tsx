import { useEffect, useState } from "react";
import LipMaskSvg from "../../assets/lip_mask.svg";
import LipSvg from "../../assets/lip_and_nose.svg";
import MouthSvg from "../../assets/mouth.svg";

interface Props {
  audioLevel: number;
  isConnected: boolean;
}

const SNORE_PERIOD_S = 4;
const SNORE_MIN = 0.4;
const SNORE_MAX = 0.8;

const MouthArea = ({ audioLevel, isConnected }: Props) => {
  const [snoreLevel, setSnoreLevel] = useState(0);

  useEffect(() => {
    if (isConnected) { setSnoreLevel(0); return; }
    const id = setInterval(() => {
      const t = Date.now() / 1000;
      setSnoreLevel(SNORE_MIN + ((Math.sin((t * Math.PI * 2) / SNORE_PERIOD_S) + 1) / 2) * (SNORE_MAX - SNORE_MIN));
    }, 100);
    return () => clearInterval(id);
  }, [isConnected]);

  const level = isConnected ? audioLevel : snoreLevel;
  const mouthY = 150 + level * 60;
  const lipY = -59 + level * -6;
  const transition = isConnected ? "transform 60ms linear" : "transform 400ms ease-in-out";

  return (
    <div className="-translate-y-[80px] flex flex-col items-center z-0">
      {/* Mouth - rises when AI speaks */}
      <div style={{ transform: `translateY(${mouthY}px)`, transition }}>
        <MouthSvg />
      </div>

      {/* Lip - drops slightly when AI speaks */}
      <div
        className="flex flex-col items-center"
        style={{ transform: `translateY(${lipY}px)`, transition }}
      >
        <div className="translate-y-1/2">
          <LipMaskSvg />
        </div>
        <div className="relative z-[1]">
          <LipSvg />
        </div>
      </div>
    </div>
  );
};

export default MouthArea;
