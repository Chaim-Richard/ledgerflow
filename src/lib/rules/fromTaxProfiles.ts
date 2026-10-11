/**
 * Tax profiles (src/lib/tax/profile.ts) as facts for the rule graph (PLAN §10): a profile's place
 * becomes country / state / county / city / district facts, and each registration a `registration`
 * fact whose evidence is the registration number (still unverified until someone checks it). So the
 * profiles already saved keep working while rules read facts from every dimension. Pure.
 */
import { registrationKey, type TaxProfile, type TaxProfiles } from '../tax/profile';
import type { Fact, FactSources } from './facts';

export function profileFacts(profile: TaxProfile): Fact[] {
  const out: Fact[] = [];
  const place = profile.place;
  if (place) for (const attribute of ['country', 'state', 'county', 'city', 'district'] as const) {
    if (place[attribute]) out.push({ attribute, value: String(place[attribute]), evidence: { kind: 'declared' } });
  }
  if (profile.basis) out.push({ attribute: 'accountingMethod', value: profile.basis, evidence: { kind: 'declared' } });
  for (const r of profile.registrations || []) {
    out.push({ attribute: 'registration', value: registrationKey(r), validFrom: r.validFrom, validTo: r.validTo, evidence: { kind: 'registration', ref: r.number } });
  }
  return out;
}

/** Profiles and any facts kept directly, as one set of fact sources (facts kept directly come first). */
export function factSources(profiles: TaxProfiles | null | undefined, facts?: FactSources | null): FactSources {
  const labels: Record<string, Fact[]> = {};
  for (const [key, profile] of Object.entries(profiles?.labels || {})) labels[key] = profileFacts(profile);
  for (const [key, list] of Object.entries(facts?.labels || {})) labels[key] = [...list, ...(labels[key] || [])];
  return {
    books: [...(facts?.books || []), ...(profiles?.books ? profileFacts(profiles.books) : [])],
    labels,
  };
}
