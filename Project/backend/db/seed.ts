import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { closePool } from '../src/db/pool.js';
import { queryRows, withTenantTransaction } from '../src/db/transaction.js';
import type { ManufacturerKey } from '../src/modules/commission/catalog.js';
import { PILOT_RULE_DEFINITIONS } from '../src/modules/commission/pilot.rules.js';
import { hashPassword, normalizePhone } from '../src/modules/auth/password.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const MANUFACTURER_IDS: Record<ManufacturerKey, string> = {
  ALTSHULER: '33333333-3333-4333-8333-333333333331',
  PHOENIX: '33333333-3333-4333-8333-333333333332',
  CLAL: '33333333-3333-4333-8333-333333333333',
  HACHSHARA: '33333333-3333-4333-8333-333333333334',
};

const MANUFACTURERS: Array<{ key: ManufacturerKey; nameHe: string; manufacturerType: 'INVESTMENT_HOUSE' | 'INSURANCE' }> = [
  { key: 'ALTSHULER', nameHe: 'אלטשולר שחם', manufacturerType: 'INVESTMENT_HOUSE' },
  { key: 'PHOENIX', nameHe: 'הפניקס', manufacturerType: 'INSURANCE' },
  { key: 'CLAL', nameHe: 'כלל', manufacturerType: 'INSURANCE' },
  { key: 'HACHSHARA', nameHe: 'הכשרה', manufacturerType: 'INSURANCE' },
];

async function main(): Promise<void> {
  const phone = process.env.PILOT_PHONE;
  const password = process.env.PILOT_PASSWORD;
  if (!phone || !password || password.length < 8) {
    throw new Error('PILOT_PHONE and PILOT_PASSWORD (at least 8 characters) are required');
  }
  const passwordHash = await hashPassword(password);
  const normalizedPhone = normalizePhone(phone);

  await withTenantTransaction(TENANT_ID, async (db) => {
    await db.query(
      `INSERT INTO tenants (id, name, monthly_recruitment_target, annual_recruitment_target)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [TENANT_ID, 'פיילוט'],
    );
    await db.query(
      `INSERT INTO users (id, tenant_id, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash`,
      [USER_ID, TENANT_ID, normalizedPhone, passwordHash],
    );

    for (const manufacturer of MANUFACTURERS) {
      await db.query(
        `INSERT INTO manufacturers (id, tenant_id, name_he, manufacturer_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
           SET name_he = EXCLUDED.name_he, manufacturer_type = EXCLUDED.manufacturer_type`,
        [MANUFACTURER_IDS[manufacturer.key], TENANT_ID, manufacturer.nameHe, manufacturer.manufacturerType],
      );
    }

    const open = await queryRows<{ id: string }>(
      db,
      `SELECT id FROM agreement_versions WHERE valid_to IS NULL ORDER BY valid_from DESC LIMIT 1`,
    );
    let versionId = open[0]?.id;
    if (!versionId) {
      versionId = randomUUID();
      await db.query(
        `INSERT INTO agreement_versions (
           id, tenant_id, valid_from, vat_rate, hq_overhead_rate, partner_split_rate,
           meeting_quota, meeting_cost, vehicle_credit
         ) VALUES ($1, $2, '2020-01-01', 0.18, 0.10, 0.50, 10, 0, 0)`,
        [versionId, TENANT_ID],
      );
    }

    const counts = await queryRows<{ count: number }>(db, `SELECT count(*)::int AS count FROM deals`);
    const dealCount = counts[0]?.count ?? 0;
    if (dealCount === 0) {
      await db.query(`DELETE FROM commission_rules WHERE agreement_version_id = $1`, [versionId]);
      for (const rule of PILOT_RULE_DEFINITIONS) {
        await db.query(
          `INSERT INTO commission_rules (
             id, tenant_id, agreement_version_id, product_type, manufacturer_type, manufacturer_id,
             scope_rate_type, scope_rate_value, annual_cap, ongoing_rate, calculation_base,
             payment_frequency, enters_aum, requires_manual_amount
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10, $11,
             $12, $13, $14
           )`,
          [
            randomUUID(),
            TENANT_ID,
            versionId,
            rule.productType,
            rule.manufacturerType,
            rule.manufacturerKey ? MANUFACTURER_IDS[rule.manufacturerKey] : null,
            rule.scopeRateType,
            rule.scopeRateValue,
            rule.annualCap,
            rule.ongoingRate,
            rule.calculationBase,
            rule.paymentFrequency,
            rule.entersAum,
            rule.requiresManualAmount,
          ],
        );
      }
    }
  });

  console.log('Pilot tenant, user, manufacturers, and appendix B rules are seeded.');
  await closePool();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
