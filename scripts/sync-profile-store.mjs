import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const revision = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(revision || ""))
  throw new Error("Pass a full reviewed web commit SHA.");
const repository = "https://github.com/Tiens0710/noi-english-coach";
const parent = path.resolve(os.tmpdir());
const temporary = fs.mkdtempSync(path.join(parent, "noi-core-sync-"));
const target = new URL("../vendor/noi-profile-store/", import.meta.url);
const sources = [
  ["records.mjs", "src/learning/records.mjs"],
  ["supabase.mjs", "src/storage/supabase.mjs"],
  ["profile-merge.mjs", "src/storage/profile-merge.mjs"],
];
try {
  execFileSync(
    "git",
    [
      "clone",
      "--filter=blob:none",
      "--no-checkout",
      "--depth=1",
      repository + ".git",
      temporary,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  execFileSync("git", ["fetch", "--depth=1", "origin", revision], {
    cwd: temporary,
    stdio: ["ignore", "ignore", "inherit"],
  });
  const files = sources.map(([name, sourcePath]) => {
    const content = execFileSync("git", ["show", revision + ":" + sourcePath], {
      cwd: temporary,
    });
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(new URL(name, target), content);
    return {
      path: name,
      sourcePath,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  });
  fs.writeFileSync(
    new URL("manifest.json", target),
    JSON.stringify(
      { sourceRepository: repository, sourceCommit: revision, files },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Pinned learning/storage core to " +
      revision +
      ". Run npm test before committing.",
  );
} finally {
  if (
    path.dirname(path.resolve(temporary)) !== parent ||
    !path.basename(temporary).startsWith("noi-core-sync-")
  )
    throw new Error("Unexpected temporary path.");
  fs.rmSync(temporary, { recursive: true, force: true });
}
