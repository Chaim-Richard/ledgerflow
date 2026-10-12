/** A-39: statutory turnover thresholds as dated entity-period rules over country and activity facts. */
import { REGISTRATION_THRESHOLDS } from '../../tax/registrationThresholds';
import type { Rule } from '../rules';
import { where, type RegistrationThresholdEffect, type TaxRulePack } from './shared';

export function registrationThresholdPack(): TaxRulePack {
  const rules: Array<Rule<RegistrationThresholdEffect>> = REGISTRATION_THRESHOLDS.map(row => ({
    id: row.id,
    name: row.name,
    scope: 'entity-period',
    when: [where('country', row.countryCodes), where('activity', [row.activity.value])],
    combine: 'accumulate',
    effect: {
      kind: 'registration-threshold',
      scheme: row.scheme,
      currency: row.currency,
      thresholdCents: row.thresholdCents,
      activityValue: row.activity.value,
      window: row.window,
      note: row.note,
      ...(row.guidanceUrl ? { guidanceUrl: row.guidanceUrl } : {}),
    },
    validFrom: row.validFrom,
    ...(row.validTo ? { validTo: row.validTo } : {}),
    source: row.source,
    status: 'calculation',
  }));
  return { id: 'registration-thresholds', name: 'Registration and OSS-related turnover thresholds', rules, unmapped: [] };
}
