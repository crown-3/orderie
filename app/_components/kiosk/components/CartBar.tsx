import { ShoppingCartIcon } from "@heroicons/react/24/solid";
import { won } from "../_menus";

interface Props {
  itemCount: number;
  total: number;
  onOpen: () => void;
}

/**
 * Floating bar shown on the menu screen while the cart has items. Tapping it
 * opens the cart — adding an item no longer forces a screen switch.
 */
const CartBar = ({ itemCount, total, onOpen }: Props) => (
  <div className="shrink-0 px-6 pb-6 pt-1">
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-full bg-brand text-white flex items-center justify-between px-7 py-4 shadow-lg active:scale-[0.99] transition-transform"
    >
      <span className="flex items-center gap-3">
        <ShoppingCartIcon className="w-7 h-7" />
        <span className="font-bold text-[24px]">장바구니 {itemCount}</span>
      </span>
      <span className="font-bold text-[24px]">{won(total)} · 주문 보기</span>
    </button>
  </div>
);

export default CartBar;
