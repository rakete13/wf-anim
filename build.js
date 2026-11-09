// Baut den Webflow-Code (Head + Footer) aus wf-anim.js.
// Nutzung: node build.js            → alle Animationen (schreibt nach webflow/)
//          node build.js fade-up,parallax,counter  → nur diese
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ts = require(path.join(execSync('npm root -g').toString().trim(), 'typescript'));

const src = fs.readFileSync(path.join(__dirname, 'src', 'wf-anim.js'), 'utf8');
const arg = process.argv[2];
const used = arg && arg !== 'all' ? new Set(arg.split(',').map((s) => s.trim()).filter(Boolean)) : null;
const outDir = process.argv[3] || path.join(__dirname, 'webflow');

// 1 · Nicht genutzte Blöcke entfernen
const kept = [];
let code = src.replace(/\/\*@block ([\w,-]+)\*\/([\s\S]*?)\/\*@end\*\//g, (_, names, body) => {
  const list = names.split(',');
  const keep = !used || list.some((n) => used.has(n));
  if (keep) kept.push(...list.filter((n) => !used || used.has(n)));
  return keep ? body : '';
});
if (used) {
  const unknown = [...used].filter((n) => !kept.includes(n));
  if (unknown.length) console.warn('Unbekannte Typen ignoriert:', unknown.join(', '));
}

// Lizenzkopf behalten, Rest minimieren
const header = '/*! WF Anim v1.0.0 · ' + (used ? 'Auswahl: ' + kept.join(', ') : 'Vollversion') + ' */';
code = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, removeComments: true },
}).outputText;
code = code
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .join('\n');

// 2 · Benötigte GSAP-Plugins
const plugins = ['ScrollTrigger'];
if (kept.some((n) => n.startsWith('split-') || n === 'text-fill')) plugins.push('SplitText');
if (kept.includes('scramble')) plugins.push('ScrambleTextPlugin');
if (kept.includes('draw-svg')) plugins.push('DrawSVGPlugin');

// 3 · Head-CSS nur für genutzte Typen
const HIDE = {
  'fade-in': '[data-anim="fade-in"]', 'fade-up': '[data-anim="fade-up"]', 'fade-down': '[data-anim="fade-down"]',
  'fade-left': '[data-anim="fade-left"]', 'fade-right': '[data-anim="fade-right"]',
  'scale-in': '[data-anim="scale-in"]', 'blur-in': '[data-anim="blur-in"]',
  'clip-up': '[data-anim="clip-up"]', 'clip-down': '[data-anim="clip-down"]',
  'clip-left': '[data-anim="clip-left"]', 'clip-right': '[data-anim="clip-right"]',
  'stagger': '[data-anim="stagger"]', 'grid-stagger': '[data-anim="grid-stagger"]',
  'split-lines': '[data-anim="split-lines"]', 'split-words': '[data-anim="split-words"]', 'split-chars': '[data-anim="split-chars"]',
  'scramble': '[data-anim="scramble"]', 'text-fill': '[data-anim="text-fill"]', 'counter': '[data-anim="counter"]',
  'draw-svg': '[data-anim="draw-svg"]', 'progress-bar': '[data-anim="progress-bar"]', 'pin': '[data-anim="pin"] [data-anim-item]',
};
let selectors;
if (!used) {
  selectors = [
    '[data-anim^="fade-"]', '[data-anim^="clip-"]', '[data-anim^="split-"]', '[data-anim="scale-in"]', '[data-anim="blur-in"]',
    '[data-anim="stagger"]', '[data-anim="grid-stagger"]', '[data-anim="scramble"]', '[data-anim="text-fill"]',
    '[data-anim="counter"]', '[data-anim="draw-svg"]', '[data-anim="progress-bar"]', '[data-anim="pin"] [data-anim-item]',
  ];
} else {
  selectors = kept.filter((n) => HIDE[n]).map((n) => HIDE[n]);
}
const css = selectors.length ? selectors.map((s) => '.js-anim ' + s).join(',\n') + ' { visibility: hidden; }\n' : '';
const kerning = !used || kept.includes('split-chars') ? '[data-anim="split-chars"] { font-kerning: none; }\n' : '';

const head = `<!-- WF Anim · Head Code -->
<script>
document.documentElement.classList.add('js-anim');
setTimeout(function(){if(!window.WFAnim)document.documentElement.classList.remove('js-anim')},3000);
</script>
${css || kerning ? '<style>\n' + css + kerning + '</style>' : ''}
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
