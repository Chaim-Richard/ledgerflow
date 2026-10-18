import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

test(
  "workspace report harness completes and exits without force-exit flags",
  { timeout: 20000 },
  () => {
    const env = { ...process.env };
    // This is a separate test runner, not a nested worker in the parent's test context.
    delete env.NODE_TEST_CONTEXT;
    const child = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--test",
        "--test-reporter=spec",
        "src/tests/report-failure-ui.test.tsx",
      ],
      {
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
        env,
        timeout: 15000,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      },
    );
    const output = stripVTControlCharacters(`${child.stdout}\n${child.stderr}`);
    assert.equal(child.error, undefined, output);
    assert.equal(child.signal, null, output);
    assert.equal(child.status, 0, output);
    assert.match(output, /tests 2\b/);
    assert.match(output, /pass 2\b/);
    assert.match(output, /cancelled 0\b/);
  },
);
