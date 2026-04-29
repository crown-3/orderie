import EarSvg from "../../assets/ear.svg";
import PatternSvg from "../../assets/cat_pattern.svg";
import WhiskerSvg from "../../assets/whisker.svg";
import Eye from "../eye";
import MouthArea from "../mouth";

interface Props {
  audioLevel: number;
  pupilX: number;
  pupilY: number;
  faceOffset: { x: number; y: number };
  isConnected: boolean;
  isSleeping?: boolean;
  isWinking?: boolean;
}

const Face = ({ audioLevel, pupilX, pupilY, faceOffset, isConnected, isSleeping = false, isWinking = false }: Props) => {
  return (
    <div
      className="relative flex flex-col items-center"
      style={{
        transform: `translate(${faceOffset.x}px, ${faceOffset.y}px)`,
        transition: "transform 1500ms ease-in-out",
      }}
    >
      {/* Ears */}
      <div className="flex gap-[180px]">
        <div className="scale-x-[-1]"><EarSvg /></div>
        <EarSvg />
      </div>

      {/* Whiskers */}
      <div className="absolute top-[200px] flex gap-[350px]">
        <div className="scale-x-[-1]"><WhiskerSvg /></div>
        <WhiskerSvg />
      </div>

      {/* Pattern */}
      <div className="absolute top-[63px] z-1">
        <PatternSvg />
      </div>

      {/* Eyes — left eye never winks; right eye (from character's POV) winks */}
      <div className="absolute top-[130px] flex gap-[112px] z-1">
        <Eye pupilX={pupilX} pupilY={pupilY} isConnected={isConnected} isSleeping={isSleeping} />
        <Eye pupilX={pupilX} pupilY={pupilY} isConnected={isConnected} isSleeping={isSleeping} isWinking={isWinking} />
      </div>

      {/* Mouth */}
      <MouthArea audioLevel={audioLevel} isConnected={isConnected} isSleeping={isSleeping} />
    </div>
  );
};

export default Face;
