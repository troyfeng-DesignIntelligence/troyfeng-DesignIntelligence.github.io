(() => {
  const NS = 'http://www.w3.org/2000/svg';
  for (const net of document.querySelectorAll('.net')) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'net-lines');
    svg.setAttribute('aria-hidden', 'true');
    net.prepend(svg);
    const centre = (el, b) => {
      const r = el.getBoundingClientRect();
      return [r.left - b.left + r.width / 2, r.top - b.top + r.height / 2];
    };
    const draw = () => {
      svg.textContent = '';
      const b = net.getBoundingClientRect();
      svg.setAttribute('width', b.width);
      svg.setAttribute('height', b.height);
      svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
      const on = b.width >= 760;
      net.classList.toggle('threaded', on);
      if (!on) return;
      const pins = new Set();
      for (const from of net.querySelectorAll('[data-threads]')) {
        const out = from.querySelector('.pin-out') || from;
        for (const spec of from.dataset.threads.split(/\s+/).filter(Boolean)) {
          const [id, kind = 'solid'] = spec.split('.');
          const to = net.querySelector('#' + id);
          if (!to) continue;
          const inn = to.querySelector('.pin-in') || to;
          const [x1, y1] = centre(out, b), [x2, y2] = centre(inn, b);
          const path = document.createElementNS(NS, 'path');
          const d = Math.abs(x2 - x1) >= Math.abs(y2 - y1)
            ? `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`
            : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
          path.setAttribute('d', d);
          path.setAttribute('class', `thread ${kind}`);
          svg.append(path);
          pins.add(out);
          pins.add(inn);
        }
      }
      for (const pin of pins) {
        const [x, y] = centre(pin, b);
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', x);
        c.setAttribute('cy', y);
        c.setAttribute('r', '3.2');
        c.setAttribute('class', 'pin-dot');
        svg.append(c);
      }
    };
    new ResizeObserver(draw).observe(net);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(draw);
  }
})();
