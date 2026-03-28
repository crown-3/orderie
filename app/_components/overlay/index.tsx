import Image from "next/image";
import ArrowSvg from "./assets/arrow.svg";
import InsertCardImage from "./assets/insertCard.png";

interface Props {
  isVisible: boolean;
  tpm: number;
}

const OverlaySection = ({ isVisible, tpm }: Props) => {
  return (
    <>
      {isVisible && (
        <section className="absolute inset-0 z-50 text-[#fff] pointer-events-none">
          <div className="relative w-full h-[100dvh] overflow-hidden">
            <div className="absolute w-[600px] h-[600px] rounded-full bg-[#000] blur-[50px] bottom-[-300px] right-[-120px]" />

            <Image
              src={InsertCardImage}
              alt="카드 투입구 이미지"
              className="absolute right-[40px] bottom-[380px] animate-slide-fade-in"
              style={{ animationDelay: "0ms" }}
            />

            <p
              className="absolute text-right text-4xl font-bold tracking-tight leading-tight right-[225px] bottom-[255px] animate-slide-fade-in"
              style={{ animationDelay: "300ms" }}
            >
              아래 카드 투입구에 <br /> 카드를 꽂아주세요
            </p>

            <div
              className="absolute stroke-current bottom-[60px] right-[120px] animate-slide-fade-in"
              style={{ animationDelay: "600ms" }}
            >
              <ArrowSvg />
            </div>
          </div>
        </section>
      )}

      {/* Debug TPM badge — always visible */}
      <div className="absolute top-3 right-3 z-50 pointer-events-none font-mono text-xs text-white bg-black/60 rounded px-2 py-1 tabular-nums">
        {tpm.toLocaleString()} TPM
      </div>
    </>
  );
};

export default OverlaySection;
