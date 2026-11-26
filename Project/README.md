# Project

All application code lives in this directory. The product specification stays at the repository root, in [`docs/specification.md`](../docs/specification.md).

כל קוד האפליקציה יישב בתיקייה הזו. האיפיון נשאר בשורש המאגר, בקובץ [`docs/specification.md`](../docs/specification.md).

Nothing under `frontend/` or `backend/` is scaffolded yet. This file only fixes the layout so the boundary is visible before the first line of application code.

The frontend is Next.js, React, and TypeScript. The API is a separate Node.js service on Express and TypeScript. Data access is SQL through `pg` on Neon. Controllers validate with Zod. Vitest covers the commission engine, and Supertest covers the API.

עדיין אין תשתית תחת `frontend/` או `backend/`. הקובץ הזה קובע את המבנה לפני שורת הקוד הראשונה.

הפרונט הוא Next.js עם React ו-TypeScript. ה-API הוא שירות Node.js נפרד על Express ו-TypeScript. הגישה לנתונים היא SQL דרך `pg` על Neon. ה-Controllers מאמתים עם Zod. Vitest מכסה את מנוע העמלות, ו-Supertest מכסה את ה-API.

## Layout

```text
Project/
├── frontend/                         Next.js, React, TypeScript, RTL, mobile-first, PWA
│   └── app/                          screens only: sign-in, dashboard, clients, deals, agreement
└── backend/                          Node.js, Express, TypeScript
    └── src/
        ├── app/                      bootstrap, session cookie, tenant context
        ├── db/                       pg, SQL, transaction sets app.tenant_id
        └── modules/
            ├── auth/
            │   ├── auth.controller.ts
            │   ├── auth.service.ts
            │   └── auth.model.ts
            ├── clients/
            │   ├── clients.controller.ts
            │   ├── clients.service.ts
            │   └── clients.model.ts
            ├── deals/
            ├── dashboard/
            ├── agreements/
            ├── manufacturers/
            └── commission/
                ├── commission.service.ts
                └── commission.rules.ts
```

## Responsibility

| Layer | Owns | Does not own |
| --- | --- | --- |
| Frontend | Hebrew RTL mobile-first screens, PWA, sign-in form | Fee formulas, tenant filtering |
| Controller | HTTP, Zod validation, status codes | Business rules |
| Service | Agreement version, commission math, dashboard totals, fee snapshot, password hashing | SQL and response shaping |
| Model | SQL through `pg`, tenant-scoped queries after `set_config` | VAT waterfall and product rules |

הפרונט מציג. ה-controller מקבל בקשה. ה-service מחשב. ה-model שומר. חישוב עמלה לא נכתב בתוך קומפוננטה.

## Request path

1. The screen calls the API. It does not send `tenant_id`.
2. The controller reads the tenant from the server session and validates the body with Zod.
3. The service loads the agreement version for the relevant date and returns gross fee, net fee, and the rule that produced them.
4. The model writes the deal, including the frozen snapshot, through `pg`. The transaction starts with `set_config('app.tenant_id', ..., true)` before any tenant query.

1. המסך קורא ל-API ולא שולח `tenant_id`.
2. ה-controller קורא את הדייר מהסשן ובודק את הגוף עם Zod.
3. ה-service טוען את גרסת ההסכם לתאריך ומחזיר עמלה ברוטו, עמלה נטו, והכלל שחישב אותן.
4. ה-model שומר את העסקה, כולל הצילום הקפוא, דרך `pg`. הטרנזקציה פותחת ב-`set_config('app.tenant_id', ..., true)` לפני כל שאילתת דייר.

## Modules in the pilot

- `auth` — seeded phone number and password hash, long-lived `HttpOnly` `Secure` session cookie
- `clients` — person, encrypted id number, base book or partnership recruitment
- `deals` — expectation, absorption, reconciliation status, note
- `commission` — pure calculation, covered by Vitest before the screens exist
- `dashboard` — month and year totals from frozen deal numbers
- `agreements` — a new version closes the previous one and never rewrites absorbed deals
- `manufacturers` — closed list, so exceptions such as הפניקס, כלל, הכשרה, and אלטשולר match a rule

`meetings` and `financial_events` stay in the specification until the clawback phase. They do not get folders in the pilot scaffold.
