export type GateType = "kana" | "meaning" | "reading";

export type KanaItem = {
  char: string;
  romaji: string;
  script: "hiragana" | "katakana";
};

export type GateRow = {
  type: GateType;
  prompt: string;
  options: string[];
  answerIndex: number;
  answer: string;
};
