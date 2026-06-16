import MenuCard from "./MenuCard";
import { CATEGORIES, menusByCategory, type Menu } from "../_menus";

interface Props {
  activeCategory: string | null;
  /** Tapping a card opens its option/confirm modal. */
  onSelectMenu: (id: string) => void;
}

const MenuGrid = ({ activeCategory, onSelectMenu }: Props) => {
  const menus: Menu[] = menusByCategory(activeCategory ?? CATEGORIES[0]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-8">
      <div className="grid grid-cols-3 gap-x-2 gap-y-10">
        {menus.map((menu) => (
          <MenuCard
            key={menu.id}
            menu={menu}
            highlighted={false}
            onClick={() => onSelectMenu(menu.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default MenuGrid;
