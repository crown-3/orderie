import menusJson from "@/assets/menus.json";

export interface MenuOption {
  id: string;
  label: string;
  price_delta: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  type: string;
  options: MenuOption[];
}

export interface Menu {
  id: string;
  category: string;
  name: string;
  price: number;
  discount_price?: number;
  description: string;
  ingredients?: string[];
  origin?: string;
  is_hot?: boolean;
  tags?: string[];
  applicable_option_groups?: string[];
}

export const STORE_NAME: string = menusJson.store_name;
export const CATEGORIES: string[] = menusJson.categories;
export const MENUS = menusJson.menus as Menu[];
export const OPTION_GROUPS = menusJson.option_groups as OptionGroup[];

const byId = new Map(MENUS.map((m) => [m.id, m]));
const optionDeltaByLabel = new Map<string, number>();
for (const g of OPTION_GROUPS) {
  for (const o of g.options) optionDeltaByLabel.set(o.label, o.price_delta);
}

export const getMenu = (id: string): Menu | undefined => byId.get(id);

export const menusByCategory = (category: string): Menu[] =>
  MENUS.filter((m) => m.category === category);

/** Base price = discounted price when present, else list price. */
export const basePrice = (m: Menu): number => m.discount_price ?? m.price;

/** Unit price including the price deltas of any confirmed options. */
export const unitPrice = (m: Menu, selectedOptions?: string[]): number =>
  basePrice(m) +
  (selectedOptions ?? []).reduce((sum, label) => sum + (optionDeltaByLabel.get(label) ?? 0), 0);

export const hasOptions = (m: Menu): boolean =>
  (m.applicable_option_groups?.length ?? 0) > 0;

export const optionGroupsFor = (m: Menu): OptionGroup[] =>
  OPTION_GROUPS.filter((g) => m.applicable_option_groups?.includes(g.id));

export const won = (n: number): string => n.toLocaleString("ko-KR");
