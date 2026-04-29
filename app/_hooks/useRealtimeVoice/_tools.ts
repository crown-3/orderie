import { tool } from "@openai/agents";
import { z } from "zod";
import { startTransition } from "react";
import type { MutableRefObject } from "react";
import type { CartItem } from "./_types";

type Slog = (...args: unknown[]) => void;

export function createOrderingTools(
  cartItemsRef: MutableRefObject<CartItem[]>,
  setCartItems: (items: CartItem[]) => void,
  setPresentationImage: (name: string | null) => void,
  slog: Slog,
) {
  const updateCartItemTool = tool({
    name: "update_cart_item",
    description:
      "발표 중 주문 시연이 요청될 때 호출합니다. quantity=0이면 해당 메뉴를 장바구니에서 제거합니다.",
    parameters: z.object({
      menu_id: z.string().describe("메뉴 ID"),
      quantity: z.number().int().min(0).describe("수량. 0이면 장바구니에서 제거."),
      selected_options: z
        .array(z.string())
        .optional()
        .describe('확정된 옵션 label 목록. 예: ["ICED", "라지(L)"]'),
    }),
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
      }
      setCartItems(next);
      return "cart_updated";
    },
  });

  const showPresentationTool = tool({
    name: "show_presentation",
    description:
      "지정된 이미지를 오른쪽 화면에 표시합니다. 대본에 [show: imageName] 명령이 있을 때 말하기 직전에 호출하세요.",
    parameters: z.object({
      image_name: z.string().describe("표시할 이미지 이름 (예: ptImage-1)"),
    }),
    execute: async ({ image_name }) => {
      slog("[tool] show_presentation", image_name);
      startTransition(() => setPresentationImage(image_name));
      return "presentation_shown";
    },
  });

  const closePresentationTool = tool({
    name: "close_presentation",
    description:
      "화면을 기본 상태로 되돌립니다. 대본에 [close] 명령이 있을 때 호출하세요.",
    parameters: z.object({}),
    execute: async () => {
      slog("[tool] close_presentation");
      startTransition(() => setPresentationImage(null));
      return "presentation_closed";
    },
  });

  return [updateCartItemTool, showPresentationTool, closePresentationTool];
}
