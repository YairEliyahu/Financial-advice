# Project

All application code lives in this directory. The product specification stays at the repository root, in [`docs/specification.md`](../docs/specification.md).

כל קוד האפליקציה יישב בתיקייה הזו. האיפיון נשאר בשורש המאגר, בקובץ [`docs/specification.md`](../docs/specification.md).

Nothing under `frontend/` or `backend/` is scaffolded yet. This file only fixes the layout so the boundary is visible before the first line of application code.

עדיין אין תשתית תחת `frontend/` או `backend/`. הקובץ הזה קובע את המבנה לפני שורת הקוד הראשונה.

## Layout

```text
Project/
├── frontend/                         Next.js UI, RTL, PWA
│   └── app/                          screens only: dashboard, clients, deals, agreement
└── backend/
    └── src/
        ├── app/                      process bootstrap, auth, tenant context
        └── modules/
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
| Frontend | Hebrew screens, forms, PWA | Fee formulas, tenant filtering |
| Controller | HTTP, validation, status codes | Business rules |
| Service | Agreement version, commission math, dashboard totals, fee snapshot | SQL and response shaping |
| Model | Persistence and tenant-scoped queries | VAT waterfall and product rules |

הפרונט מציג. ה-controller מקבל בקשה. ה-service מחשב. ה-model שומר. חישוב עמלה לא נכתב בתוך קומפוננטה.

## Request path

1. The screen calls the API. It does not send `tenant_id`.
2. The controller reads the tenant from the server session and validates the body.
3. The service loads the agreement version for the relevant date and returns gross fee, net fee, and the rule that produced them.
4. The model writes the deal, including the frozen snapshot, inside a transaction that sets the tenant for row-level security.

1. המסך קורא ל-API ולא שולח `tenant_id`.
2. ה-controller קורא את הדייר מהסשן ובודק את הגוף.
3. ה-service טוען את גרסת ההסכם לתאריך ומחזיר עמלה ברוטו, עמלה נטו, והכלל שחישב אותן.
4. ה-model שומר את העסקה, כולל הצילום הקפוא, בתוך טרנזקציה שמגדירה את הדייר ל-RLS.

## Modules in the pilot

- `clients` — person, encrypted id number, base book or partnership recruitment
- `deals` — expectation, absorption, reconciliation status, note
- `commission` — pure calculation, covered by unit tests before the screens exist
- `dashboard` — month and year totals from frozen deal numbers
- `agreements` — a new version closes the previous one and never rewrites absorbed deals
- `manufacturers` — closed list, so exceptions such as הפניקס, כלל, הכשרה, and אלטשולר match a rule

`meetings` and `financial_events` stay in the specification until the clawback phase. They do not get folders in the pilot scaffold.
