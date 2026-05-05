import {
  BellAlertIcon,
  ShoppingCartIcon,
} from "@heroicons/react/20/solid";
import Menu from "./components/menu";
import menusJson from "@/assets/menus.json";
import MenuImage from "@/assets/menuImages/coffee.jpg";
import { CartItem } from "@/_hooks/useRealtimeVoice";
import ClickIcon from "./assets/click.svg"
import Image from "next/image";
import { PRESENTATION_IMAGES } from "@/assets/presentations";

interface Props {
  displayedMenuIds: string[];
  cartItems: CartItem[];
  onUpdateCartItem: (id: string, quantity: number) => void;
  onOrder: () => void;
  isOrdering: boolean;
  isPaymentComplete: boolean;
  presentationImage: string | null;
}

const UISection = ({
  displayedMenuIds,
  cartItems,
  onUpdateCartItem,
  onOrder,
  isOrdering,
  isPaymentComplete,
  presentationImage,
}: Props) => {
  const isCartMode = cartItems.length > 0;
  const isPresentationMode = presentationImage !== null;

  const displayedMenus = menusJson.menus.filter((m) =>
    displayedMenuIds.includes(m.id),
  );

  const cartMenus = cartItems
    .map((item) => ({
      menu: menusJson.menus.find((m) => m.id === item.id)!,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions,
    }))
    .filter((i) => i.menu);

  const total = cartMenus.reduce(
    (sum, { menu, quantity }) =>
      sum + (menu.discount_price ?? menu.price) * quantity,
    0,
  );

  return (
    <section
      className={`relative bg-[#000] flex flex-col items-center gap-3 ${isCartMode || isPaymentComplete ? "overflow-y-auto w-[50vw] p-4"
          : isPresentationMode ? "w-[50vw]"
            : ""
        }`}
    >
      {/* All content fades out when payment completes */}
      <div
        className="w-full flex flex-col items-center gap-3 transition-opacity duration-700 h-full"
        style={{ opacity: isPaymentComplete ? 0 : 1, pointerEvents: isPaymentComplete ? "none" : "auto" }}
      >
        {isPresentationMode ? (
          <div className="flex flex-col h-full w-full">
            <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
              {PRESENTATION_IMAGES[presentationImage!] ? (
                <Image
                  src={PRESENTATION_IMAGES[presentationImage!]}
                  alt="Presentation"
                  className="w-full h-full object-contain"
                />
              ) : (
                <p className="text-white text-2xl opacity-50">{presentationImage}</p>
              )}
            </div>
            <div className="w-full flex justify-center items-center gap-10 h-[100px] shrink-0">
              <button className="px-9 py-6 gap-3 flex items-center text-[#fff]">
                <BellAlertIcon className="w-[36px]" />
                <h1 className="text-[26px] font-bold">직원 호출</h1>
              </button>
              <button className="px-9 py-6 gap-3 flex items-center text-[#fff]">
                <ClickIcon className="w-[36px] text-[#fff]" />
                <h1 className="text-[26px] font-bold">터치 모드</h1>
              </button>
            </div>
          </div>
        ) : isCartMode ? (
          <>
            <div className="flex items-center gap-2 text-[#fff] w-full pl-2">
              <ShoppingCartIcon className="w-[34px]" />
              <p className="text-[#fff] font-semibold text-[24px]">주문 확인</p>
            </div>

            {cartMenus.map(({ menu, quantity, selectedOptions }) => (
              <Menu
                key={menu.id}
                isWithCount
                count={quantity}
                onIncrement={() => onUpdateCartItem(menu.id, quantity + 1)}
                onDecrement={() => onUpdateCartItem(menu.id, quantity - 1)}
                name={menu.name}
                description={
                  selectedOptions?.length
                    ? selectedOptions.join(" · ")
                    : menu.description
                }
                menuImage={MenuImage}
                price={menu.discount_price ?? menu.price}
                isDiscounted={menu.discount_price !== undefined}
                originalPrice={menu.price}
              />
            ))}

            <div className="flex items-end gap-2 text-[#fff] font-bold w-full justify-end mb-10 mt-2">
              <p className="text-2xl">합계</p>
              <p className="text-5xl">{total.toLocaleString("ko-KR")}</p>
            </div>

            <div className="flex gap-5 w-full justify-center items-center mt-auto">
              <div className="w-full flex justify-center items-center gap-10 h-[100px]">
                <button className="px-9 py-6 gap-3 flex items-center text-[#fff]">
                  <BellAlertIcon className="w-[36px]" />
                  <h1 className="text-[26px] font-bold">직원 호출</h1>
                </button>
                <button className="px-9 py-6 gap-3 flex items-center text-[#fff]">
                  <ClickIcon className="w-[36px] text-[#fff]" />
                  <h1 className="text-[26px] font-bold">터치 모드</h1>
                </button>
              </div>
            </div>
          </>
        ) : displayedMenus.length > 0 ? (
          <>
            {displayedMenus.map((menu) => (
              <Menu
                key={menu.id}
                name={menu.name}
                description={menu.description}
                menuImage={MenuImage}
                price={menu.discount_price ?? menu.price}
                isDiscounted={menu.discount_price !== undefined}
                originalPrice={menu.price}
              />
            ))}
          </>
        ) : (
          <div className="flex flex-col gap-5 h-full justify-center items-center p-4">
            <button className="px-9 py-6 gap-3 flex items-center text-[#fff]">
              <BellAlertIcon className="w-[50px]" />
              <h1 className="text-[40px] font-bold">직원 호출</h1>
            </button>

            <div className="h-[2px] bg-[#404040] w-full" />

            <button className="px-9 py-6 gap-3 flex items-center text-[#fff]">
              <ClickIcon className="w-[50px] text-[#fff]" />
              <h1 className="text-[40px] font-bold">터치 모드</h1>
            </button>
          </div>
        )}
      </div>

      {/* "주문 완료!" — fades in after content fades out */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-700"
        style={{
          opacity: isPaymentComplete ? 1 : 0,
          transitionDelay: isPaymentComplete ? "400ms" : "0ms",
        }}
      >
        <p className="text-[#fff] text-6xl font-bold tracking-tight">주문 완료!</p>
      </div>
    </section>
  );
};

export default UISection;
