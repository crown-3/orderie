import {
  CATEGORIES,
  getMenu,
  menusByCategory,
  optionGroupsFor,
  basePrice,
  unitPrice,
  type Menu,
} from "@/_components/kiosk/_menus";
import type { CartItem } from "./_types";

/**
 * A live snapshot of everything the kiosk is showing. The hook keeps this in a
 * ref (updated whenever the relevant state changes) so the `get_screen_state`
 * tool can serialize the *current* screen on demand — including anything the
 * user changed by tapping, which the AI never sees otherwise.
 */
export interface ScreenSnapshot {
  optionMenuId: string | null;
  optionSelection: string[];
  cartItems: CartItem[];
  showCart: boolean;
  paymentGuideVisible: boolean;
  activeCategory: string | null;
  displayedMenuIds: string[];
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The order so far — embedded in every view so it can be referenced anywhere. */
function cartXml(items: CartItem[]): string {
  const rows = items
    .map((it) => {
      const m = getMenu(it.id);
      if (!m) return null;
      const price = unitPrice(m, it.selectedOptions) * it.quantity;
      const opts = it.selectedOptions?.length
        ? ` options="${esc(it.selectedOptions.join(" / "))}"`
        : "";
      return `    <item id="${it.id}" name="${esc(m.name)}" qty="${it.quantity}" price="${price}"${opts}/>`;
    })
    .filter((r): r is string => r !== null);

  if (rows.length === 0) return `  <cart count="0" total="0"/>`;

  const count = items.reduce((n, it) => n + it.quantity, 0);
  const total = items.reduce((sum, it) => {
    const m = getMenu(it.id);
    return m ? sum + unitPrice(m, it.selectedOptions) * it.quantity : sum;
  }, 0);
  return `  <cart count="${count}" total="${total}">\n${rows.join("\n")}\n  </cart>`;
}

/** The 3-column product grid, with explicit positions so "오른쪽 제일 위" resolves. */
function gridXml(s: ScreenSnapshot): string {
  const category = s.activeCategory ?? CATEGORIES[0];
  const highlighting = s.displayedMenuIds.length > 0;
  const menus: Menu[] = highlighting
    ? s.displayedMenuIds.map(getMenu).filter((m): m is Menu => Boolean(m))
    : menusByCategory(category);

  const cards = menus
    .map((m, i) => {
      const row = Math.floor(i / 3) + 1;
      const col = (i % 3) + 1;
      return `    <card pos="${i + 1}" row="${row}" col="${col}" id="${m.id}" name="${esc(m.name)}" price="${basePrice(m)}"/>`;
    })
    .join("\n");

  const hl = highlighting ? ' highlighted="true"' : "";
  return `  <grid cols="3" category="${esc(category)}"${hl}>\n${cards}\n  </grid>`;
}

/** The option modal: every group + option, with which are currently checked. */
function optionsXml(menuId: string, selection: string[]): string {
  const m = getMenu(menuId);
  if (!m) return "";
  const groups = optionGroupsFor(m);
  const requiredSatisfied = groups
    .filter((g) => g.type.includes("required"))
    .every((g) => g.options.some((o) => selection.includes(o.label)));

  const groupXml = groups
    .map((g) => {
      const opts = g.options
        .map((o) => {
          const sel = selection.includes(o.label);
          const delta = o.price_delta > 0 ? ` price-delta="${o.price_delta}"` : "";
          return `      <option label="${esc(o.label)}" selected="${sel}"${delta}/>`;
        })
        .join("\n");
      return `    <group id="${g.id}" name="${esc(g.name)}" type="${g.type}">\n${opts}\n    </group>`;
    })
    .join("\n");

  return `  <options menu-id="${m.id}" menu-name="${esc(m.name)}" price="${unitPrice(m, selection)}" required-satisfied="${requiredSatisfied}">\n${groupXml}\n  </options>`;
}

/**
 * Serialize the current screen to XML. The root `view` attribute is a
 * discriminated union — payment > options > cart > menu — mirroring the render
 * precedence in KioskScreen. The cart is included in every view.
 */
export function buildScreenStateXml(s: ScreenSnapshot): string {
  const view = s.paymentGuideVisible
    ? "payment"
    : s.optionMenuId
      ? "options"
      : s.showCart && s.cartItems.length > 0
        ? "cart"
        : "menu";

  const parts: string[] = [cartXml(s.cartItems)];

  if (view === "menu") {
    parts.push(gridXml(s));
  } else if (view === "options" && s.optionMenuId) {
    const body = optionsXml(s.optionMenuId, s.optionSelection);
    if (body) parts.push(body);
  }
  // "cart" view: the <cart> element above is the body. "payment": no extra body.

  return `<screen view="${view}">\n${parts.join("\n")}\n</screen>`;
}
