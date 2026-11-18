(() => {
  'use strict';

  const endpoint = window.CIRCUIT_USAGE_ENDPOINT || '';
  if (location.origin !== 'https://metaborin.github.io'
      || !location.pathname.startsWith('/r08-circuit-b-study/')
      || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint)) return;

  const pages = new Set(['home', 'scope', 'units', 'resources', 'practice', 'formulas', 'lab']);
  const scopeDetails = new Set(['details', 'capacitor', 'magnetic', 'problems', 'exclusions']);
  const lessons = new Set((window.LESSONS || []).map(lesson => lesson.id));
  const resources = new Map((window.RESOURCES || []).map(item => [item.id, item.type]));
  let lastPage = null;

  function count(event, id) {
    // Only public catalog IDs go into the request. No cookies, referrer or student identifiers.
    try {
      fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true,
        headers: {'Content-Type': 'text/plain;charset=UTF-8'},
        body: JSON.stringify({event, id})
      }).catch(() => {});
    } catch { /* Learning remains available offline. */ }
  }

  function pageView(page, section) {
    let id = pages.has(page) ? page : null;
    if (page === 'scope' && section) id = scopeDetails.has(section) ? 'scope/details' : null;
    if (page === 'lesson' && lessons.has(section)) id = 'lesson/' + section;
    if (id && id !== lastPage) count('page_view', id);
    lastPage = id;
  }

  function slideOpen(id) {
    if (resources.get(id) === 'slide') count('slide_open', id);
  }

  // One viewing per open player, including pauses, replay, and changes of part.
  function observeVideo(video, id) {
    if (resources.get(id) !== 'video') return;
    let started = false;
    let reachedThreshold = false;
    let completedSeconds = 0;
    let segment = null;
    const listeners = new AbortController();

    function sample() {
      if (!segment || video.seeking || reachedThreshold) return;
      const elapsed = (performance.now() - segment.clock) / 1000;
      const played = (video.currentTime - segment.position) / segment.rate;
      // Media time excludes buffering. Wall time excludes jumps and accounts for playback speed.
      segment.seconds = Math.max(segment.seconds, Math.min(elapsed, played));
      if (completedSeconds + segment.seconds >= 30) {
        reachedThreshold = true;
        count('video_30s', id);
      }
    }

    function finishSegment() {
      if (segment) completedSeconds += segment.seconds;
      segment = null;
    }

    function stop() {
      sample();
      finishSegment();
    }

    function beginSegment() {
      if (segment || reachedThreshold || video.paused || video.ended || video.seeking
          || video.playbackRate <= 0) return;
      segment = {clock: performance.now(), position: video.currentTime, rate: video.playbackRate, seconds: 0};
    }

    function on(type, callback) {
      video.addEventListener(type, callback, {signal: listeners.signal});
    }

    on('playing', () => {
      if (video.paused || video.ended || video.seeking) return;
      if (!started) {
        started = true;
        count('video_start', id);
      }
      beginSegment();
    });
    on('timeupdate', sample);
    on('pause', stop);
    on('waiting', stop);
    on('ended', stop);
    on('error', stop);
    on('emptied', finishSegment);
    // currentTime may already be the destination when the seeking event arrives.
    on('seeking', finishSegment);
    on('seeked', () => {
      if (started && video.readyState >= 3) beginSegment();
    });
    on('ratechange', () => {
      if (!segment) return;
      stop();
      beginSegment();
    });
    return {
      beforePartChange: stop,
      close() {
        listeners.abort();
        stop();
      }
    };
  }

  window.StudyUsage = {pageView, slideOpen, observeVideo};
  document.getElementById('usage-notice').hidden = false;
})();
