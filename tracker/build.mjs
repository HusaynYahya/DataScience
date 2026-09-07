/* Wraps app.html (the Artifact-ready fragment) into a standalone index.html.
   The <head> here mirrors the reset the Claude artifact viewer injects, so the
   hosted page and the published Artifact render identically — plus the bits an
   Artifact can't carry: the manifest, the icons and the service worker that
   make the hosted copy installable and usable offline.
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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Diet, training and supplement tracker built around a five-day calisthenics-and-barbell programme.">
<title>${title}</title>

<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#EFEFE9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101310" media="(prefers-color-scheme: dark)">
<link rel="icon" href="icons/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Fuel &amp; Frame">

<style>:root{color-scheme:light}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#faf9f7}
img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
<script>
/* offline shell — only where a service worker is allowed to run */
if("serviceWorker" in navigator && location.protocol !== "file:")
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{}));
</script>
</body>
</html>
`);
console.log("wrote tracker/index.html");
