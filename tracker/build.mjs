/* Wraps app.html (the Artifact-ready fragment) into a standalone index.html.
   The <head> here mirrors the reset the Claude artifact viewer injects, so the
   hosted page and the published Artifact render identically.
   Run: node tracker/build.mjs                                              */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const body = readFileSync(join(here, "app.html"), "utf8");
const title = (body.match(/<title>([\s\S]*?)<\/title>/) || [, "Fuel &amp; Frame"])[1];

writeFileSync(join(here, "index.html"), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Diet, training and supplement tracker built around a five-day calisthenics-and-barbell programme.">
<title>${title}</title>
<style>:root{color-scheme:light}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#faf9f7}
img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`);
console.log("wrote tracker/index.html");
