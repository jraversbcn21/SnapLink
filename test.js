// Run: node test.js
// Loads content.js with stubbed browser globals and checks its pure logic.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function load(href, doc) {
  const url = new URL(href);
  const src = fs.readFileSync(__dirname + "/content.js", "utf8")
    .replace(/\}\)\(\);\s*$/, "globalThis.__t = { cleanUrl, cleanAppSuffix, extractTitle };\n})();");
  const ctx = {
    URL,
    window: { location: url },
    document: Object.assign({ title: "", querySelector: () => null, querySelectorAll: () => [] }, doc),
    chrome: { runtime: { onMessage: { addListener() {} } } }
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(src, ctx);
  return ctx.__t;
}

// cleanUrl: strips tracking params, keeps the rest
const t = load("https://a.com/");
assert.strictEqual(t.cleanUrl("https://a.com/p?id=3&utm_source=x&fbclid=1#h"), "https://a.com/p?id=3#h");
assert.strictEqual(t.cleanUrl("https://a.com/p?utm_a=1&gclid=2"), "https://a.com/p");
assert.strictEqual(t.cleanUrl("not a url"), "not a url");

// cleanAppSuffix: known app and short suffix are removed, long ones kept
assert.strictEqual(t.cleanAppSuffix("Fix login bug - Jira"), "Fix login bug");
assert.strictEqual(t.cleanAppSuffix("Post title — My Blog"), "Post title");
assert.strictEqual(t.cleanAppSuffix("A - B - C"), "A - B - C");

// extractTitle: og:title wins over h1 and document.title on a generic site
const og = { content: " OG Title " };
const h1 = { textContent: "Heading" };
const withOg = load("https://x.com/a?utm_medium=z", {
  title: "Doc title - X",
  querySelector: (s) => (s.includes("og:title") ? og : s === "h1" ? h1 : null)
}).extractTitle();
assert.deepStrictEqual([withOg.title, withOg.source, withOg.url], ["OG Title", "og:title", "https://x.com/a"]);

const noOg = load("https://x.com/", {
  title: "Doc title - X",
  querySelector: (s) => (s === "h1" ? h1 : null)
}).extractTitle();
assert.deepStrictEqual([noOg.title, noOg.source], ["Heading", "h1"]);

const onlyDoc = load("https://x.com/", { title: "Doc title - X" }).extractTitle();
assert.deepStrictEqual([onlyDoc.title, onlyDoc.source], ["Doc title", "document.title"]);

// Double-injection guard: second run on the same page registers no listener
let listeners = 0;
const page = {
  URL,
  window: { location: new URL("https://x.com/") },
  document: { title: "", querySelector: () => null, querySelectorAll: () => [] },
  chrome: { runtime: { onMessage: { addListener() { listeners++; } } } }
};
const raw = fs.readFileSync(__dirname + "/content.js", "utf8");
vm.runInNewContext(raw, page);
vm.runInNewContext(raw, page);
assert.strictEqual(listeners, 1);

// Platform hostname globs still match (precompiled regexes)
const jira = load("https://acme.atlassian.net/browse/AB-1", {
  querySelectorAll: (s) => (s === "h1" ? [{ textContent: "Jira issue" }] : [])
}).extractTitle();
assert.deepStrictEqual([jira.platform, jira.title], ["Jira", "Jira issue"]);
const gl = load("https://gitlab.com/g/p/-/issues/1", {
  querySelectorAll: (s) => (s === "h1.title" ? [{ textContent: "GL issue" }] : [])
}).extractTitle();
assert.deepStrictEqual([gl.platform, gl.title], ["GitLab", "GL issue"]);

console.log("all tests passed");
