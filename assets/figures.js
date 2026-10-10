(() => {
  const root = document.documentElement;
  const NS = 'http://www.w3.org/2000/svg';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = t => t * t * (3 - 2 * t);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t;
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const backOut = t => 1 + 2.3 * Math.pow(t - 1, 3) + 1.3 * Math.pow(t - 1, 2);   // settles after a small overshoot
  const linear = t => t;
  const f1 = n => n.toFixed(1);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const make = (name, cls) => {
    const n = document.createElementNS(NS, name);
    if (cls) n.setAttribute('class', cls);
    return n;
  };
  
  function prepare(group, [px, py]) {
    const points = [], lines = [], strokes = [];
    for (const node of [...group.children]) {
      if (node.getAttribute('stroke')) strokes.push({ node, sw: parseFloat(node.getAttribute('stroke-width') || 1) });
      if (node.tagName === 'circle') {
        const x = +node.getAttribute('cx'), y = +node.getAttribute('cy');
        if (Math.hypot(x - px, y - py) < 1 && node.getAttribute('fill') !== 'none') { node.remove(); continue; }
        points.push({ node, d: Math.hypot(x - px, y - py) });
      } else {
        node.setAttribute('pathLength', '1');
        const dashed = node.hasAttribute('stroke-dasharray');   // dotted lines fade in instead of drawing
        if (!dashed) node.style.strokeDasharray = '1 1';
        lines.push({ node, dashed });
      }
    }
    const far = Math.max(1, ...points.map(p => p.d));
    points.forEach(p => { p.d /= far; });
    return { points, lines, strokes, px, py, e: 0, d: 0, on: 0, over: false, lastE: -1, lastD: -1 };
  }
  
  function setStrokeScale(fig, scale, weight = 1) {
    for (const s of fig.strokes) s.node.setAttribute('stroke-width', (s.sw * weight / scale).toFixed(3));
  }
  
  function setBurst(fig, e, over) {
    const key = e + (over ? 2 : 0);
    if (Math.abs(key - fig.lastE) < 1e-3) return;
    fig.lastE = key;
    for (const p of fig.points) {
      const u = clamp((e - 0.55 * p.d) / 0.45);
      const s = over ? backOut(u) : smooth(u);
      p.node.style.opacity = String(Math.min(1, u * 1.5));
      p.node.setAttribute('transform', `translate(${fig.px} ${fig.py}) scale(${s.toFixed(3)}) translate(${-fig.px} ${-fig.py})`);
    }
  }
  
  function setDraw(fig, d) {
    if (Math.abs(d - fig.lastD) < 1e-3) return;
    fig.lastD = d;
    const M = fig.lines.length, w = Math.min(1, 2.2 / M);
    fig.lines.forEach((l, j) => {
      const start = M > 1 ? (1 - w) * j / (M - 1) : 0;
      const t = clamp((d - start) / w);
      if (l.dashed) l.node.style.opacity = String(t);
      else {
        l.node.style.strokeDashoffset = String(1 - t);
        l.node.style.opacity = t > 0 ? '1' : '0';       // a zero-length dash with round caps would show as a dot
      }
    });
  }
  
  function stages() {
    const hero = document.querySelector('.hero-line');
    const section = document.querySelector('.stages');
    const stage = section && section.querySelector('.stage');
    if (!hero || !stage || !window.SVGPathElement) return false;
    const items = [...section.querySelectorAll('.index .list li')];
    const caps = [...stage.querySelectorAll('.cap')];
    const marks = [...stage.querySelectorAll('.marks button')];
    const capsBox = stage.querySelector('.caps'), marksBox = stage.querySelector('.marks');
    const N = items.length;
    if (!N || caps.length !== N) return false;
    const SEG = 1.0;                                   // viewports of scroll for each project
    const SETTLE = 110;                                // ms the scroll must rest on a project before it plays
    const T = { fold: 380, travel: 620, burst: 760, draw: 1400, cap: 420 };
    const field = make('svg', 'field');
    field.setAttribute('aria-hidden', 'true');
    field.setAttribute('focusable', 'false');
    const layer = make('g');
    const person = make('circle', 'person');
    const tag = make('text', 'tag field-tag');
    tag.textContent = 'a person';
    field.append(layer, person, tag);
    document.body.append(field);
    const figs = items.map(li => {
      const g = make('g', 'fig');
      for (const c of [...li.querySelector('.fig').children]) g.append(c.cloneNode(true));
      layer.append(g);
      const fig = prepare(g, JSON.parse(li.dataset.person));
      fig.g = g;
      fig.box = JSON.parse(li.dataset.box);
      setBurst(fig, 0, false);
      setDraw(fig, 0);
      return fig;
    });
    const snaps = items.map(() => {                   // where the page comes to rest: one point per project
      const s = document.createElement('div');
      s.className = 'snap';
      section.append(s);
      return s;
    });
    let W, H, top, segPx, k, homes, heroEnd, raf = 0, shown = false, timer = 0;
    let P = [0, 0], R = 6.5, cur = -1, pendingI = -1, pendingAt = 0;
    const tweens = new Map();
    const tween = (key, from, to, t0, dur, ease, apply) => { tweens.set(key, { from, to, t0, dur, ease, apply }); wake(); };
    
    function coverEnd() {
      const r = hero.getBoundingClientRect();
      const land = r.width >= r.height;
      const pts = JSON.parse(hero.dataset[land ? 'land' : 'port']);
      const [vw, vh] = hero.dataset[land ? 'landBox' : 'portBox'].split(' ').map(Number);
      const s = Math.min(r.width / vw, r.height / vh);
      const [x, y] = pts[pts.length - 1];
      return [(r.width - vw * s) / 2 + x * s, (r.height - vh * s) / 2 + y * s];
    }
    function layout() {
      W = root.clientWidth;
      H = innerHeight;
      field.setAttribute('width', W);
      field.setAttribute('height', H);
      field.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const margin = parseFloat(getComputedStyle(root).getPropertyValue('--margin')) || 64;
      const inset = Math.max(margin, (W - 1440) / 2 + margin);
      const narrow = W < 900;
      // the room the figures get: left of the caption on wide screens; on narrow ones, between the header and the tallest
      // caption, and there each figure stands on the room's floor so it reads with its caption rather than floating above it
      const capTop = narrow ? H - 84 - Math.max(...caps.map(c => c.offsetHeight)) - 32 : 0;
      const box = narrow ? [margin, 88, W - margin, Math.max(H * 0.5, capTop)] : [inset, 104, inset + (W - 2 * inset) * 0.58, H - 112];
      const bw = box[2] - box[0], bh = box[3] - box[1];
      k = Math.min(2.3, ...figs.map(f => Math.min(bw / (f.box[2] - f.box[0]), bh / (f.box[3] - f.box[1]))));
      const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
      homes = figs.map(f => [cx - ((f.box[0] + f.box[2]) / 2 - f.px) * k,
                             narrow ? box[3] - (f.box[3] - f.py) * k : cy - ((f.box[1] + f.box[3]) / 2 - f.py) * k]);
      figs.forEach((f, i) => {
        f.g.setAttribute('transform', `translate(${f1(homes[i][0])} ${f1(homes[i][1])}) scale(${k.toFixed(3)}) translate(${-f.px} ${-f.py})`);
        setStrokeScale(f, k, 1.1);
      });
      top = section.offsetTop;
      segPx = SEG * H;
      section.style.height = `${Math.round(N * segPx + H)}px`;
      snaps.forEach((s, i) => { s.style.top = `${Math.round(i * segPx)}px`; });
      heroEnd = coverEnd();
      if (cur >= 0) { tweens.delete('person'); P = homes[cur]; }
    }
    
    function show(i, now) {
      const prev = cur;
      cur = pendingI = i;
      if (prev >= 0) {
        const f = figs[prev];
        f.over = false;
        tween(`e${prev}`, f.e, 0, now, T.fold, easeIn, v => { f.e = v; });
        tween(`d${prev}`, f.d, 0, now, T.fold * 0.8, easeIn, v => { f.d = v; });
        tween(`c${prev}`, f.on, 0, now, 250, linear, v => { f.on = v; });
      }
      if (i < 0) return;
      const f = figs[i];
      f.over = true;
      const from = P.slice(), to = homes[i];
      const travel = Math.hypot(to[0] - from[0], to[1] - from[1]) > 1 ? T.travel : 0;
      if (travel) tween('person', 0, 1, now + 120, T.travel, easeInOut, t => { P = lerp(from, to, t); });
      const t1 = now + (travel ? 120 + travel * 0.75 : 60);
      tween(`e${i}`, f.e, 1, t1, T.burst, linear, v => { f.e = v; });          // the stagger lives in setBurst
      tween(`d${i}`, f.d, 1, t1 + 420, T.draw, linear, v => { f.d = v; });
      tween(`c${i}`, f.on, 1, t1 + 200, T.cap, easeOut, v => { f.on = v; });
      if (still) {
        tweens.clear();
        P = to.slice();
        f.e = f.d = f.on = 1;
        if (prev >= 0) figs[prev].e = figs[prev].d = figs[prev].on = 0;
      }
    }
    function runTweens(now) {
      let live = false;
      for (const [key, tw] of tweens) {
        const t = clamp((now - tw.t0) / tw.dur);
        tw.apply(tw.from + (tw.to - tw.from) * tw.ease(t));
        if (now - tw.t0 < tw.dur) live = true; else tweens.delete(key);
      }
      return live;
    }
    function frame(now) {
      raf = 0;
      const y = scrollY;
      const p = (y - top) / segPx;
      // 1. On the cover the point is tied to the scroll: it drifts from the line's end to its first place.
      if (y < top) {
        tweens.delete('person');
        const t = still ? 1 : easeOut(clamp(y / top));
        P = y <= 0 ? heroEnd.slice() : lerp(heroEnd, homes[0], t);
        R = 6.5 + (8 * k - 6.5) * t;
      } else R = 8 * k;
      // 2. Which project the scroll rests on. A change plays once the scroll has settled there.
      const want = y < top ? -1 : clamp(Math.floor(p + 1e-6), 0, N - 1);
      if (want !== cur) {
        if (want !== pendingI) { pendingI = want; pendingAt = now; }
        else if (still || now - pendingAt >= SETTLE) show(want, now);
      }
      // 3. The clocks, then the drawing.
      const live = runTweens(now);
      person.setAttribute('cx', f1(P[0]));
      person.setAttribute('cy', f1(P[1]));
      person.setAttribute('r', R.toFixed(2));
      tag.setAttribute('x', f1(P[0] + 16));
      tag.setAttribute('y', f1(P[1] + 5));
      tag.classList.toggle('on', shown && y < H * 0.06);
      figs.forEach((fig, j) => {
        setBurst(fig, fig.e, fig.over);
        setDraw(fig, fig.d);
        const cap = caps[j];
        cap.style.opacity = String(fig.on);
        cap.style.transform = `translateY(${f1((1 - fig.on) * 14)}px)`;
        cap.classList.toggle('on', fig.on > 0.5);
        cap.tabIndex = fig.on > 0.5 ? 0 : -1;
      });
      marks.forEach((m, j) => m.classList.toggle('on', j === cur));
      const past = y - (top + N * segPx);                 // after the last project the field fades out, and with it the
      const fade = past > 0 ? 1 - clamp(past / (0.4 * H)) : 1;   // captions and the marks, which would otherwise ride up the screen
      field.style.opacity = String(fade);
      field.style.transform = past > 0 ? `translateY(${f1(-past)}px)` : '';   // and leaves with its caption, at the page's pace
      capsBox.style.opacity = marksBox.style.opacity = String(fade);
      capsBox.style.visibility = marksBox.style.visibility = fade > 0 ? '' : 'hidden';
      if (live || want !== cur) raf = requestAnimationFrame(frame);
    }
    const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
    function reveal() {                                   // the point appears where the cover line ends
      if (shown) return;
      shown = true;
      person.classList.add('on');
      wake();
    }
    layout();
    P = heroEnd.slice();
    wake();
    const line = hero.querySelector('.land .ink-line, .port .ink-line');
    if (still || scrollY > 0 || !line) reveal();
    else {
      hero.addEventListener('animationend', reveal, { once: true });
      setTimeout(reveal, 7000);                           // in case the animation never reports back
    }
    addEventListener('scroll', () => { if (scrollY > 0) reveal(); wake(); }, { passive: true });
    addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { layout(); wake(); }, 120); });
    marks.forEach((m, j) => m.addEventListener('click', () =>
      scrollTo({ top: top + j * segPx, behavior: still ? 'instant' : 'smooth' })));
    return true;
  }
  
  function progress() {
    const src = document.querySelector('.page-project .p-fig');
    if (!src || !window.SVGPathElement) return false;
    const svg = make('svg', 'progress-fig');
    svg.setAttribute('viewBox', '0 0 412 300');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const g = make('g');
    for (const c of [...src.querySelector('.fig').children]) g.append(c.cloneNode(true));
    svg.append(g);
    document.body.append(svg);
    const [px, py] = JSON.parse(src.dataset.person);
    const fig = prepare(g, [px, py]);
    const person = make('circle', 'person');
    person.setAttribute('cx', px);
    person.setAttribute('cy', py);
    person.setAttribute('r', '8');
    svg.append(person);
    setBurst(fig, 1, false);
    let raf = 0;
    const fit = () => setStrokeScale(fig, Math.max(0.05, svg.getBoundingClientRect().width / 412));
    const open = document.querySelector('.p-open');
    const frame = () => {
      raf = 0;
      setDraw(fig, still ? 1 : clamp(scrollY / Math.max(1, root.scrollHeight - innerHeight)));
      svg.classList.toggle('on', !open || open.getBoundingClientRect().bottom < innerHeight - 60);
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
    fit();
    frame();
    addEventListener('scroll', wake, { passive: true });
    addEventListener('resize', () => { fit(); wake(); });
    return true;
  }
  if (!stages()) root.classList.remove('js-stages');
  progress();
})();
