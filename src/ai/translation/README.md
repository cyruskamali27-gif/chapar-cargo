# src/ai/translation — Multilingual Layer
**Purpose:** Every user-facing string and reply works across Persian (primary, RTL), English, Turkish, Arabic.
**Future APIs:** i18n string tables; optional on-the-fly translation for dynamic content.
**Safety:** Direction from language. Wrap numbers/sizes LTR inside RTL. Native review for ar/tr/fr/zh before launch. Don't machine-translate legal/policy blindly.
**Data:** source string/locale, target locale, direction.
**Outputs:** localized strings with correct dir; replies Persian-first.
