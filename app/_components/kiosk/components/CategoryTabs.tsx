interface Props {
  categories: string[];
  active: string | null;
  onSelect: (category: string) => void;
}

/**
 * Blue category bar. The active category is a white pill with brand-deep text;
 * the rest are white text on the brand bar.
 */
const CategoryTabs = ({ categories, active, onSelect }: Props) => (
  <nav className="bg-brand w-full px-5 py-3 shrink-0">
    <ul className="grid grid-cols-4 gap-x-2 gap-y-1">
      {categories.map((category) => {
        const selected = category === active;
        return (
          <li key={category}>
            <button
              type="button"
              onClick={() => onSelect(category)}
              className={`w-full rounded-full px-5 py-3 font-bold text-[22px] tracking-[-0.6px] transition-colors ${
                selected ? "bg-white text-brand-deep" : "text-white/95 hover:bg-white/10"
              }`}
            >
              {category}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

export default CategoryTabs;
