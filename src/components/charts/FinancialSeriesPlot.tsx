import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "../../lib/utils";
import {
  ChartTooltip,
  type ChartControls,
  type ChartSeries,
} from "./ChartFrame";

/** Presentation only: each shape receives the very same signed minor-unit rows. */
export default function FinancialSeriesPlot({
  rows,
  hidden,
  kind,
  series,
  currency,
}: ChartControls & { series: ChartSeries[]; currency?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis
          width={85}
          tickFormatter={(amount) => formatCurrency(Number(amount), currency)}
        />
        <Tooltip
          content={<ChartTooltip currency={currency} series={series} />}
        />
        {series.map((item) => {
          const common = {
            dataKey: item.key,
            name: item.name,
            hide: hidden.has(item.key),
            isAnimationActive: false,
          };
          return kind === "bar" ? (
            <Bar key={item.key} {...common} fill={item.color} />
          ) : kind === "line" ? (
            <Line
              key={item.key}
              {...common}
              type="linear"
              stroke={item.color}
              dot={false}
            />
          ) : (
            <Area
              key={item.key}
              {...common}
              type="linear"
              stroke={item.color}
              fill={item.color}
              fillOpacity={0.15}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
