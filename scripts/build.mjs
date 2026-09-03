import { readFileSync, writeFileSync } from "node:fs";
import esbuild from "esbuild";
import prettier from "prettier";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// Single source of truth for the version: package.json. Injected into the metadata header at
// build time so @version can never drift out of sync.
const banner = `// ==UserScript==
// @name         Celeritas
// @namespace    celeritas
// @version      ${pkg.version}
// @description  On the Roche Limit.
// @author       LyCecilion
// @match        https://xk.xidian.edu.cn/xsxk/elective/grablessons*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
`;

await esbuild.build({
    entryPoints: ["src/main.js"],
    bundle: true,
    format: "iife",
    target: "es2020",
    outfile: "celeritas.user.js",
    banner: { js: banner },
    legalComments: "none",
    logLevel: "info",
});

// Format the artifact with Prettier so builds stay readable and diffs stay stable
const out = readFileSync("celeritas.user.js", "utf8");
const formatted = await prettier.format(out, { filepath: "celeritas.user.js" });
writeFileSync("celeritas.user.js", formatted);
