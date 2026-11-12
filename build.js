// Baut den Webflow-Code (Head + Footer) aus wf-anim.js.
// Nutzung: node build.js            → alle Animationen (schreibt nach webflow/)
//          node build.js fade-up,parallax,hover:img-zoom  → nur diese (Hover-Effekte mit "hover:")
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Minifier: esbuild (stark) oder TypeScript (nur Kommentare entfernen) als Rückfall
const tryRequire = (names) => {
  for (const n of names) {
    try {
      return require(n);
    } catch (_) {}
  }
  return null;
};
const globalRoot = (() => {
  try {
    return execSync('npm root -g').toString().trim();
  } catch (_) {
    return '';
  }
})();
const esbuild = tryRequire(['esbuild', path.join(globalRoot, 'esbuild'), '/opt/npm-tools/node_modules/esbuild']);
const ts = esbuild ? null : tryRequire(['typescript', path.join(globalRoot, 'typescript')]);
if (!esbuild && !ts) throw new Error('Weder esbuild noch typescript gefunden: npm i -g esbuild');

const src = fs.readFileSync(path.join(__dirname, 'src', 'wf-anim.js'), 'utf8');
const arg = process.argv[2];
const used = arg && arg !== 'all' ? new Set(arg.split(',').map((s) => s.trim()).filter(Boolean)) : null;
const outDir = process.argv[3] || path.join(__dirname, 'webflow');
fs.mkdirSync(outDir, { recursive: true });

// 1 · Nicht genutzte Blöcke entfernen
const kept = [];
let code = src.replace(/\/\*@block ([\w,:-]+)\*\/([\s\S]*?)\/\*@end\*\//g, (_, names, body) => {
  const list = names.split(',');
  const keep = !used || list.some((n) => used.has(n));
  if (keep) kept.push(...list.filter((n) => !used || used.has(n)));
  return keep ? body : '';
});
if (used) {
  const unknown = [...used].filter((n) => !kept.includes(n));
  if (unknown.length) console.warn('Unbekannte Typen ignoriert:', unknown.join(', '));
}

kept.splice(0, kept.length, ...new Set(kept));

// Lizenzkopf behalten, Rest minimieren
const header = '/*! WF Anim v1.4.0 · ' + (used ? 'Auswahl: ' + kept.join(', ') : 'Vollversion') + ' */';
if (esbuild) {
  code = esbuild.transformSync(code, { minify: true, target: 'es2020', legalComments: 'none' }).code.trim();
} else {
  code = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, removeComments: true },
  }).outputText;
  code = code
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

// 2 · Benötigte GSAP-Plugins
const plugins = ['ScrollTrigger'];
if (kept.some((n) => n.startsWith('split-') || n === 'text-fill')) plugins.push('SplitText');
if (kept.includes('scramble')) plugins.push('ScrambleTextPlugin');
if (kept.includes('draw-svg')) plugins.push('DrawSVGPlugin');

// 3 · Head Code: verhindert Aufblitzen (Intro, Preloader, Akkordeon)
const has = (n) => !used || kept.includes(n);
const preLine = has('preloader')
  ? "\ntry{if(sessionStorage.getItem('wfa-preloaded'))document.documentElement.classList.add('wfa-preloaded')}catch(e){}"
  : '';
const cssLines = ['.js-anim [data-anim-intro]:not([data-anim-intro="false"]) { opacity: 0; }'];
if (has('preloader')) cssLines.push('.js-anim:not(.wfa-preloaded) [data-anim="preloader"] { display: flex !important; }');
if (has('accordion')) cssLines.push('.js-anim [data-accordion-content] { height: 0; overflow: hidden; }');
if (has('split-chars')) cssLines.push('[data-anim="split-chars"] { font-kerning: none; }');
const head = `<!-- WF Anim · Head Code -->
<script>
document.documentElement.classList.add('js-anim');${preLine}
setTimeout(function(){if(!window.WFAnim)document.documentElement.classList.remove('js-anim')},3000);
</script>
<style>
${cssLines.join('\n')}
</style>
`;

const footer = `<!-- WF Anim · Footer Code
     Voraussetzung: Settings → GSAP integration → GSAP aktiv, Plugins: ${plugins.join(', ')} -->
<script>
${header}
${code}
</script>
`;

fs.writeFileSync(path.join(outDir, 'head-code.html'), head);
fs.writeFileSync(path.join(outDir, 'footer-code.html'), footer);
console.log(JSON.stringify({ kept, plugins, headChars: head.length, footerChars: footer.length, total: head.length + footer.length }));
