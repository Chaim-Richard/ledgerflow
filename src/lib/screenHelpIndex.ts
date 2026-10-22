import {
  SCREEN_TABS_REGISTRY,
  REPORT_TABS_REGISTRY,
  SETTINGS_TABS_REGISTRY,
  INTELLIGENCE_TABS_REGISTRY,
  ANALYTICAL_LENSES_REGISTRY,
} from "../config/registry";
import { normalizeSearchText } from "./textNormalization";
export interface ScreenHelpEntry {
  key: string;
  group: string;
  id: string;
  label: string;
  /** the screen's own-names, every registered language */
  labels: string[];
  /** the label in the reader's language; the English one when Hebrew has none */
  labelHe: string;
  help: string;
  /** A-201: the same description in Hebrew; empty when the screen has none yet */
  helpHe: string;
}
export function screenHelpIndex(): ScreenHelpEntry[] {
  const groups = [
    ["Screen", SCREEN_TABS_REGISTRY],
    ["Report", REPORT_TABS_REGISTRY],
    ["Settings", SETTINGS_TABS_REGISTRY],
    ["Intelligence", INTELLIGENCE_TABS_REGISTRY],
    ["Analytical tool", ANALYTICAL_LENSES_REGISTRY],
  ] as const;
  return groups.flatMap(([group, entries]) =>
    entries.map((entry) => ({
      key: `${group}:${entry.id}`,
      group,
      id: entry.id,
      label: entry.label.en,
      labels: Object.values(entry.label),
      labelHe: entry.label.he || entry.label.en,
      help: entry.help,
      helpHe: entry.helpHe || "",
    })),
  );
}
export function searchScreenHelp(
  entries: ScreenHelpEntry[],
  query: string,
): ScreenHelpEntry[] {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    // A-201: Hebrew help is searchable too, so a Hebrew word in a report's description finds it
    const text = normalizeSearchText(
      [entry.label, ...entry.labels, entry.help, entry.helpHe].join(" "),
    );
    return words.every((word) => text.includes(word));
  });
}
export function currentScreenHelp(
  tab: string,
  report: string,
  setting: string,
  intelligence: string,
): ScreenHelpEntry | undefined {
  const entries = screenHelpIndex();
  const group =
    tab === "reports"
      ? "Report"
      : tab === "settings"
        ? "Settings"
        : tab === "intelligence" &&
            ANALYTICAL_LENSES_REGISTRY.some(
              (entry) => entry.id === intelligence,
            )
          ? "Analytical tool"
          : "Screen";
  const id =
    group === "Report"
      ? report
      : group === "Settings"
        ? setting
        : group === "Analytical tool"
          ? intelligence
          : tab;
  return (
    entries.find((entry) => entry.group === group && entry.id === id) ||
    entries.find((entry) => entry.group === "Screen" && entry.id === tab)
  );
}
