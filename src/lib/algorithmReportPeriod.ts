import type { AlgoInput, AlgorithmDefinition } from './algorithms/types';

type ParameterValue = AlgoInput['defaultValue'];
type DateRangeValue = Extract<AlgoInput, { kind: 'dateRange' }>['defaultValue'];

export interface AlgorithmReportPeriod {
  asOfDate: string;
  period: { start: string; end: string };
  /** The same period the workbook header and the algorithm results use. */
  label: string;
}

/**
 * C-87: one effective period for the algorithm preview and its exported workbook. A selected
 * date range is authoritative; otherwise the preview runs through the selected as-of date.
 */
export function algorithmReportPeriod(
  algorithm: Pick<AlgorithmDefinition, 'inputs'>,
  params: Record<string, ParameterValue>,
  today: string,
): AlgorithmReportPeriod {
  const asOfDate = (params.asOfDate as string | undefined) || today;
  const rangeInput = algorithm.inputs.find(input => input.kind === 'dateRange');
  const range = rangeInput ? params[rangeInput.key] as DateRangeValue | undefined : undefined;
  const hasRange = Boolean(range?.start && range?.end);
  const period = hasRange
    ? { start: range!.start, end: range!.end }
    : { start: '1970-01-01', end: asOfDate };
  return {
    asOfDate,
    period,
    label: hasRange ? `${period.start} to ${period.end}` : `Through ${period.end}`,
  };
}
