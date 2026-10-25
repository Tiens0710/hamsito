import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

test("the shared core is pinned and has no untracked manual changes", () => {
  const directory = new URL("../vendor/noi-profile-store/", import.meta.url);
  const manifest = JSON.parse(
    fs.readFileSync(new URL("manifest.json", directory), "utf8"),
  );
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  for (const file of manifest.files) {
    const hash = createHash("sha256")
      .update(fs.readFileSync(new URL(file.path, directory)))
      .digest("hex");
    assert.equal(
      hash,
      file.sha256,
      file.path + " must be updated through sync:core",
    );
  }
});
