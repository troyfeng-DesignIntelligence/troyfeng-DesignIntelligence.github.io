(() => {
  const toc = document.querySelector('nav.toc');
  if (!toc) return;
  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const acts = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1))));
  if (acts.some(s => !s) || acts.length < 2) return;
  const chip = document.createElement('div');
  chip.className = 'toc-now';
  const list = document.createElement('ol');
  list.id = 'toc-now-list';
  for (const a of links) {
    const li = document.createElement('li');
    li.append(a.cloneNode(true));
    list.append(li);
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', list.id);
  btn.innerHTML = '<span></span><b></b>';
  chip.append(list, btn);
  document.body.append(chip);
  const items = [...list.querySelectorAll('a')];
  let cur = -1;
  const show = i => {
    if (i === cur) return;
    cur = i;
    btn.querySelector('span').textContent = links[i].querySelector('span').textContent;
    btn.querySelector('b').textContent = links[i].querySelector('b').textContent;
    btn.setAttribute('aria-label', `Chapter ${links[i].textContent.trim()}: show all chapters`);
    items.forEach((a, j) => a.classList.toggle('on', j === i));
  };
  const close = () => { chip.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = chip.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  items.forEach(a => a.addEventListener('click', close));
  document.addEventListener('click', e => { if (!chip.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  let raf = 0;
  const frame = () => {
    raf = 0;
    const line = innerHeight * 0.35;
    let i = -1;
    acts.forEach((s, j) => { if (s.getBoundingClientRect().top < line) i = j; });
    const afterList = toc.getBoundingClientRect().bottom < 0;
    const beforeEnd = acts[acts.length - 1].getBoundingClientRect().bottom > innerHeight * 0.3;
    const on = afterList && beforeEnd && i >= 0;
    chip.classList.toggle('on', on);
    if (!on) close();
    if (i >= 0) show(i);
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
  addEventListener('resize', frame);
  frame();
})();
