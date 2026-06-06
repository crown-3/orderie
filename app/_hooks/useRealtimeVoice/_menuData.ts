import instructionsMd from "@/assets/instructions.md";
import menusJson from "@/assets/menus.json";

type MenuJson = typeof menusJson;
const json = menusJson as MenuJson;

// Minimal, always-injected index — just enough to recognise, recommend, and
// price every menu. Descriptions, ingredients, origin, and option groups are
// NOT included here; they're pulled on demand via get_menu_details so they
// don't re-bill on every turn (the whole system prompt is re-read each
// response, so keeping this small is the biggest TPM lever).
const menuIndex = json.menus.map(
  ({ id, category, name, price, discount_price, tags }) => ({
    id,
    category,
    name,
    price,
    discount_price,
    tags,
  }),
);

export const instructions = `${instructionsMd}

---
## 매장 / 메뉴 데이터 (요약)

- 가게: ${json.store_name}
- 카테고리: ${JSON.stringify(json.categories)}
- 메뉴 목록(요약): ${JSON.stringify(menuIndex)}

이 목록에는 요약 정보(이름·가격·태그)만 있습니다. 설명·재료·원산지·옵션 등 상세 정보가 필요하면 \`get_menu_details(menu_id)\`로 그때 가져오세요.`;

/**
 * Full detail for a single menu — description, ingredients, origin, and the
 * resolved option groups (with options + price deltas). Returned on demand by
 * the get_menu_details tool so this data stays out of the always-on prompt.
 */
export function getMenuDetails(menuId: string): string {
  const m = json.menus.find((x) => x.id === menuId);
  if (!m) return JSON.stringify({ error: "not_found", menu_id: menuId });

  const optionGroups = (m.applicable_option_groups ?? [])
    .map((gid) => json.option_groups.find((g) => g.id === gid))
    .filter((g): g is (typeof json.option_groups)[number] => Boolean(g));

  return JSON.stringify({
    id: m.id,
    name: m.name,
    category: m.category,
    price: m.price,
    discount_price: m.discount_price,
    description: m.description,
    ingredients: m.ingredients,
    origin: m.origin,
    is_hot: m.is_hot,
    tags: m.tags,
    option_groups: optionGroups,
  });
}
