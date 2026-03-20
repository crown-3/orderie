import {
  ExclamationTriangleIcon,
  ShoppingCartIcon,
} from "@heroicons/react/20/solid";
import Menu from "./components/menu";
import menusJson from "@/assets/menus.json";
import HamburgerImage from "@/assets/menuImages/hamburger.jpg";
import { CartItem } from "@/_hooks/useRealtimeVoice";

interface Props {
  displayedMenuIds: string[];
  cartItems: CartItem[];
  onUpdateCartItem: (id: string, quantity: number) => void;
}

const UISection = ({
  displayedMenuIds,
  cartItems,
  onUpdateCartItem,
}: Props) => {
  const isCartMode = cartItems.length > 0;

  const displayedMenus = menusJson.menus.filter((m) =>
    displayedMenuIds.includes(m.id),
  );

  const cartMenus = cartItems
    .map((item) => ({
      menu: menusJson.menus.find((m) => m.id === item.id)!,
      quantity: item.quantity,
    }))
    .filter((i) => i.menu);

  const total = cartMenus.reduce(
    (sum, { menu, quantity }) =>
      sum + (menu.discount_price ?? menu.price) * quantity,
    0,
  );

  return (
    <section
      className={`bg-[#000] w-full flex flex-col items-center p-4 gap-3 ${isCartMode ? "flex-1 overflow-y-auto" : ""}`}
    >
      {isCartMode && (
        <div className="flex items-center gap-2 text-[#fff] w-full pl-2">
          <ShoppingCartIcon className="w-[34px]" />
          <p className="text-[#fff] font-semibold text-[24px]">주문 확인</p>
        </div>
      )}

      {isCartMode
        ? cartMenus.map(({ menu, quantity }) => (
            <Menu
              key={menu.id}
              isWithCount
              count={quantity}
              onIncrement={() => onUpdateCartItem(menu.id, quantity + 1)}
              onDecrement={() => onUpdateCartItem(menu.id, quantity - 1)}
              name={menu.name}
              description={menu.description}
              menuImage={HamburgerImage}
              price={menu.discount_price ?? menu.price}
              isDiscounted={menu.discount_price !== undefined}
              originalPrice={menu.price}
            />
          ))
        : displayedMenus.map((menu) => (
            <Menu
              key={menu.id}
              name={menu.name}
              description={menu.description}
              menuImage={HamburgerImage}
              price={menu.discount_price ?? menu.price}
              isDiscounted={menu.discount_price !== undefined}
              originalPrice={menu.price}
            />
          ))}

      {isCartMode && (
        <div className="flex items-end gap-2 text-[#fff] font-bold w-full justify-end mb-10 mt-2">
          <p className="text-2xl">합계</p>
          <p className="text-5xl">{total.toLocaleString("ko-KR")}</p>
        </div>
      )}

      {isCartMode || displayedMenus.length > 0 ? (
        <div className="flex gap-5 w-full justify-center items-center mt-4">
          <button className="bg-[#fff] px-6 py-3 rounded-[12px] gap-1 flex items-center">
            <ExclamationTriangleIcon className="w-8" />
            <h1 className="text-[24px] font-bold">직원 호출</h1>
          </button>

          <p className="text-[#fff] font-semibold text-[20px]">
            키오스크가 이상하거나, 주문 중 도움이 필요하시면 눌러주세요
          </p>
        </div>
      ) : (
        <>
          <p className="text-[#fff] font-semibold text-3xl">
            키오스크가 이상하거나, 주문 중 도움이 필요하시면 눌러주세요
          </p>

          <button className="bg-[#fff] px-9 py-6 rounded-[24px] gap-2 flex items-center">
            <ExclamationTriangleIcon className="w-15" />
            <h1 className="text-[48px] font-bold">직원 호출</h1>
          </button>
        </>
      )}
    </section>
  );
};

export default UISection;
