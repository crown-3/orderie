import presentationMd from "@/assets/presentation.md";
import menusJson from "@/assets/menus.json";

type MenuJson = typeof menusJson;

// Minimal menu data: only id, name, and applicable_option_groups for update_cart_item.
const minimalMenus = (menusJson as MenuJson).menus.map(({ id, name, applicable_option_groups }) => ({
  id,
  name,
  applicable_option_groups,
}));

export const instructions = `${presentationMd}

---
## 메뉴 데이터 (update_cart_item용)
${JSON.stringify(minimalMenus)}`;
