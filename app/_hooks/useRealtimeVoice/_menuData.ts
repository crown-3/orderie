import instructionsMd from "@/assets/instructions.md";
import menusJson from "@/assets/menus.json";

type MenuJson = typeof menusJson;

// Strip fields that add tokens without helping ordering decisions:
// - origin: rarely asked, not needed for order flow
// - is_hot: implied by og_temp options availability
// - option id/price_delta: AI only needs labels for selected_options
const compactMenus = {
  ...menusJson,
  option_groups: menusJson.option_groups.map((og) => ({
    id: og.id,
    name: og.name,
    type: og.type,
    options: og.options.map((o) => ({
      label: o.label,
      ...(o.price_delta ? { price_delta: o.price_delta } : {}),
    })),
  })),
  menus: (menusJson as MenuJson).menus.map(({ origin: _o, is_hot: _h, ...rest }) => rest),
};

export const instructions = `${instructionsMd}

---
## 메뉴 정보 (JSON)
${JSON.stringify(compactMenus)}`;
