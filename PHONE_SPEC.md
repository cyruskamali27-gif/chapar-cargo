# CHAPAR — INTERNATIONAL PHONE INPUT

## TASK
Every phone-number field in the app must have a country-code selector
(flag + dial code, e.g. IR +98, CA +1) so users can't enter a wrong/ambiguous format.

## STEPS

### 1) INVENTORY (read-only first)
Find EVERY phone input across the app:
- auth/login: SMS + WhatsApp + Telegram flows in auth.html AND the SPA
- profile page
- traveler forms
- anywhere else
List: file + line number for each.

### 2) BUILD ONE shared component
Location: src/lib/PhoneField.tsx (already exists — upgrade it)
- Country selector: flag + name + dial code, searchable, RTL-correct
- National-number field
- Default country: smart (from user locale or previous value)
- Corridor countries pinned at top: IR, CA, US, GB, DE, FR, TR, AE
- Persian labels throughout

### 3) NORMALIZE to E.164
- Output format: +98912..., +1416... etc.
- Strip leading zeros of national format (0912 -> +98912)
- Show subtle live preview of full number so user sees what will be used
- This must happen BEFORE any backend call (Twilio SMS/WhatsApp, auth flows)

### 4) APPLY everywhere from inventory
- auth.html pages (BACK IT UP first: cp auth.html auth.html.bak)
- SPA components
- Existing stored numbers: if already E.164, display correctly. No data migration.

### 5) VALIDATION
- Block obviously invalid lengths per selected country (cheap check)
- Friendly Persian error messages

### 6) SAFE DEPLOY
- backups before any edit
- own commit(s)
- safe deploy rule: assets + film-preview refs ONLY
- auth.html is a separate static file — back up before editing
- verify: payment untouched, PM2 all online, homepage film intact, new bundle hash

### 7) REPORT
- The full inventory list
- What component was built/changed
- Where it is now applied

## SECURITY CONSTRAINTS (never touch)
- payment/* and homepage film: NEVER TOUCH
- NOTIFY_INTERNAL_SECRET: shared between auth (4300) and orders (4402), localhost only
- Never trust chat_id alone for identity
- Bot webhook changes only within existing bot service

## EXISTING PhoneField.tsx
Already uses react-phone-number-input with:
- international prop (E.164 output)
- defaultCountry=IR
- dir=ltr wrapper
Needs: corridor countries pinned, live preview, per-country validation, Persian errors.

## FILES WITH PHONE REFERENCES (from grep)
- src/lib/PhoneField.tsx (shared component — upgrade this)
- src/app/ChaparFormSimple.tsx
- src/app/SmartTester.tsx
- src/app/i18n.ts
- src/app/SendPackagePage.tsx
- src/app/ProfilePage.tsx (phone is READ-ONLY display, line 324)
- src/app/BuyForMeFlow.tsx
- src/pages/TravelerDepositPage.tsx
- src/pages/ChatPage.tsx
- src/pages/OwnerPaymentPage.tsx
- /var/www/html/auth.html (static file — check separately)
