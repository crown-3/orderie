import { tool } from "@openai/agents";
import { z } from "zod";
import { startTransition } from "react";
import type { MutableRefObject } from "react";
import type { CartItem } from "./_types";

type Slog = (...args: unknown[]) => void;

export function createOrderingTools(
  cartItemsRef: MutableRefObject<CartItem[]>,
  setDisplayedMenuIds: (ids: string[]) => void,
  setCartItems: (items: CartItem[]) => void,
  setIsPaymentGuideVisible: (v: boolean) => void,
  slog: Slog,
) {
  const setDisplayedMenusTool = tool({
    name: "set_displayed_menus",
    description:
      "사용자가 메뉴를 언급하거나, 물어보거나, 추천을 요청할 때마다 반드시 호출하세요. 화면에 해당 메뉴 카드를 표시합니다. 메뉴 관련 답변을 하기 전에 이 도구를 먼저 호출해야 합니다. 관심 메뉴가 없어지면 빈 배열로 호출하세요.",
    parameters: z.object({
      menu_ids: z
        .array(z.string())
        .describe('표시할 메뉴 ID 배열 (예: ["b01", "s01"]). 없애려면 []'),
    }),
    execute: async ({ menu_ids }) => {
      slog("[tool] set_displayed_menus", menu_ids);
      startTransition(() => setDisplayedMenuIds(menu_ids));
      return "displayed";
    },
  });

  const updateCartItemTool = tool({
    name: "update_cart_item",
    description:
      "사용자가 메뉴를 주문 확정하거나 장바구니에서 빼고 싶을 때 호출합니다. quantity=0이면 해당 메뉴를 장바구니에서 제거합니다. 주문 확정 시 화면 초기화는 자동으로 처리되므로 set_displayed_menus([])를 별도로 호출하지 마세요. single_required 옵션 그룹이 있는 메뉴는 반드시 모든 필수 옵션을 확인한 뒤에만 호출하세요.",
    parameters: z.object({
      menu_id: z.string().describe("메뉴 ID"),
      quantity: z.number().int().min(0).describe("수량. 0이면 장바구니에서 제거."),
      selected_options: z
        .array(z.string())
        .optional()
        .describe(
          '확정된 옵션 label 목록. 예: ["ICED", "라지(L)", "1샷 추가"]. single_required 그룹 옵션은 반드시 포함해야 합니다.',
        ),
    }),
    // Cart updates must commit immediately — do NOT wrap in startTransition.
    // startTransition makes updates interruptible; a stray urgent event
    // (touch, click) could cause React to defer and eventually drop the update,
    // leaving isCartMode false and the Stop button accidentally tappable.
    execute: async ({ menu_id, quantity, selected_options }) => {
      slog("[tool] update_cart_item", { menu_id, quantity, selected_options });
      const prev = cartItemsRef.current;
      let next: CartItem[];
      if (quantity <= 0) {
        next = prev.filter((i) => i.id !== menu_id);
      } else {
        const exists = prev.find((i) => i.id === menu_id);
        if (exists) {
          next = prev.map((i) =>
            i.id === menu_id ? { ...i, quantity, selectedOptions: selected_options } : i,
          );
        } else {
          next = [...prev, { id: menu_id, quantity, selectedOptions: selected_options }];
        }
        // Auto-clear displayed menus when adding to cart.
        startTransition(() => setDisplayedMenuIds([]));
      }
      setCartItems(next);
      return "cart_updated";
    },
  });

  const showPaymentGuideTool = tool({
    name: "show_payment_guide",
    description:
      "결제 단계로 진입하여 사용자에게 카드 투입구 위치를 시각적으로 안내합니다. 사용자가 결제를 결정했거나 결제 방법을 안내해야 할 때 반드시 호출하세요.",
    parameters: z.object({}),
    execute: async () => {
      slog("[tool] show_payment_guide");
      setIsPaymentGuideVisible(true);
      return "payment_guide_shown";
    },
  });

  return [setDisplayedMenusTool, updateCartItemTool, showPaymentGuideTool];
}
