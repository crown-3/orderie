import Image from "next/image";
import ArrowSvg from "../assets/arrow.svg";
import InsertCardImage from "../assets/insertCard.png";

/**
 * Full-screen card-insertion guide shown during the payment step.
 */
const PaymentGuide = () => (
  <section className="absolute inset-0 z-40 bg-white">
    <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center gap-10">
      <p className="text-center text-brand font-bold text-5xl tracking-tight leading-snug animate-slide-fade-in">
        아래 카드 투입구에
        <br />
        카드를 꽂아주세요
      </p>

      <Image
        src={InsertCardImage}
        alt="카드 투입구 이미지"
        className="animate-slide-fade-in"
        style={{ animationDelay: "200ms" }}
      />

      <div
        className="text-brand animate-slide-fade-in"
        style={{ animationDelay: "400ms" }}
      >
        <ArrowSvg />
      </div>
    </div>
  </section>
);

export default PaymentGuide;
