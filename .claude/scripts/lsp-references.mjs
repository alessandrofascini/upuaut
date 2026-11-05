// Usage: node .claude/scripts/lsp-references.mjs <abs-root> <file> <line0> <char0>  -> references (waits 5 s for indexing)
import {spawn} from "node:child_process";
import {readFileSync} from "node:fs";
const [root, file, line, ch] = process.argv.slice(2);
const p = spawn("typescript-language-server", ["--stdio"]);
let buf = Buffer.alloc(0),
  id = 0;
const pending = new Map();
const send = (method, params, isReq = true) => {
  const msg = {jsonrpc: "2.0", method, params};
  if (isReq) msg.id = ++id;
  const s = JSON.stringify(msg);
  p.stdin.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`);
  return isReq ? new Promise((r) => pending.set(msg.id, r)) : null;
};
p.stdout.on("data", (d) => {
  buf = Buffer.concat([buf, d]);
  for (;;) {
    const h = buf.indexOf("\r\n\r\n");
    if (h < 0) return;
    const len = +/Content-Length: (\d+)/.exec(buf.slice(0, h).toString())[1];
    if (buf.length < h + 4 + len) return;
    const m = JSON.parse(buf.slice(h + 4, h + 4 + len).toString());
    buf = buf.slice(h + 4 + len);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m);
  }
});
const uri = `file://${root}/${file}`;
await send("initialize", {
  processId: process.pid,
  rootUri: `file://${root}`,
  capabilities: {},
  initializationOptions: {tsserver: {path: `${root}/node_modules/@typescript/old/lib/tsserver.js`}},
});
send("initialized", {}, false);
send(
  "textDocument/didOpen",
  {
    textDocument: {
      uri,
      languageId: "typescript",
      version: 1,
      text: readFileSync(`${root}/${file}`, "utf8"),
    },
  },
  false,
);
await new Promise((r) => setTimeout(r, 5000));
const refs = await send("textDocument/references", {
  textDocument: {uri},
  position: {line: +line, character: +ch},
  context: {includeDeclaration: false},
});
console.log(
  JSON.stringify(
    (refs.result ?? []).map(
      (r) => r.uri.replace(`file://${root}/`, "") + ":" + (r.range.start.line + 1),
    ),
  ),
);
p.kill();
process.exit(0);
