import fs from "node:fs";

// Input is hidden in a terminal and never placed in process arguments or logs.
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdout.write("Ready for Gemini API key on stdin (input is hidden).\n");
const secret = await new Promise((resolve, reject) => {
  let input = "";
  const onData = chunk => {
    input += chunk.toString("utf8");
    if (input.includes("\u0003")) { reject(new Error("Cancelled")); return; }
    if (/[\r\n]/.test(input)) {
      process.stdin.off("data", onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(input.split(/[\r\n]/)[0].trim());
    }
  };
  process.stdin.on("data", onData);
  process.stdin.on("end", () => resolve(input.trim()));
  process.stdin.resume();
});
if (!/^[A-Za-z0-9_.-]{20,300}$/.test(secret)) throw new Error("API key format was not accepted; no file was changed.");
const file = ".env";
let content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const newline = content.includes("\r\n") ? "\r\n" : "\n";
if (/^[\t ]*GEMINI_API_KEY[\t ]*=/m.test(content)) content = content.replace(/^[\t ]*GEMINI_API_KEY[\t ]*=[^\r\n]*/gm, `GEMINI_API_KEY=${secret}`);
else content += `${content.endsWith("\n") || !content ? "" : newline}GEMINI_API_KEY=${secret}${newline}`;
fs.writeFileSync(file, content, { mode: 0o600 });
process.stdout.write("Gemini API key saved to .env (value hidden).\n");
process.stdin.destroy();
