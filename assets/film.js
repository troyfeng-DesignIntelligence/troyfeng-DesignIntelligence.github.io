(() => {
  for (const box of document.querySelectorAll('[data-film]')) {
    const video = box.querySelector('video');
    if (!video) continue;
    if (video.autoplay && matchMedia('(prefers-reduced-motion: reduce)').matches) { video.autoplay = false; video.removeAttribute('autoplay'); video.pause(); }
    const langs = [...box.querySelectorAll('button[data-src]')];
    for (const b of langs) {
      b.addEventListener('click', () => {
        if (b.classList.contains('on')) return;
        const at = video.currentTime, playing = !video.paused && !video.ended;
        video.src = b.dataset.src;
        video.addEventListener('loadedmetadata', () => { video.currentTime = at; if (playing) video.play(); }, { once: true });
        video.load();
        for (const x of langs) x.classList.toggle('on', x === b);
      });
    }
    const chapters = [...box.querySelectorAll('button[data-t]')];
    for (const b of chapters) {
      b.addEventListener('click', () => {
        video.currentTime = +b.dataset.t;
        video.play();
        video.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
    const mark = () => {
      let on = null;
      for (const b of chapters) if (video.currentTime >= +b.dataset.t - 0.05) on = b;
      for (const b of chapters) b.parentElement.classList.toggle('on', b === on && !video.paused);
    };
    video.addEventListener('timeupdate', mark);
    video.addEventListener('seeking', mark);   
    video.addEventListener('pause', mark);
    video.addEventListener('play', mark);
  }
})();
