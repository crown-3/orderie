"use client";

import EyebrowSvg from "../../assets/eyebrow.svg";
import EyeClosedSvg from "../../assets/eye_closed.svg";
import PupilSvg from "../../assets/pupil.svg";

interface Props {
  pupilX: number;
  pupilY: number;
  isConnected: boolean;
}

const CalculateMovementPX = (
  percentage: number,
  offset: number,
  maximumMovement: number,
) => offset + (percentage / 100) * maximumMovement;

const X_OFFSET_PX = 14;
const X_MAXIMUM_MOVEMENT = 10;
const Y_OFFSET_PX = -11.5;
const Y_MAXIMUM_MOVEMENT = 5;

const Eye = ({ pupilX = 0, pupilY = 0, isConnected }: Props) => {
  if (!isConnected) {
    return (
      <div className="relative">
        <EyeClosedSvg />
      </div>
    );
  }

  const clampedX = Math.max(-100, Math.min(100, pupilX));
  const clampedY = Math.max(-100, Math.min(100, pupilY));

  const translateX = CalculateMovementPX(clampedX, X_OFFSET_PX, X_MAXIMUM_MOVEMENT);
  const translateY = CalculateMovementPX(clampedY, Y_OFFSET_PX, Y_MAXIMUM_MOVEMENT);

  return (
    <div className="relative">
      <EyebrowSvg />

      <div
        className="absolute bottom-0 left-0"
        style={{ transform: `translateX(${translateX}px) translateY(${translateY}px)`, transition: "transform 400ms ease-in-out" }}
      >
        <PupilSvg />
      </div>
    </div>
  );
};

export default Eye;
