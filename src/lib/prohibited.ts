// ── Prohibited-goods — the ONE rules source ────────────────────────────────────
// CMD-24: a fixed, rules-based list. Prohibited-goods is NEVER an AI/LLM judgment — it is this
// static list, matched deterministically. Two consumers read it:
//   • SendPackagePage — keyword match against a declared item description.
//   • TravelerRegisterShell (P4) — the categories the traveler must acknowledge they will not carry.
// Previously PROHIBITED_KEYWORDS lived inline in SendPackagePage; extracted here so there is one
// source, not two drifting copies.

// Human-readable categories (fa) for the traveler acknowledgment checklist.
export const PROHIBITED_CATEGORIES: string[] = [
  'مواد مخدر و روان‌گردان',
  'سلاح، مهمات و مواد منفجره',
  'کالای تقلبی و قاچاق',
  'وجه نقد یا اسناد بهادار حامل',
  'مواد اشتعال‌زا و خطرناک',
  'حیوانات زنده و اقلام فاسدشدنی',
];

// Keyword list for text matching (fa + en). Superset of the category list above.
export const PROHIBITED_KEYWORDS: string[] = [
  'مواد مخدر', 'هروئین', 'کوکائین', 'ماری‌جوانا', 'اپیوم', 'متامفتامین',
  'اسلحه', 'سلاح', 'گلوله', 'بمب', 'انفجار', 'مهمات',
  'heroin', 'cocaine', 'marijuana', 'weapon', 'gun', 'bomb', 'explosive', 'ammunition', 'drug',
];
