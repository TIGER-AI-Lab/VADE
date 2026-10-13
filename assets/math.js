/* Preserve TeX before Markdown processing. Single-dollar math requires adjacent
   non-space boundaries and cannot consume the next currency amount or table cell. */
window.VadeMath = {
  normalize(tex) {
    // Common model-output escapes affect typography only; raw answers stay untouched.
    return tex.replace(/(?<!\\)\$(?=[(+-]?\d)/g, '\\$')
      .replace(/\\(text|textbf|textit|textrm|textsf)\{([^{}]*)\}/g,
        (_, command, body) => '\\' + command + '{' + body.replace(/(?<!\\)&/g, '\\&') + '}')
      .replace(/(?<!\\)\\$/, '');
  },
  prepare(text) {
    let marker = '\uE000VADE_MATH_';
    while (text.includes(marker)) marker += '_';
    const formulas = [];
    const pattern = /```[\s\S]*?(?:```|$)|`[^`\n]+`|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|(?<![\\$])\$(?![\s$])((?:\\[^\n]|[^\\$\n`|*])+?)(?<!\s)\$(?![\d$(+−~\-])/g;
    const prepared = text.replace(pattern, (original, bracket, inline, dollars, dollarInline) => {
      if (original.startsWith('`')) return original;
      if (dollarInline !== undefined && !/\\[A-Za-z]/.test(dollarInline)) {
        // Financial prose often contains several dollar signs on the same line.
        // Require a variable or mathematical expression, rather than prose between prices.
        const words = dollarInline.match(/[A-Za-z]+/g) || [];
        const longWords = words.filter(word => word.length > 2 && !/^(sin|cos|tan|log|ln|exp|max|min)$/i.test(word));
        if (longWords.length && !/^[A-Za-z]+$/.test(dollarInline)) return original;
        if (/[;:"!?]/.test(dollarInline)) return original;
        for (const [left, right] of [['(', ')'], ['{', '}'], ['[', ']']]) {
          if (dollarInline.split(left).length !== dollarInline.split(right).length) return original;
        }
      }
      const index = formulas.push({tex: bracket ?? inline ?? dollars ?? dollarInline,
        display: bracket !== undefined || dollars !== undefined, original}) - 1;
      return marker + index + '\uE001';
    });
    return {
      text: prepared,
      render(root) {
        if (!formulas.length) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) if (walker.currentNode.textContent.includes(marker)) nodes.push(walker.currentNode);
        for (const node of nodes) {
          const parts = node.textContent.split(new RegExp(marker + '(\\d+)\uE001', 'g'));
          const fragment = document.createDocumentFragment();
          parts.forEach((part, index) => {
            if (index % 2 === 0) { fragment.append(document.createTextNode(part)); return; }
            const formula = formulas[Number(part)], span = document.createElement('span');
            span.className = formula.display ? 'math-display' : 'math-inline';
            const options = {displayMode: formula.display, trust: false,
              throwOnError: true, strict: false, maxSize: 30, maxExpand: 1000, output: 'htmlAndMathml'};
            try {
              katex.render(formula.tex, span, options);
            } catch (_) {
              try {
                katex.render(window.VadeMath.normalize(formula.tex), span, options);
                span.dataset.texSource = formula.tex;
              } catch (_) {
                // Unrecognized TeX remains readable and available in the raw answer.
                span.classList.add('math-fallback'); span.textContent = formula.original;
              }
            }
            fragment.append(span);
          });
          node.replaceWith(fragment);
        }
      }
    };
  }
};
