import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { reportDateText, reportPeriodText, resolveReportLocale } from '../../lib/reportLocale';

/**
 * A-220: the line under a report's title that says which period the figures cover, written the
 * way the reader's locale writes dates (`Oct 1, 2026 – Oct 31, 2026`, `1 Oct 2026 – 31 Oct 2026`,
 * `1 באוק׳ 2026 – 31 באוק׳ 2026`).
 *
 * The workspace's saved money format decides the locale (so dates and amounts on the same report
 * agree); with none saved, a Hebrew interface reads Hebrew dates. The stored dates and every CSV
 * stay ISO — this is the printed and on-screen label only.
 */
export function ReportPeriodHeading({
  title,
  startDate,
  endDate,
  compareStartDate,
  compareEndDate,
  className,
  as = 'p',
  /** A balance-sheet style header: one date, read as "As of Oct 31, 2026". */
  asOf = false,
}: {
  title?: string;
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
  className?: string;
  as?: 'p' | 'h2' | 'div' | 'span';
  asOf?: boolean;
}) {
  const language = useUIStore(state => state.language);
  const savedLocale = useAuthStore(state => state.getCurrentWorkspace()?.moneyDisplay?.locale);
  const locale = resolveReportLocale({ moneyDisplayLocale: savedLocale, language });
  const period = asOf
    ? `As of ${reportDateText(endDate, locale)}`
    : reportPeriodText(startDate, endDate, locale);
  const comparison =
    compareStartDate && compareEndDate
      ? asOf
        ? reportDateText(compareEndDate, locale)
        : reportPeriodText(compareStartDate, compareEndDate, locale)
      : '';

  const Element = as;
  return (
    <Element
      className={className}
      data-testid="report-period-heading"
      data-report-locale={locale}
      lang={locale}
    >
      {title ? `${title}: ` : ''}
      {period}
      {comparison ? ` · compared with ${comparison}` : ''}
    </Element>
  );
}

export default ReportPeriodHeading;
