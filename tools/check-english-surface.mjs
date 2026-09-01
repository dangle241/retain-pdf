#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

const hanPattern = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{20000}-\u{2EBEF}]/u;
const mojibakePattern = /(?:\uFFFD|â†|â€|â€¦|â€”|â€“)/u;
const docExts = new Set([".md", ".txt"]);
const frontendExts = new Set([".ts", ".tsx", ".js", ".jsx"]);
const generatedPrefixes = [
  "frontend/dist/",
  "frontend/.cache/",
  "frontend/vendor/",
  "frontend/node_modules/",
  "frontend-react/dist/",
  "backend/workspace/",
  "wiki/",
];

function posixPath(value) {
  return value.split(path.sep).join("/");
}

function loadAllowlist() {
  const file = path.join(root, "tools", "translation-english-allowlist.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const allowlist = loadAllowlist();

function isAllowed(rel, text = "") {
  return allowlist.some((entry) => {
    if (entry.text && entry.text !== text) return false;
    if (entry.path.endsWith("/")) return rel.startsWith(entry.path);
    return rel === entry.path;
  });
}

function listTrackedFiles() {
  const out = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll("\\", "/"));
}

function markdownFenceBalanced(text) {
  const fenceLines = text.match(/^```/gm);
  return !fenceLines || fenceLines.length % 2 === 0;
}

function addIssue(issues, issue) {
  if (!isAllowed(issue.path, issue.text)) issues.push(issue);
}

function scanDocument(rel, issues) {
  if (generatedPrefixes.some((prefix) => rel.startsWith(prefix))) return;
  if (isAllowed(rel)) return;
  const abs = path.join(root, rel);
  const text = fs.readFileSync(abs, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    if (hanPattern.test(lineText)) {
      addIssue(issues, {
        kind: "doc-han",
        path: rel,
        line: idx + 1,
        column: lineText.search(hanPattern) + 1,
        text: lineText.trim(),
      });
    }
    if (mojibakePattern.test(lineText)) {
      addIssue(issues, {
        kind: "mojibake",
        path: rel,
        line: idx + 1,
        column: lineText.search(mojibakePattern) + 1,
        text: lineText.trim(),
      });
    }
  });
  if (rel.endsWith(".md") && !markdownFenceBalanced(text)) {
    addIssue(issues, {
      kind: "markdown-fence",
      path: rel,
      line: 1,
      column: 1,
      text: "Unbalanced fenced code block markers.",
    });
  }
}

function codeWithoutComments(text) {
  let out = "";
  let state = "code";
  let quote = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1] || "";
    if (state === "line-comment") {
      out += ch === "\n" ? "\n" : " ";
      if (ch === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      out += ch === "\n" ? "\n" : " ";
      if (ch === "*" && next === "/") {
        out += " ";
        i += 1;
        state = "code";
      }
      continue;
    }
    if (state === "string") {
      out += ch;
      if (ch === "\\") {
        out += next;
        i += 1;
      } else if (ch === quote) {
        state = "code";
      }
      continue;
    }
    if (ch === "/" && next === "/") {
      out += "  ";
      i += 1;
      state = "line-comment";
      continue;
    }
    if (ch === "/" && next === "*") {
      out += "  ";
      i += 1;
      state = "block-comment";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      state = "string";
    }
    out += ch;
  }
  return out;
}

function scanFrontend(rel, issues) {
  if (generatedPrefixes.some((prefix) => rel.startsWith(prefix))) return;
  if (isAllowed(rel)) return;
  const abs = path.join(root, rel);
  const original = fs.readFileSync(abs, "utf8");
  const text = codeWithoutComments(original);
  const originalLines = original.split(/\r?\n/);
  const lines = text.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    const originalTrimmed = (originalLines[idx] || "").trimStart();
    if (
      originalTrimmed.startsWith("//") ||
      originalTrimmed.startsWith("/*") ||
      originalTrimmed.startsWith("*") ||
      originalTrimmed.startsWith("*/")
    ) {
      return;
    }
    if (hanPattern.test(lineText) || mojibakePattern.test(lineText)) {
      addIssue(issues, {
        kind: hanPattern.test(lineText) ? "frontend-han" : "mojibake",
        path: rel,
        line: idx + 1,
        column: Math.max(1, lineText.search(hanPattern.test(lineText) ? hanPattern : mojibakePattern) + 1),
        text: lineText.trim().replace(/\s+/g, " "),
      });
    }
  });
}

const issues = [];
for (const rel of listTrackedFiles()) {
  const ext = path.extname(rel).toLowerCase();
  if (docExts.has(ext)) scanDocument(rel, issues);
  if ((rel.startsWith("frontend/src/") || rel.startsWith("frontend-react/src/")) && frontendExts.has(ext)) {
    scanFrontend(rel, issues);
  }
}

if (issues.length) {
  console.error(`English surface check failed with ${issues.length} issue(s):`);
  const limit = Number.parseInt(process.env.ENGLISH_SURFACE_LIMIT || "200", 10);
  for (const issue of issues.slice(0, limit)) {
    console.error(`${issue.kind}: ${issue.path}:${issue.line}:${issue.column}: ${issue.text}`);
  }
  if (issues.length > limit) console.error(`... ${issues.length - limit} more issue(s) omitted`);
  process.exit(1);
}

console.log("English surface check passed.");
