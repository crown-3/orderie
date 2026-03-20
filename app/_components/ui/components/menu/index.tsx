import { PlusIcon } from "@heroicons/react/20/solid";
import Image, { StaticImageData } from "next/image";

interface Props {
  isWithCount?: boolean;
  count?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  name: string;
  description: string;
  menuImage: StaticImageData;
  isDiscounted?: boolean;
  originalPrice?: number;
  price: number;
}

const Menu = ({
  isWithCount,
  count,
  onIncrement,
  onDecrement,
  name,
  description,
  menuImage,
  isDiscounted,
  originalPrice,
  price,
}: Props) => {
  return (
    <ol className="bg-[#121212] p-5 rounded-[20px] flex items-center justify-between w-full">
      <div className="flex items-center gap-5">
        <Image
          src={menuImage}
          alt="메뉴 이미지"
          className="w-[80px] h-[80px] rounded-lg"
        />

        <div>
          <h3 className="text-[#fff] font-bold text-2xl leading-tight mb-1">
            {name}
          </h3>
          <p className="text-[#A7A7A7] font-medium text-lg leading-tight">
            {description}
          </p>
        </div>
      </div>

      <div className="relative flex items-center justify-end">
        <div className="flex flex-col items-end">
          {isDiscounted && (
            <p className="text-[#A7A7A7] text-2xl font-bold line-through">
              {originalPrice?.toLocaleString("ko-KR")}
            </p>
          )}
          <p className="text-[#FF3030] text-4xl font-bold">
            {price.toLocaleString("ko-KR")}
          </p>
        </div>

        {isWithCount && (
          <div className="absolute right-[200px]">
            <div className="relative flex items-center justify-center text-[#fff] w-[120px]">
              <button className="absolute left-0 px-1" onClick={onDecrement}>
                <div className="w-5 h-[2px] bg-[#fff]" />
              </button>

              <p className="text-4xl font-bold">{count}</p>

              <button className="absolute right-0" onClick={onIncrement}>
                <PlusIcon className="text-[#fff] w-8" />
              </button>
            </div>
          </div>
        )}
      </div>
    </ol>
  );
};

export default Menu;
