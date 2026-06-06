export type Tier = 1 | 2 | 3;

// Tier 1: Simple acknowledgments with no AI reasoning needed.
// Responses are pre-scripted, zero API cost, instant playback.
const TIER1: Array<{ match: RegExp; reply: string }> = [
  {
    match: /^(네|예|어|응|맞아요?|좋아요?|알겠어요?|알겠습니다|오케이|ㅇㅋ)[.!~]*$/,
    reply: "네, 알겠습니다!",
  },
  {
    match: /^(아니|아니요|싫어요?|됐어요?|필요\s*없어요?)[.!~]*$/,
    reply: "알겠습니다. 다른 도움이 필요하시면 말씀해 주세요.",
  },
  {
    match: /^(잠깐만?|잠시만?)[.!~]*$/,
    reply: "네, 편하게 말씀해 주세요.",
  },
  {
    match: /^(고마워요?|감사합니다|감사해요?)[.!~]*$/,
    reply: "감사합니다! 또 이용해 주세요.",
  },
];

// Tier 2: Static info queries — no state changes, no menu tool calls needed.
// Handled by gpt-4o-mini text API to save Realtime API TPM.
const TIER2: RegExp[] = [
  /영업.*(시간|언제|몇\s*시)/,
  /와이파이|wifi|wi-fi/i,
  /화장실|restroom/i,
  /포인트|적립|멤버십/,
  /주차/,
  /카드.*되나요?|현금.*되나요?|결제.*방법/,
];

export function routeIntent(transcript: string): { tier: Tier; quickReply?: string } {
  const t = transcript.trim();

  for (const { match, reply } of TIER1) {
    if (match.test(t)) return { tier: 1, quickReply: reply };
  }
  for (const p of TIER2) {
    if (p.test(t)) return { tier: 2 };
  }
  return { tier: 3 };
}
