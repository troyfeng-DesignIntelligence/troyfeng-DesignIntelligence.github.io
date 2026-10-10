(() => {
  const fit = () => document.querySelectorAll('svg rect[data-hl]').forEach((r) => {
    const t = r.nextElementSibling;
    if (!t || !t.getBBox) return;
    const b = t.getBBox();
    r.setAttribute('x', b.x - 2);
    r.setAttribute('width', b.width + 4);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else fit();
})();
