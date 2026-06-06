import { tool } from "@openai/agents";
import { z } from "zod";
import { startTransition } from "react";
import type { MutableRefObject } from "react";
import type { CartItem } from "./_types";
import { buildScreenStateXml, type ScreenSnapshot } from "./_screenState";
import { getMenuDetails } from "./_menuData";

type Slog = (...args: unknown[]) => void;

interface ToolDeps {
  cartItemsRef: MutableRefObject<CartItem[]>;
  /** Live snapshot of the whole screen, read on demand by get_screen_state. */
  screenRef: MutableRefObject<ScreenSnapshot>;
  setCartItems: (items: CartItem[]) => void;
  setDisplayedMenuIds: (ids: string[]) => void;
  setActiveCategory: (category: string | null) => void;
  setOptionMenuId: (id: string | null) => void;
  setOptionSelection: (labels: string[]) => void;
  setShowCart: (show: boolean) => void;
  setPaymentGuideVisible: (visible: boolean) => void;
  slog: Slog;
}

export function createOrderingTools({
  cartItemsRef,
  screenRef,
  setCartItems,
  setDisplayedMenuIds,
  setActiveCategory,
  setOptionMenuId,
  setOptionSelection,
  setShowCart,
  setPaymentGuideVisible,
  slog,
}: ToolDeps) {
  // Switch the active category tab. The grid shows that category's menus.
  const setActiveCategoryTool = tool({
    name: "set_active_category",
    description:
      "화면 상단의 카테고리 탭을 전환하고 해당 카테고리의 메뉴를 그리드에 표시합니다. 특정 메뉴만 강조할 때는 set_displayed_menus를 사용하세요.",
    parameters: z.object({
      category: z
        .string()
        .describe("menus.json의 categories 중 하나. 예: '추천/할인', '에스프레소'"),
    }),
    execute: async ({ category }) => {
      slog("[tool] set_active_category", category);
      startTransition(() => {
        setActiveCategory(category);
        setDisplayedMenuIds([]); // clear any highlight so the full category shows
      });
      return "category_set";
    },
  });

  // Highlight a specific set of menu cards (e.g. when recommending items).
  const setDisplayedMenusTool = tool({
    name: "set_displayed_menus",
    description:
      "화면에 강조 표시할 메뉴 카드를 지정합니다. 응답 텍스트 출력 전에 호출하세요. 한 번에 최대 6개. 빈 배열을 전달하면 강조를 해제합니다.",
    parameters: z.object({
      id_list: z.array(z.string()).describe("강조할 메뉴 id 목록 (최대 6개)"),
    }),
    execute: async ({ id_list }) => {
      slog("[tool] set_displayed_menus", id_list);
      startTransition(() => setDisplayedMenuIds(id_list.slice(0, 6)));
      return "menus_displayed";
    },
  });

  // Open the option-selection modal for a menu being configured, and reflect
  // the currently-confirmed options. Call this AGAIN (with the cumulative
  // selected_options) every time the user picks or changes an option so the
  // on-screen chips stay in sync with the conversation.
  const showOptionsTool = tool({
    name: "show_options",
    description:
      "해당 메뉴의 옵션 선택 화면(모달)을 띄우고, 현재까지 확정된 옵션을 화면에 체크 표시합니다. 옵션 안내를 시작할 때, 그리고 사용자가 옵션을 말할 때마다 누적된 selected_options와 함께 다시 호출하세요. (예: 사용자가 '라지 사이즈'라고 하면 selected_options=['라지(L)']로 호출)",
    parameters: z.object({
      menu_id: z.string().describe("옵션을 선택할 메뉴 id"),
      selected_options: z
        .array(z.string())
        .optional()
        .describe("지금까지 확정된 옵션 label 목록. 예: ['ICED', '라지(L)']"),
    }),
    execute: async ({ menu_id, selected_options }) => {
      slog("[tool] show_options", { menu_id, selected_options });
      startTransition(() => {
        setOptionMenuId(menu_id);
        setOptionSelection(selected_options ?? []);
      });
      return "options_shown";
    },
  });

  const closeOptionsTool = tool({
    name: "close_options",
    description: "옵션 선택 화면(모달)을 닫고 기본 메뉴 화면으로 돌아갑니다.",
    parameters: z.object({}),
    execute: async () => {
      slog("[tool] close_options");
      startTransition(() => {
        setOptionMenuId(null);
        setOptionSelection([]);
      });
      return "options_closed";
    },
  });

  // Show the cart (장바구니) screen so the user can review items before paying.
  const openCartTool = tool({
    name: "open_cart",
    description:
      "장바구니(주문 내역) 화면을 띄웁니다. 사용자가 '장바구니 보여줘', '담은 거 확인' 등 장바구니 확인을 원할 때 호출하세요.",
    parameters: z.object({}),
    execute: async () => {
      slog("[tool] open_cart");
      startTransition(() => setShowCart(true));
      return "cart_opened";
    },
  });

  // Add / update / remove a cart item. Confirmed options arrive as label strings.
  const updateCartItemTool = tool({
    name: "update_cart_item",
    description:
      "사용자가 메뉴를 장바구니에 담기로 확정하면 호출합니다. quantity=0이면 해당 메뉴를 제거합니다. 호출 시 옵션 선택 화면은 자동으로 닫히지만, 장바구니 화면으로 자동 전환되지는 않습니다. 담은 뒤에는 '더 주문하시겠어요, 아니면 결제하시겠어요?'라고 물어보세요.",
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
      startTransition(() => {
        setOptionMenuId(null); // configuring is done
        setOptionSelection([]);
      });
      return "cart_updated";
    },
  });

  // Read-only: full detail for one menu (description, ingredients, origin, and
  // its option groups). Pulled on demand so this bulk stays out of the
  // always-on system prompt — the injected menu list carries only a summary.
  const getMenuDetailsTool = tool({
    name: "get_menu_details",
    description:
      "메뉴 하나의 상세 정보(설명·재료·원산지·적용 가능한 옵션 그룹과 옵션 목록)를 JSON으로 반환합니다. 주입된 메뉴 목록에는 요약(이름·가격·태그)만 있으므로, 메뉴를 자세히 설명·추천하거나 옵션 안내를 시작하기 직전에 이 도구를 호출해 상세/옵션 정보를 확보하세요.",
    parameters: z.object({
      menu_id: z.string().describe("상세 정보를 볼 메뉴 id"),
    }),
    execute: async ({ menu_id }) => {
      slog("[tool] get_menu_details", menu_id);
      return getMenuDetails(menu_id);
    },
  });

  // Read-only: serialize whatever is currently on screen. The AI PULLS this on
  // demand (only on turns where it needs to ground a deictic reference or know
  // the live cart/option state) instead of us pushing context every turn.
  const getScreenStateTool = tool({
    name: "get_screen_state",
    description:
      "지금 화면에 보이는 내용을 XML로 반환합니다. 사용자가 '여기', '이거', '저거', '위에 있는', '오른쪽', '맨 위' 등 화면을 가리키는 말을 하거나, 현재 장바구니 구성·선택 중인 옵션 상태를 알아야 답할 수 있을 때 호출하세요. 반환된 view 속성(menu/options/cart/payment)으로 어떤 화면인지 판단하세요. cart 요소는 항상 포함됩니다.",
    parameters: z.object({}),
    execute: async () => {
      const xml = buildScreenStateXml(screenRef.current);
      slog("[tool] get_screen_state", xml);
      return xml;
    },
  });

  // Show the card-insertion payment guide overlay.
  const showPaymentGuideTool = tool({
    name: "show_payment_guide",
    description:
      "결제 단계에서 카드 투입 안내 화면을 표시합니다. 사용자가 결제·완료 의사를 밝히면 음성 안내 직전에 호출하세요. 이미 표시된 상태면 재호출하지 마세요.",
    parameters: z.object({}),
    execute: async () => {
      slog("[tool] show_payment_guide");
      startTransition(() => setPaymentGuideVisible(true));
      return "payment_guide_shown";
    },
  });

  return [
    setActiveCategoryTool,
    setDisplayedMenusTool,
    showOptionsTool,
    closeOptionsTool,
    openCartTool,
    updateCartItemTool,
    getMenuDetailsTool,
    getScreenStateTool,
    showPaymentGuideTool,
  ];
}
