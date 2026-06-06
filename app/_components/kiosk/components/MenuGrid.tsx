import MenuCard from "./MenuCard";
import { CATEGORIES, menusByCategory, getMenu, type Menu } from "../_menus";

interface Props {
  /** Specific menus to highlight (takes precedence over the active category). */
  displayedMenuIds: string[];
  activeCategory: string | null;
  /** Tapping a card opens its option/confirm modal. */
  onSelectMenu: (id: string) => void;
}

/**
 * The 3-column product grid. Shows the highlighted menus when the AI has set
 * them, otherwise every menu in the active category (defaulting to the first).
 */
const MenuGrid = ({ displayedMenuIds, activeCategory, onSelectMenu }: Props) => {
  const highlighting = displayedMenuIds.length > 0;

  const menus: Menu[] = highlighting
    ? displayedMenuIds.map(getMenu).filter((m): m is Menu => Boolean(m))
    : menusByCategory(activeCategory ?? CATEGORIES[0]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-8">
      <div className="grid grid-cols-3 gap-x-2 gap-y-10">
        {menus.map((menu) => (
          <MenuCard
            key={menu.id}
            menu={menu}
            highlighted={highlighting}
            onClick={() => onSelectMenu(menu.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default MenuGrid;
