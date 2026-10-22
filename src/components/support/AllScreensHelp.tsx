import React, { useState } from "react";
import { screenHelpIndex, searchScreenHelp } from "../../lib/screenHelpIndex";
export default function AllScreensHelp() {
  const [query, setQuery] = useState("");
  const [entries] = useState(screenHelpIndex);
  const rows = searchScreenHelp(entries, query);
  return (
    <section
      aria-label="All screens"
      className="w-full h-full overflow-y-auto p-4 md:p-6 space-y-4"
    >
      <h2 className="text-xl font-semibold">All screens</h2>
      <p>
        Find a screen by its English or Hebrew name, or by words in its help.
        Descriptions explain implemented workflows and their limits.
      </p>
      <label className="block">
        Search screen help{" "}
        <input
          className="block min-h-11 w-full border rounded px-3 bg-[var(--panel)]"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or help text, including Hebrew"
        />
      </label>
      <p role="status">
        {rows.length} of {entries.length} screen descriptions
      </p>
      <ul className="space-y-4">
        {rows.map((entry) => (
          <li
            key={entry.key}
            className="p-4 border rounded-xl bg-[var(--panel)]"
          >
            <h3 className="font-semibold">
              {entry.group}: {entry.label}
            </h3>
            <p>{entry.help}</p>
            {/* A-201: Hebrew readers see the same description without switching screens */}
            {entry.helpHe && (
              <p dir="rtl" lang="he" className="text-sm text-[var(--muted)]">
                {entry.helpHe}
              </p>
            )}
          </li>
        ))}
      </ul>
      {!rows.length && <p>No screen descriptions match these words.</p>}
    </section>
  );
}
