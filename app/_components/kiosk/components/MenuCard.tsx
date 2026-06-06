import Image, { StaticImageData } from "next/image";
import { type Menu, basePrice, hasOptions, won } from "../_menus";

interface Props {
  menu: Menu;
  /** Optional real product photo; falls back to a tasteful placeholder circle. */
  imageSrc?: StaticImageData;
  highlighted?: boolean;
  onClick?: () => void;
}

// Deterministic pastel from the menu id so each placeholder circle is stable.
const placeholderColor = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 45% 92%)`;
};

const MenuCard = ({ menu, imageSrc, highlighted = false, onClick }: Props) => {
  const price = basePrice(menu);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-start gap-3 w-full text-left active:scale-[0.97] transition-transform"
    >
      <div
        className={`relative rounded-full overflow-hidden aspect-square w-[78%] max-w-[220px] ${
          highlighted ? "ring-4 ring-brand/60" : ""
        }`}
        style={imageSrc ? undefined : { backgroundColor: placeholderColor(menu.id) }}
      >
        {imageSrc && (
          <Image src={imageSrc} alt={menu.name} fill className="object-cover" />
        )}
      </div>
      <p className="text-center font-medium text-ink text-[22px] tracking-[-0.6px] leading-tight px-1 line-clamp-2">
        {menu.name}
      </p>
      <p className="text-center font-bold text-price text-[30px] tracking-[-0.8px] leading-none">
        {won(price)}
        {hasOptions(menu) ? "~" : ""}
      </p>
    </button>
  );
};

export default MenuCard;
