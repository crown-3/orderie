import { useState } from "react";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface Props {
  /** The user's question (latest STT utterance). */
  question?: string;
  /** The AI's live spoken answer (accumulated transcript). */
  answer: string;
}

/**
 * Inline question + answer block shown above the category tabs while the AI is
 * speaking a response. Collapsible via the 접기 / 펼치기 toggle.
 */
const AnswerPanel = ({ question, answer }: Props) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!answer.trim()) return null;

  return (
    <section className="px-8 pb-2 shrink-0 animate-text-slide-fade-in">
      {question && (
        <p className="font-bold text-brand text-[26px] tracking-[-0.7px] mb-1">
          {question}
        </p>
      )}
      {!collapsed && (
        <p className="font-bold text-brand text-[24px] leading-snug tracking-[-0.6px] max-h-[28vh] overflow-y-auto">
          {answer}
        </p>
      )}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mt-1 mx-auto flex items-center gap-1 text-ink/50 text-[18px] font-medium"
      >
        {collapsed ? (
          <>
            <ChevronDownIcon className="w-5 h-5" /> 펼치기
          </>
        ) : (
          <>
            <ChevronUpIcon className="w-5 h-5" /> 접기
          </>
        )}
      </button>
    </section>
  );
};

export default AnswerPanel;
