/**
 * A-110: the rule linter. Every `Rule` in the graph must be able to say who it is, when it started,
 * on whose authority it was read, and how far it has been checked — a rule missing any of these is a
 * row nobody can audit, so the packs are linted and the check fails loudly (in `npm test`, and by
 * hand through `npm run lint:rule-packs`) rather than shipping a rule with no source.
 *
 * What this is: a shape check over the rules this lane writes. What it is not: a tax opinion — it
 * never reads a rate, never decides a period and never calls a source. A problem here is a bug in a
 * pack, and the fix is in the pack.
 *
 * Pure: no storage, no fetching, no clock.
 */
import type { Rule } from './rules';

export type RuleLintField =
  | 'id' | 'name' | 'scope' | 'when'
  | 'validFrom' | 'validTo'
  | 'source' | 'status'
  | 'targets' | 'duplicate-id' | 'shape';

export interface RuleLintProblem {
  /** the pack the rule came from, when the caller names it */
  pack?: string;
  /** the rule's id, when it has one to quote */
  rule?: string;
  field: RuleLintField;
  problem: string;
}

/** The statuses a rule may carry (src/lib/rules/rules.ts). */
export const RULE_STATUSES = ['calculation', 'reviewed', 'filing-ready'] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: unknown): value is string => typeof value === 'string' && YMD.test(value);

/** Anything is inspectable: a partially built object from a bad pack is exactly what this catches. */
type Lintable = Partial<Rule<unknown>>;

export interface LintRulesOptions {
  /** the pack id, put on every problem so a report can group by pack */
  pack?: string;
  /**
   * true (the default for this lane): every rule must carry status 'calculation'. False lints a rule
   * written by another lane that is allowed to say 'reviewed' or 'filing-ready'.
   */
  requireCalculationStatus?: boolean;
}

/** One rule's problems, in the order a reader wants them. */
export function lintRule(rule: Lintable, options: LintRulesOptions = {}): RuleLintProblem[] {
  const problems: RuleLintProblem[] = [];
  const at = (field: RuleLintField, problem: string) => problems.push({ ...(options.pack ? { pack: options.pack } : {}), ...(typeof rule.id === 'string' && rule.id ? { rule: rule.id } : {}), field, problem });

  if (typeof rule.id !== 'string' || !rule.id.trim()) at('id', 'the rule needs an id');
  if (typeof rule.name !== 'string' || !rule.name.trim()) at('name', 'the rule needs a name');
  if (rule.scope !== 'line' && rule.scope !== 'document' && rule.scope !== 'entity-period') {
    at('scope', `scope is ${String(rule.scope)}, not line, document or entity-period`);
  }
  if (!Array.isArray(rule.when) || rule.when.length === 0) {
    at('when', 'a rule without conditions would apply to everything');
  }
  if (!isDate(rule.validFrom)) at('validFrom', 'the rule needs a validFrom date (YYYY-MM-DD)');
  if (rule.validTo !== undefined && !isDate(rule.validTo)) at('validTo', 'validTo must be a date (YYYY-MM-DD)');
  if (isDate(rule.validFrom) && isDate(rule.validTo) && rule.validTo < rule.validFrom) {
    at('validTo', 'validTo is before validFrom');
  }

  const source = rule.source as Rule<unknown>['source'] | undefined;
  if (!source || typeof source !== 'object') {
    at('source', 'the rule needs a source (authority and url)');
  } else {
    if (typeof source.authority !== 'string' || !source.authority.trim()) at('source', 'the source needs an authority');
    if (typeof source.url !== 'string' || !source.url.startsWith('https://')) at('source', 'the source needs an https url');
    if (source.retrieved !== undefined && !isDate(source.retrieved)) at('source', 'retrieved must be a date (YYYY-MM-DD)');
  }

  if (!RULE_STATUSES.includes(rule.status as RuleStatus)) {
    at('status', `status is ${String(rule.status)}; it must be one of ${RULE_STATUSES.join(', ')}`);
  } else if (options.requireCalculationStatus !== false && rule.status !== 'calculation') {
    at('status', `status is ${rule.status}, this lane writes 'calculation'`);
  }

  if (rule.combine !== 'accumulate' && rule.combine !== 'override' && rule.combine !== 'exclude') {
    at('shape', `combine is ${String(rule.combine)}, not accumulate, override or exclude`);
  }
  if ((rule.combine === 'override' || rule.combine === 'exclude') && (!Array.isArray(rule.targets) || rule.targets.length === 0)) {
    at('targets', `a rule that ${rule.combine}s must name what it ${rule.combine === 'override' ? 'replaces' : 'switches off'}`);
  }
  if (rule.effect === undefined || rule.effect === null) at('shape', 'the rule needs an effect');
  return problems;
}

/**
 * Every problem in a list of rules: the per-rule shape above, then the ids (an id is how every other
 * rule, screen and test names this rule, so a repeated one is a real defect) and the targets (a
 * target no rule defines is a rule that will never do what its source says).
 */
export function lintRules(rules: Lintable[], options: LintRulesOptions = {}): RuleLintProblem[] {
  const problems: RuleLintProblem[] = [];
  const seen = new Map<string, Lintable>();
  for (const rule of rules) {
    problems.push(...lintRule(rule, options));
    if (typeof rule.id === 'string' && rule.id.trim()) {
      const first = seen.get(rule.id);
      if (first) {
        problems.push({ ...(options.pack ? { pack: options.pack } : {}), rule: rule.id, field: 'duplicate-id', problem: 'duplicate rule id' });
      } else {
        seen.set(rule.id, rule);
      }
    }
  }
  for (const rule of rules) {
    if (!Array.isArray(rule.targets)) continue;
    for (const target of rule.targets) {
      if (!seen.has(target)) {
        problems.push({ ...(options.pack ? { pack: options.pack } : {}), rule: String(rule.id), field: 'targets', problem: `targets ${target}, which no rule defines` });
      }
    }
  }
  return problems;
}

/** One line per problem, for a script's output or a screen. */
export function ruleLintLines(problems: RuleLintProblem[]): string[] {
  return problems.map(p => `${p.pack ? `${p.pack}: ` : ''}${p.rule ? `${p.rule}: ` : ''}${p.field}: ${p.problem}`);
}

/** A short summary a script prints: how many rules were checked and how many problems were found. */
export function ruleLintSummary(rules: Lintable[], problems: RuleLintProblem[]): string {
  return `${rules.length} rule(s) checked, ${problems.length} problem(s)`;
}
