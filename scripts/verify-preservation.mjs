import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = {
  "content/_index.md": "2ef19806314f220b863a9068d7f5156315df1470",
  "content/blog/关于特拉克尔.md": "db6b745e131a634b11ece9a255cf1198a9f8ca85",
  "content/blog/随想 一.md": "f33dd9422993c399e83bc79d921bdb8094094b54",
  "static/comments.js": "808563e52f4382c8aafbb84b3d7396217c2a7af1",
  "static/supabase-comments.sql": "c9609cb87afdefd7fb762eb82c2a13dc3c4d3dce",
  "layouts/partials/comments.html": "0b637a283d8cb08169376df92065c65c530693c5"
};
for (const [name, expected] of Object.entries(baseline)) {
  const content = Buffer.from(fs.readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n"));
  const actual = crypto.createHash("sha1").update("blob " + content.length + "\0").update(content).digest("hex");
  assert.equal(actual, expected, "Original file changed: " + name);
}
const config = fs.readFileSync(path.join(root, "hugo.toml"), "utf8");
for (const expected of [
  "baseURL = 'https://hanshui.space/'", "languageCode = 'zh-cn'", "title = '陆寒水的博客'",
  "enableGitInfo = true", 'lastmod = [":git", "lastmod", "date"]',
  "[params.comments]", "enabled = true",
  'supabase_url = "https://cqvcepicdxkklfnumxsw.supabase.co"',
  'supabase_publishable_key = "sb_publishable_CAUT1Vmjl1NVm1s6lTbH1g_Uu76yF5U"',
  "unsafe = true"
]) assert.ok(config.includes(expected), "Original configuration changed: " + expected.split("=")[0]);
for (const name of ["layouts/index.html", "layouts/_default/single.html"]) {
  const content = fs.readFileSync(path.join(root, name), "utf8");
  assert.ok(content.includes('{{ partial "comments.html" . }}'), "Comments missing: " + name);
  assert.ok(content.includes("{{ .Content }}"), "Original content not rendered: " + name);
}
// The keep-alive workflow was intentionally improved on 2026-10-25; it is no
// longer part of the original visual-redesign preservation baseline.
console.log("PASS: all 6 protected content/auth files match the original GitHub blobs; URLs, Git dates, auth and rendering configuration preserved.");
