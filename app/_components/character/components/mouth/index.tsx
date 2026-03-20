import LipMaskSvg from "../../assets/lip_mask.svg";
import LipSvg from "../../assets/lip_and_nose.svg";
import MouthSvg from "../../assets/mouth.svg";

interface Props {
  audioLevel: number;
}

const MouthArea = ({ audioLevel }: Props) => {
  // Mouth drops from behind LipMask as it opens: 130px (closed) → 190px (fully open)
  const mouthY = 150 + audioLevel * 60;
  // Lip drops slightly as mouth opens: -59px (closed) → -53px (fully open)
  const lipY = -59 + audioLevel * -6;

  return (
    <div className="-translate-y-[80px] flex flex-col items-center z-0">
      {/* Mouth - rises when AI speaks */}
      <div
        style={{
          transform: `translateY(${mouthY}px)`,
          transition: "transform 60ms linear",
        }}
      >
        <MouthSvg />
      </div>

      {/* Lip - drops slightly when AI speaks */}
      <div
        className="flex flex-col items-center"
        style={{
          transform: `translateY(${lipY}px)`,
          transition: "transform 60ms linear",
        }}
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
