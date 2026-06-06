import { MicrophoneIcon, XMarkIcon } from "@heroicons/react/24/solid";
import {
  getMenu,
  optionGroupsFor,
  unitPrice,
  won,
  type OptionGroup,
} from "../_menus";

interface Props {
  menuId: string;
  /** Currently-selected option labels (live, not yet added to cart). */
  selected: string[];
  onChangeSelection: (labels: string[]) => void;
  onAddToCart: () => void;
  onCheckoutNow: () => void;
  onClose: () => void;
  /** AI's live spoken response, shown as a caption. */
  aiTranscript: string;
  /** Latest user utterance, echoed as the voice prompt bubble. */
  userQuote?: string;
}

const isRequired = (g: OptionGroup) => g.type.includes("required");
const isMulti = (g: OptionGroup) => g.type.startsWith("multi");

/**
 * Voice- AND touch-driven option selection. Chips reflect the live selection
 * (kept in sync with what the AI hears) and can also be tapped manually.
 */
const OptionModal = ({
  menuId,
  selected,
  onChangeSelection,
  onAddToCart,
  onCheckoutNow,
  onClose,
  aiTranscript,
  userQuote,
}: Props) => {
  const menu = getMenu(menuId);
  if (!menu) return null;
  const groups = optionGroupsFor(menu);

  const toggle = (group: OptionGroup, label: string) => {
    const groupLabels = group.options.map((o) => o.label);
    const alreadySelected = selected.includes(label);

    if (isMulti(group)) {
      onChangeSelection(
        alreadySelected ? selected.filter((l) => l !== label) : [...selected, label],
      );
      return;
    }
    // single: replace any other choice from this group
    const withoutGroup = selected.filter((l) => !groupLabels.includes(l));
    if (alreadySelected && !isRequired(group)) {
      onChangeSelection(withoutGroup); // optional single → tap again to clear
    } else {
      onChangeSelection([...withoutGroup, label]);
    }
  };

  const requiredSatisfied = groups
    .filter(isRequired)
    .every((g) => g.options.some((o) => selected.includes(o.label)));

  const price = unitPrice(menu, selected);

  return (
    <div className="absolute inset-0 z-30 bg-black/40 flex items-start justify-center p-6 pt-20">
      <div className="bg-white rounded-[28px] w-full max-w-[880px] shadow-2xl overflow-hidden flex flex-col max-h-[86vh]">
        {/* Header: voice prompt bubble + close */}
        <div className="flex items-center gap-2 px-7 py-5 border-b border-black/5">
          <MicrophoneIcon className="w-7 h-7 text-brand shrink-0" />
          <p className="font-bold text-brand text-[24px] tracking-[-0.6px] truncate flex-1">
            {userQuote ? `"${userQuote}"` : "옵션을 말씀하거나 직접 선택해 주세요"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="옵션 선택 닫기"
            className="shrink-0 w-9 h-9 rounded-full bg-black/5 flex items-center justify-center"
          >
            <XMarkIcon className="w-5 h-5 text-ink/60" />
          </button>
        </div>

        <div className="px-8 py-5 overflow-y-auto">
          <div className="flex items-baseline gap-4 mb-1">
            <h2 className="font-bold text-brand-deep text-[30px] tracking-[-0.8px]">
              {menu.name}
            </h2>
            <span className="text-ink/40 font-bold text-[20px]">옵션 선택 중</span>
          </div>

          {/* AI live caption */}
          {aiTranscript.trim() && (
            <p className="text-ink/60 text-[18px] leading-snug mb-4 min-h-[24px]">
              {aiTranscript}
            </p>
          )}

          <div className="flex flex-col gap-5 mt-2">
            {groups.map((group) => (
              <div key={group.id}>
                <p className="font-bold text-ink text-[20px] mb-2">
                  {group.name}
                  {isRequired(group) && (
                    <span className="text-price text-[15px] ml-2 align-middle">필수</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((opt) => {
                    const on = selected.includes(opt.label);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggle(group, opt.label)}
                        className={`rounded-full px-5 py-2.5 text-[18px] font-medium border-2 transition-colors ${
                          on
                            ? "bg-brand border-brand text-white"
                            : "border-brand/30 text-ink"
                        }`}
                      >
                        {opt.label}
                        {opt.price_delta > 0 && (
                          <span className={on ? "text-white/80 ml-1" : "text-ink/40 ml-1"}>
                            +{won(opt.price_delta)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer: price + actions */}
        <div className="mt-auto border-t border-black/5 px-8 py-5">
          <div className="flex items-center justify-end gap-2 mb-4">
            <span className="text-ink/50 font-bold text-[18px]">합계</span>
            <span className="text-price font-bold text-[28px] leading-none">{won(price)}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={onAddToCart}
              disabled={!requiredSatisfied}
              className="rounded-full border-[3px] border-brand text-brand font-bold text-[24px] py-3.5 disabled:opacity-40"
            >
              장바구니 담기
            </button>
            <button
              type="button"
              onClick={onCheckoutNow}
              disabled={!requiredSatisfied}
              className="rounded-full bg-brand text-white font-bold text-[24px] py-3.5 disabled:opacity-40"
            >
              바로 결제하기
            </button>
          </div>
          {!requiredSatisfied && (
            <p className="text-center text-ink/40 text-[15px] mt-2">
              필수 옵션을 선택해 주세요
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptionModal;
