export type GrammarRules = Record<string, readonly string[]>;

export class MicroGrammar {
  private rules: GrammarRules;
  private recentSelections: Map<string, string[]> = new Map();
  private maxHistory: number;

  constructor(rules: GrammarRules, maxHistory = 3) {
    this.rules = rules;
    this.maxHistory = maxHistory;
  }

  expand(symbol: string): string {
    const raw = this.resolve(symbol);
    return this.postProcess(raw);
  }

  private resolve(text: string): string {
    return text.replace(/#([a-zA-Z0-9_]+)#/g, (_match, token) => {
      const options = this.rules[token];
      if (!options || options.length === 0) return token;

      const history = this.recentSelections.get(token) ?? [];
      const eligible = options.filter((opt) => !history.includes(opt));
      const pool = eligible.length > 0 ? eligible : options;

      const pick = pool[Math.floor(Math.random() * pool.length)];

      history.push(pick);
      if (history.length > this.maxHistory) history.shift();
      this.recentSelections.set(token, history);

      return this.resolve(pick);
    });
  }

  private postProcess(text: string): string {
    let result = text.replace(/\s+/g, " ").trim();
    // Fix "a/an" before vowel sounds
    result = result.replace(/\ba ([aeiouAEIOU])/g, "an $1");
    // Ensure terminal punctuation
    if (!/[.!?]$/.test(result)) {
      result += ".";
    }
    // Capitalize the first letter of each sentence
    result = result.replace(/(^|[.!?]\s+)([a-z])/g, (_match, prefix, letter) => {
      return prefix + letter.toUpperCase();
    });

    return result;
  }

  reset(): void {
    this.recentSelections.clear();
  }
}
