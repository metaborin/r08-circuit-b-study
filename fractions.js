/* Explicit textbook fractions. No external fonts, libraries, or automatic slash guessing. */
(() => {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labelText = value => value.replace(/<sup>(.*?)<\/sup>/g, 'の$1乗').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[entity]));

  function group(source, start) {
    if (source[start] !== '{') return null;
    let depth = 1;
    for (let i = start + 1; i < source.length; i++) {
      if (source[i] === '{') depth++;
      if (source[i] === '}' && --depth === 0) return {value:source.slice(start + 1, i), end:i + 1};
    }
    return null;
  }

  function fraction(numerator, denominator) {
    const label = `（${denominator.label}）分の（${numerator.label}）`;
    return {
      html:`<span class="math-fraction" role="math" aria-label="${escape(label)}"><span class="math-numerator" aria-hidden="true">${numerator.html}</span><span class="math-denominator" aria-hidden="true">${denominator.html}</span></span>`,
      label
    };
  }

  function render(value, trustedHTML = false) {
    const source = String(value);
    let cursor = 0, html = '', label = '';
    const append = text => { html += trustedHTML ? text : escape(text); label += trustedHTML ? labelText(text) : text; };
    while (cursor < source.length) {
      const start = source.indexOf('\\frac{', cursor);
      if (start === -1) { append(source.slice(cursor)); break; }
      append(source.slice(cursor, start));
      const numerator = group(source, start + 5);
      const denominator = numerator && group(source, numerator.end);
      if (!denominator) { append(source.slice(start)); break; }
      const result = fraction(render(numerator.value, trustedHTML), render(denominator.value, trustedHTML));
      html += result.html; label += result.label; cursor = denominator.end;
    }
    return {html, label};
  }

  window.StudyMath = Object.freeze({
    text: value => render(value).html,
    // Only authored lesson HTML may use this entry point.
    html: value => render(value, true).html,
    fraction: (numerator, denominator) => fraction(render(numerator), render(denominator)).html
  });
})();
