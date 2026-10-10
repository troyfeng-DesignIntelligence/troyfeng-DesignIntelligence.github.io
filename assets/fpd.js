(function () {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const figs = [...document.querySelectorAll('[data-reveal]')];
  if (figs.length && 'IntersectionObserver' in window && !still) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: .25 });
    figs.forEach(f => { f.classList.add('fpd-js'); io.observe(f); });
  }
  const centre = () => document.querySelectorAll('.fpd-scroller').forEach(el => { el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; });
  centre();
  addEventListener('load', centre);
})();
