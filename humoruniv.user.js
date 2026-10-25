// ==UserScript==
// @name         웃대
// @namespace    https://greasyfork.org/users/your-username
// @version      1.35.2
// @description  레이아웃 정리, 더보기 자동 클릭(최대 50p, 목록 페이지 전용), OK 수 기준 게시글 숨기기, ㅇㅎ/ㅎㅂ AI글 흐리게, 댓글 강조/0추천·0비추천 그룹 숨김, 답글 베스트 박스 숨김, 상세페이지 하단 목록 숨김, 상단 내비(게시판 이동·ㅇㅎ/ㅎㅂ·검색 팝업), 동영상 소리 자동 켜기·단일 재생·탭 재생/정지·길게 눌러 2배속·화면 노출 자동재생(MP4 썸네일 자동 펼침)·미니 컨트롤 바·같은 영상 재생 위치 동기화, 필터/검색 기준 이전글·다음글, 불필요 요소 숨김·header-bar 보정
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/yusoo-dev/userscripts/main/humoruniv.user.js
// @downloadURL  https://raw.githubusercontent.com/yusoo-dev/userscripts/main/humoruniv.user.js
// @homepageURL  https://github.com/yusoo-dev/userscripts
// ==/UserScript==

(function () {
  'use strict';

  if (!location.hostname.endsWith('humoruniv.com')) return;
  // 중복 실행 방지(로더와 일반 설치본이 함께 있을 때 등)
  if (window.__uwHumorunivLoaded) return;
  window.__uwHumorunivLoaded = true;

  /* ──────────────────────────────────────────────────────────
   * 1. 설정 (Config)
   * ────────────────────────────────────────────────────────── */

  // 게시판별 필터 규칙: OK(추천) 수가 threshold 이하인 글은 숨김.
  //   exemptKeywords : 제목에 이 키워드가 있으면 추천 수와 무관하게 노출(예외).
  //                    단, 제목에 'ai'(대소문자 무관)가 있으면 예외를 적용하지 않음.
  //   (없는 게시판은 필터 비활성)
  const TABLE_FILTERS = {
    fashion: { threshold: 20, exemptKeywords: [] },
    face: { threshold: 20, exemptKeywords: [] },
    pdswait: { threshold: 4, exemptKeywords: ['ㅇㅎ', 'ㅎㅂ'] },
  };

  // 상단 내비(#navi) 빠른 검색 버튼(목록 버튼 오른쪽). 대기자료 제목 검색으로 이동.
  //   사이트가 EUC-KR이라 검색어를 EUC-KR 퍼센트 인코딩으로 넣어야 한다.
  //   (브라우저 표준 API는 EUC-KR 인코딩을 지원하지 않으므로 미리 계산한 값 사용)
  //   키워드 추가 시: 사이트에서 직접 검색 후 URL의 sk 값을 복사해 넣으면 됨.
  const QUICK_SEARCH_KEYWORDS = [
    { label: 'ㅇㅎ', sk: '%A4%B7%A4%BE' },
    { label: 'ㅎㅂ', sk: '%A4%BE%A4%B2' },
  ];
  const SEARCH_DAY = '3month';   // 검색 기간
  const SEARCH_TABLE = 'pdswait'; // 빠른 검색 버튼·검색란 대상 게시판(대기자료)

  // 상단 내비 게시판 버튼(순서대로). 현재 게시판 버튼은 숨김.
  //   table 값은 각 게시판 목록 URL의 table= 값.
  const NAVI_BOARDS = [
    { label: '웃긴자료', table: 'pds' },
    { label: '대기자료', table: 'pdswait' },
    { label: '얼굴인식', table: 'face' },
    { label: '패션', table: 'fashion' },
  ];

  const USER_PLAY_WINDOW_MS = 1500; // 영상 조작 후 이 시간 내 play는 사용자 재생으로 간주

  const MAX_LOAD_MORE_PAGE = 50;   // 더보기 자동 클릭 상한(다음 페이지 번호 기준)
  const LOAD_MORE_AHEAD = 5;       // 화면 높이의 몇 배 앞에서 미리 불러올지
  const LOAD_MORE_RETRY_MS = 3000; // 클릭 후 이 시간 동안 변화가 없으면 다시 클릭(먹통 방지, 중복 로드 방지 위해 여유 있게)
  const LOAD_MORE_TICK_MS = 700;   // 스크롤이 없어도 주기적으로 확인
  const LOW_REACTION_NOTOK = 2;  // 비추천 수가 이 값 이상이면 댓글 강조

  /* ──────────────────────────────────────────────────────────
   * 2. 페이지 컨텍스트 (Page context)
   * ────────────────────────────────────────────────────────── */

  // 상단 메뉴 오른쪽 끝에 버전 표시(자동 업데이트 확인용). 헤더 @version과 함께 올릴 것.
  const SCRIPT_VERSION = '1.35.2';
  const SHOW_VERSION = true;

  const params = new URLSearchParams(location.search);
  const table = params.get('table') || '';
  const isList = location.pathname.endsWith('/list.html') && !!table;
  const isRead = location.pathname.endsWith('/read.html'); // 상세 페이지

  const filterRule = TABLE_FILTERS[table] || null; // null이면 필터 비활성
  if (filterRule) document.documentElement.classList.add('uw-filtering');
  if (isRead) document.documentElement.classList.add('uw-read');

  /* ──────────────────────────────────────────────────────────
   * 3. 스타일 (Styles)
   *    단일 배포 유저스크립트라 한 곳에 모아 주입한다.
   * ────────────────────────────────────────────────────────── */

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      tr[height="128"] { height: initial !important; }

      /* 불필요 요소 숨김 (구 "페이지 불필요 요소 숨기기" 스크립트 통합) */
      #bannerList,
      [style] ~ ul,
      .notice,
      #footer_wrap,
      #bnb_wrap,
      #bo_vc,
      #bo_v_atc { display: none !important; }

      /* 상단 내비: 기존 높이(40px) 고정 + 원래 요소는 처음부터 숨김(교체 깜빡임 방지) */
      #navi > .flex-container {
        height: 40px !important; min-height: 40px !important; max-height: 40px !important; overflow: hidden !important;
      }
      #navi > .flex-container > :not(uw-navi) { display: none !important; }
      .comment_best_title { display: none !important; }
      li.low-reaction .comment_text,
      li.low-reaction .sub_comment > span:first-of-type { color: #4ecdff !important; }

      /* 0추천·0비추천 댓글 그룹 숨김 */
      li.uw-cmt-hide { display: none !important; }

      /* 답글 베스트 스크린샷(PNG) 다운로드 박스 숨김 */
      .comment_best_wrap .box:has(a[href*="download_comment_best.php"]) { display: none !important; }

      /* 로딩 스피너 숨김 */
      #loading_spinner,
      img[src*="waitplz.gif"] { display: none !important; }

      /* 필터 통과(uw-ok) 전까지 행 전체 숨김 → 탈락 글 깜빡임·갭 방지 */
      html.uw-filtering .post_item:not(.uw-ok) { display: none !important; }

      /* ㅇㅎ/ㅎㅂ 글 중 제목에 'ai' 포함: 숨기지 않고 흐리게 */
      .post_item.uw-ai-dim { opacity: 0.3 !important; }

      /* 상세(read) 페이지: 하단 목록 네비/컨테이너/더보기 숨김 (목록 페이지엔 영향 없음) */
      html.uw-read #list_container_navi,
      html.uw-read #list_container,
      html.uw-read #btn_load_more_div { display: none !important; }

      /* 빠른 검색 버튼: 현재 검색어와 일치하면 강조 */
      #navi .uw-qs.uw-qs-on { color: #ff5a5a !important; border-color: #ff5a5a !important; }

      /* 영상 탭 토글: 더블탭 확대 지연 제거 */
      video { touch-action: manipulation; }

      /* 사이트 영상 버튼(새창에서 보기/소리켜기·끄기) 숨김 → 미니 바의 소리 버튼으로 대체 */
      .comment_crop_href_mp4 { display: none !important; }

      /* 재생 중인 영상 테두리(영상 위에 요소를 겹치지 않고 outline으로 표시) */
      video { outline: 2px solid transparent !important; outline-offset: 2px !important;
              transition: outline-color .2s !important; }
      video.uw-playing { outline-color: #ff5a5a !important; }
      video { -webkit-touch-callout: none !important; -webkit-user-select: none !important; user-select: none !important; }

    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ──────────────────────────────────────────────────────────
   * 4. 상단 내비: 빠른 검색 버튼 + 검색란 (Navi search)
   *
   *  - [≡] [웃긴자료] [대기자료] [얼굴인식] [패션] [ㅇㅎ] [ㅎㅂ] [검색]  (현재 게시판 버튼은 숨김)
   *    ≡ = 현재 게시판 1페이지 목록(게시판 페이지가 아니면 숨김).
   *  - [검색] 버튼 → 화면 중앙 검색 팝업.
   *  - 검색란: 대기자료 제목 검색으로 이동. 모든 페이지에 표시.
   *  - 검색어 인코딩: 일반 GET 폼 제출을 사용 → 브라우저가 페이지 문자셋(EUC-KR)으로
   *    자동 인코딩해 주므로 임의 검색어도 깨지지 않는다.
   *  - 현재 검색 결과 페이지면 검색어를 EUC-KR로 디코딩해 검색란에 채워 둔다.
   * ────────────────────────────────────────────────────────── */

  // 이미 EUC-KR 인코딩된 sk를 직접 이어붙임(URLSearchParams는 UTF-8로 인코딩하므로 사용 불가)
  function buildSearchUrl(sk) {
    return `/board/list.html?table=${SEARCH_TABLE}&st=subject&searchday=${SEARCH_DAY}&sk=${sk}`;
  }

  // 현재 URL의 sk 원문(인코딩된 그대로)
  function currentRawSk() {
    if (table !== SEARCH_TABLE) return '';
    const m = location.search.match(/[?&]sk=([^&]*)/);
    return m ? m[1] : '';
  }

  // EUC-KR 퍼센트 인코딩 → 문자열
  function decodeEucKr(raw) {
    if (!raw) return '';
    try {
      const bytes = [];
      const str = raw.replace(/\+/g, ' ');
      for (let i = 0; i < str.length; i++) {
        if (str[i] === '%' && /^[0-9a-f]{2}$/i.test(str.substr(i + 1, 2))) {
          bytes.push(parseInt(str.substr(i + 1, 2), 16)); i += 2;
        } else {
          bytes.push(str.charCodeAt(i) & 0xff);
        }
      }
      return new TextDecoder('euc-kr').decode(new Uint8Array(bytes));
    } catch { return ''; }
  }

  function navBtn(label, href, active) {
    const a = document.createElement('a');
    a.href = href;
    css(a, { 'flex-shrink': '0', 'text-decoration': 'none' });
    const span = document.createElement('span');
    span.className = 'btn navi_main_btn uw-qs' + (active ? ' uw-qs-on' : '');
    css(span, { padding: '2px 5px', 'font-size': '12px', 'white-space': 'nowrap', margin: '0' });
    span.textContent = label;
    a.appendChild(span);
    return a;
  }

  // 내비 전체를 [게시판 버튼들][ㅇㅎ][ㅎㅂ][검색란] 한 줄로 교체.
  //   기존 요소는 지우지 않고 숨김(사이트 스크립트가 참조할 수 있으므로).
  function injectNaviSearch() {
    const navi = document.getElementById('navi');
    const root = navi?.querySelector(':scope > .flex-container');
    if (!root || root.dataset.uwSearch) return;
    root.dataset.uwSearch = '1';

    // 높이 고정·원래 요소 숨김은 CSS(injectStyles)에서 페이지 표시 전에 적용됨

    const bar = el('uw-navi', {
      display: 'flex', 'align-items': 'center', gap: '4px',
      width: '100%', height: '100%', padding: '0 6px', 'overflow-x': 'auto', 'overflow-y': 'hidden',
      'scrollbar-width': 'none',
    });

    // 맨 왼쪽: 현재 게시판 1페이지 목록 (회색 목록 아이콘)
    if (table) {
      const home = document.createElement('a');
      home.href = `/board/list.html?table=${encodeURIComponent(table)}`;
      home.setAttribute('aria-label', '현재 게시판 목록');
      css(home, {
        display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'flex-shrink': '0',
        width: '30px', height: '30px', margin: '0', padding: '0', color: '#9a9a9a', 'text-decoration': 'none',
      });
      home.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="display:block">' +
        '<rect x="3" y="5" width="3" height="3" rx="1"/><rect x="8" y="5.5" width="13" height="2" rx="1"/>' +
        '<rect x="3" y="10.5" width="3" height="3" rx="1"/><rect x="8" y="11" width="13" height="2" rx="1"/>' +
        '<rect x="3" y="16" width="3" height="3" rx="1"/><rect x="8" y="16.5" width="13" height="2" rx="1"/></svg>';
      bar.appendChild(home);
    }

    // 게시판 버튼(현재 게시판 제외)
    for (const b of NAVI_BOARDS) {
      if (b.table === table) continue;
      bar.appendChild(navBtn(b.label, `/board/list.html?table=${b.table}`, false));
    }

    // ㅇㅎ / ㅎㅂ
    const currentSk = currentRawSk().toUpperCase();
    for (const { label, sk } of QUICK_SEARCH_KEYWORDS) {
      bar.appendChild(navBtn(label, buildSearchUrl(sk), currentSk === sk.toUpperCase()));
    }

    // 검색 버튼 → 검색 팝업
    const searchBtn = navBtn('검색', '#', false);
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openSearchModal(); // 클릭 핸들러 안에서 바로 focus해야 모바일 키보드가 뜸
    });
    bar.appendChild(searchBtn);

    if (SHOW_VERSION) {
      const ver = el('uw-ver', {
        display: 'block', 'margin-left': 'auto', 'flex-shrink': '0', padding: '0 2px',
        color: '#666', 'font-size': '10px', 'white-space': 'nowrap',
      });
      ver.textContent = `v${SCRIPT_VERSION}`;
      bar.appendChild(ver);
    }

    root.appendChild(bar);
  }

  /* ── 검색 팝업 ──
   *  화면 중앙(키보드에 가리지 않게 약간 위쪽)에 검색창. 배경 탭 / ✕ / 뒤로가기(ESC)로 닫기.
   *  검색어 인코딩은 일반 GET 폼 제출 → 브라우저가 페이지 문자셋(EUC-KR)으로 자동 인코딩.
   */
  let searchModal = null;

  function buildSearchModal() {
    const backdrop = el('uw-search', {
      display: 'none', position: 'fixed', inset: '0', 'z-index': '2147483000',
      background: 'rgba(0,0,0,.6)', 'align-items': 'flex-start', 'justify-content': 'center',
      'padding-top': '22vh',
    });
    const form = document.createElement('form');
    form.method = 'get';
    form.action = '/board/list.html';
    form.acceptCharset = 'euc-kr';
    css(form, {
      display: 'flex', 'align-items': 'center', gap: '8px', width: 'min(92vw, 420px)',
      margin: '0', padding: '10px', background: '#2a2a2a', 'border-radius': '12px',
      'box-shadow': '0 8px 30px rgba(0,0,0,.5)', 'box-sizing': 'border-box',
    });
    for (const [name, value] of [['table', SEARCH_TABLE], ['st', 'subject'], ['searchday', SEARCH_DAY]]) {
      const h = document.createElement('input');
      h.type = 'hidden'; h.name = name; h.value = value;
      form.appendChild(h);
    }
    const input = el('input', {
      display: 'block', flex: '1 1 auto', width: 'auto', height: '40px', padding: '0 12px',
      'border-radius': '8px', border: '1px solid #555', background: '#1b1b1b',
      color: '#eee', 'font-size': '16px', 'line-height': '40px', outline: 'none',
      '-webkit-appearance': 'none', appearance: 'none',
    });
    input.type = 'search';
    input.name = 'sk';
    input.placeholder = '대기자료 제목 검색';
    input.enterKeyHint = 'search';
    input.autocomplete = 'off';
    input.value = decodeEucKr(currentRawSk());

    const submit = el('button', {
      display: 'block', flex: 'none', height: '40px', padding: '0 14px', 'border-radius': '8px',
      background: '#ff5a5a', color: '#fff', 'font-size': '14px', 'font-weight': 'bold', cursor: 'pointer',
    });
    submit.type = 'submit';
    submit.textContent = '검색';

    form.append(input, submit);
    backdrop.appendChild(form);
    document.body.appendChild(backdrop);

    form.addEventListener('submit', (e) => {
      if (!input.value.trim()) { e.preventDefault(); input.focus(); } // 빈 검색 방지
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeSearchModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && searchModal?.open) closeSearchModal();
    });
    // 안드로이드 뒤로가기로 닫기: 열 때 history 항목 추가 → popstate에서 닫음
    window.addEventListener('popstate', () => { if (searchModal?.open) closeSearchModal(true); });

    return { backdrop, input, open: false };
  }

  function openSearchModal() {
    searchModal ||= buildSearchModal();
    if (searchModal.open) return;
    searchModal.open = true;
    css(searchModal.backdrop, { display: 'flex' });
    searchModal.input.focus();
    searchModal.input.select();
    try { history.pushState({ uwSearch: true }, ''); } catch {}
  }

  function closeSearchModal(fromPopState = false) {
    if (!searchModal?.open) return;
    searchModal.open = false;
    css(searchModal.backdrop, { display: 'none' });
    searchModal.input.blur();
    if (!fromPopState && history.state?.uwSearch) history.back();
  }

  /* ──────────────────────────────────────────────────────────
   * 5. 동영상 공통 (Video)
   * ────────────────────────────────────────────────────────── */

  const SOUND_TOGGLE_SEL = 'a[href*="mp4_sound_toggle"]';
  const hookedVideos = new WeakSet();

  function allVideos() {
    return document.querySelectorAll('video');
  }

  function videoIdFromToggle(a) {
    const m = a.getAttribute('href').match(/mp4_sound_toggle\(['"]([^'"]+)['"]\)/);
    return m ? m[1] : '';
  }

  // 이벤트 대상에서 관련 video 찾기(영상 / 탭 오버레이 / 소리 버튼)
  function videoFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const v = target.closest('video');
    if (v) return v;
    const toggle = target.closest(SOUND_TOGGLE_SEL);
    return toggle ? document.getElementById(videoIdFromToggle(toggle)) : null;
  }

  // 네이티브 컨트롤 제거 → 미니 컨트롤 바(5-5)로 대체.
  //   네이티브는 크기 조절·상시 표시가 안 되고 ⋮(PIP) 메뉴도 못 없애므로 직접 만든다.
  //   재생/정지는 영상 탭, 소리는 사이트의 '소리켜기/끄기' 버튼.
  function trimNativeControls(v) {
    v.controls = false;
    v.removeAttribute('controls');
    v.disablePictureInPicture = true;
    v.disableRemotePlayback = true;
    attachMiniBar(v);
  }

  // 신규 영상 1회 셋업(이벤트·컨트롤). process 루프에서 호출.
  function hookVideos() {
    pruneVisibility();
    for (const v of allVideos()) {
      if (hookedVideos.has(v)) continue;
      hookedVideos.add(v);
      // 스크립트가 펼친 영상은 "사용자 재생"으로 취급하지 않음(화면 밖에서 재생 방지)
      if (!isAutoExpanded(v)) markIfInsertedByUser(v);
      trimNativeControls(v);
      // 길게 누르기(2배속)·영상 하단 탐색 중 스크롤 차단. 영상에만 non-passive로 등록.
      v.addEventListener('touchmove', (e) => {
        if (sg && e.cancelable) { e.preventDefault(); return; }
        onTouchMoveBlock(e);
      }, { passive: false });
      v.autoplay = false; // 재생 여부는 화면 노출(5-4)이 결정
      viewportObserver.observe(v);
      v.addEventListener('pause', scheduleEvaluate); // 예기치 않은 정지 복구 판단
      // 차단 상태에서는 시도하지 않음(음소거 재생 ↔ 재시도 무한 루프 방지)
      v.addEventListener('playing', () => { if (!soundBlocked) unmute(v); });
      if (!soundBlocked) unmute(v);
    }
  }

  /* ──────────────────────────────────────────────────────────
   * 5-1. 소리 자동 켜기 (Auto unmute) — 모든 페이지, 모든 영상
   *
   *  - 재생될 때마다('playing') 소리 켬. 차단되면 음소거 재생으로 되돌리고 blocked 전환.
   *  - 이후 사용자 입력(상시 리스너)마다 모든 영상 소리 켬.
   *  - 사용자가 '소리끄기'를 직접 누른 영상은 다시 켜지 않음.
   * ────────────────────────────────────────────────────────── */

  // 사용자 활성화(user activation)를 부여하는 이벤트들
  const ACTIVATION_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'];
  const userMutedVideos = new WeakSet();
  let soundBlocked = false; // 자동재생 정책으로 차단된 상태(사용자 입력 대기)

  // 사이트 토글 함수로 상태 변경(버튼 문구 동기화). 부재/실패 시 직접 설정.
  function setMuted(video, muted) {
    if (video.muted === muted) return;
    if (video.id && typeof window.mp4_sound_toggle === 'function') {
      try { window.mp4_sound_toggle(video.id); } catch {}
    }
    if (video.muted !== muted) video.muted = muted;
  }

  function wantsUnmute(video) {
    return video.muted && !userMutedVideos.has(video) && video.isConnected;
  }

  // 재생 중인 영상만 play()를 건드린다(일시정지된 영상을 다시 재생시키지 않도록).
  async function unmute(video) {
    if (!wantsUnmute(video)) return;
    const wasPlaying = !video.paused;
    setMuted(video, false);
    if (!wasPlaying) return; // 정지 영상은 소리만 켜두고, 재생은 사용자가 할 때(=제스처 있음)
    try {
      await video.play();
      // Chrome은 차단 시 play()를 reject하거나 영상을 일시정지시킴
      if (video.paused) throw new Error('blocked');
    } catch {
      soundBlocked = true;
      setMuted(video, true);
      video.play().catch(() => {});
    }
  }

  function onActivation(e) {
    const t = e.target instanceof Element ? e.target : null;
    soundBlocked = false;
    // 소리 버튼(사이트/미니 바) 자체는 그 버튼 동작에 맡김(이중 토글 방지). 나머지 영상만 처리.
    const toggle = t?.closest(SOUND_TOGGLE_SEL);
    const mini = t?.closest('uw-sound');
    const skip = toggle ? document.getElementById(videoIdFromToggle(toggle)) : (mini?.uwVideo || null);
    for (const v of allVideos()) if (v !== skip) unmute(v);
  }

  // 사용자가 소리 버튼을 누른 결과를 기록: 끄면 이후 자동으로 켜지 않음.
  function onSoundToggleClick(e) {
    const toggle = e.target instanceof Element ? e.target.closest(SOUND_TOGGLE_SEL) : null;
    if (!toggle) return;
    const v = document.getElementById(videoIdFromToggle(toggle));
    if (!v) return;
    setTimeout(() => {
      if (v.muted) userMutedVideos.add(v);
      else userMutedVideos.delete(v);
    }, 0);
  }

  function initAutoUnmute() {
    for (const t of ACTIVATION_EVENTS) window.addEventListener(t, onActivation, { capture: true, passive: true });
    window.addEventListener('click', onSoundToggleClick, true);
  }

  /* ──────────────────────────────────────────────────────────
   * 5-2. 단일 재생 (Single playback)
   *
   *  - 동시에 하나의 영상만 재생. 'play'는 버블링되지 않으므로 document 캡처로 수신.
   *  - 사용자가 직접 재생한 영상 → 활성 영상으로 전환, 나머지 일시정지.
   *  - 자동재생으로 시작된 영상 → 이미 활성 영상이 재생 중이면 그 영상을 정지.
   * ────────────────────────────────────────────────────────── */

  // 썸네일(MP4 미리보기)을 눌러 영상이 새로 삽입되는 경우: 클릭 대상(썸네일)과 영상이
  // 다른 요소라 lastInteract로는 잡히지 않는다. → 사용자 입력 직후 새로 생긴 영상의
  // 자동재생도 "사용자 재생"으로 인정한다(영상 로딩 시간을 고려해 넉넉한 창).
  const INSERTED_AFTER_GESTURE_MS = 5000;

  let activeVideo = null;
  let lastInteract = { video: null, at: 0 };
  let lastGestureAt = 0;
  let booted = false;               // 초기 로드 영상과 이후 삽입 영상 구분
  const intendedVideos = new WeakSet(); // 사용자 입력으로 새로 생긴 영상

  function isActivePlaying() {
    return activeVideo && activeVideo.isConnected && !activeVideo.paused && !activeVideo.ended;
  }

  function markInteract(v) {
    lastInteract = { video: v, at: Date.now() };
  }

  function onVideoInteract(e) {
    lastGestureAt = Date.now();
    const v = videoFromTarget(e.target);
    if (v) markInteract(v);
  }

  function isRecentGesture() {
    return Date.now() - lastGestureAt < INSERTED_AFTER_GESTURE_MS;
  }

  // 페이지 로드 이후 사용자 입력 직후에 삽입된 영상 표시(hookVideos에서 호출)
  function markIfInsertedByUser(v) {
    if (booted && isRecentGesture()) intendedVideos.add(v);
  }

  function isUserPlay(v) {
    if (lastInteract.video === v && Date.now() - lastInteract.at < USER_PLAY_WINDOW_MS) return true;
    // 훅 등록 전에 play가 먼저 올 수도 있으므로 미등록 신규 영상도 같은 기준으로 판단
    if (intendedVideos.has(v) || (booted && !hookedVideos.has(v) && isRecentGesture())) {
      intendedVideos.delete(v); // 1회만 인정(이후 자동 재시작은 일반 규칙)
      return true;
    }
    return false;
  }

  function onAnyPlay(e) {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || v === activeVideo) return;

    // 화면 밖 영상의 자동재생(사이트 autoplay 잔여 등)은 차단
    if (coverage.has(v) && cov(v) === 0 && !isUserPlay(v)) {
      v.pause();
      return;
    }
    if (isActivePlaying() && !isUserPlay(v)) {
      v.pause(); // 자동재생이 활성 영상을 방해하지 않도록
      return;
    }
    syncSameSource(v); // 같은 영상의 다른 사본(베스트 댓글/원래 댓글)과 재생 위치 맞춤
    activeVideo = v;
    for (const other of allVideos()) {
      if (other !== v && !other.paused) other.pause();
    }
  }

  /* ── 같은 영상 재생 위치 동기화 ──
   *  베스트 댓글과 원래 댓글처럼 같은 파일이 두 곳에 있으면, 새로 재생되는 쪽을
   *  직전에 보던 쪽의 위치로 맞춘다(양방향). 파일 주소로 같은 영상인지 판단.
   */
  const srcOwner = new Map(); // 영상 주소 → 마지막으로 재생된 video

  function videoKey(v) {
    const src = v.currentSrc || v.querySelector('source')?.src || v.src || '';
    if (!src) return '';
    try { return new URL(src, location.href).href.replace(/^https?:/, ''); } catch { return src; }
  }

  function seekWhenReady(v, time) {
    const apply = () => {
      if (!(v.duration > 0)) return;
      v.currentTime = Math.min(time, Math.max(0, v.duration - 0.05));
    };
    if (v.readyState >= 1) apply();
    else v.addEventListener('loadedmetadata', apply, { once: true });
  }

  function syncSameSource(v) {
    const key = videoKey(v);
    if (!key) return;
    const prev = srcOwner.get(key);
    srcOwner.set(key, v);
    if (!prev || prev === v || !prev.isConnected) return;
    const t = prev.currentTime;
    if (t > 0 && Math.abs(v.currentTime - t) > 0.3) seekWhenReady(v, t);
  }

  function initSinglePlayback() {
    document.addEventListener('play', onAnyPlay, true);
    window.addEventListener('pointerdown', onVideoInteract, { capture: true, passive: true });
    window.addEventListener('keydown', onVideoInteract, { capture: true, passive: true });
  }

  /* ──────────────────────────────────────────────────────────
   * 5-3. 영상 탭 = 재생/일시정지, 길게 누르기 = 2배속 (Tap / Long-press)
   *
   *  - 오버레이는 쓰지 않는다: 안드로이드 브라우저는 영상을 별도 레이어로 합성해서,
   *    영상 위에 요소를 겹치면(투명이어도) 그 영역이 검게 가려진다.
   *  - 짧게 탭: 재생/일시정지 토글(pointerup에서 처리).
   *  - 길게 누르기(LONG_PRESS_MS 이상): 누르는 동안만 2배속. 떼면 1배속 + 원래 재생/정지 상태로 복귀.
   *    2배속 시작 후엔 손가락이 움직여도 유지(스크롤 차단), 손을 뗄 때만 해제.
   *  - 스크롤 오인 방지: 관성 스크롤 중 화면을 터치해 멈추는 동작이 "영상 탭"으로 인식돼
   *    영상이 멈추던 문제 → 최근 스크롤 직후의 터치, 터치 중 스크롤 발생 시 탭/길게 누르기 무시.
   * ────────────────────────────────────────────────────────── */

  const TAP_MAX_MOVE = 10;        // px. 이보다 많이 움직이면 스크롤로 간주
  const TAP_MAX_DURATION = 200;   // ms. 이 안에 떼면 탭(2배속이 이미 켜졌어도 탭으로 처리)
  const LONG_PRESS_MS = 50;       // ms. 이만큼 누르고 있으면 2배속 시작(즉시)
  const LONG_PRESS_RATE = 2;      // 길게 누르는 동안 배속
  const LONG_PRESS_MOVE = 24;     // px. 2배속 시작 전 이만큼까지 흔들려도 길게 누르기로 인정
  const FAST_SCROLL_ESCAPE_MS = 300; // ms. 2배속 시작 직후 이 시간 안에 크게 세로로 움직이면 스크롤로 간주해 해제
  const FAST_SCROLL_ESCAPE_PX = 24;  // px. 위 판단에 쓰는 세로 이동 거리
  const SCROLL_GUARD_MS = 300;    // ms. 스크롤 후 이 시간 내 터치는 무시(관성 스크롤 멈춤용 터치)
  const NATIVE_TOGGLE_WAIT = 150; // ms. 브라우저 기본 토글 반영 대기

  let lastScrollAt = 0;
  let press = null; // { video, id, x, y, at, paused, timer, fast }

  function scrolledSince(t) {
    return lastScrollAt >= t;
  }

  function startFast(p) {
    const v = p.video;
    if (press !== p || !v.isConnected) return;
    if (scrolledSince(p.at)) { press = null; return; }
    p.fast = true;
    p.fastAt = Date.now();
    markInteract(v);
    v.playbackRate = LONG_PRESS_RATE;
    if (v.paused) v.play().catch(() => {});
  }

  function endPress(p, { cancelled }) {
    clearTimeout(p.timer);
    const v = p.video;
    if (p.fast) {
      v.playbackRate = 1;
      if (p.paused && !v.paused) v.pause(); // 원래 정지 상태였으면 복귀
      return;
    }
    if (cancelled) return;
  }

  function onPressDown(e) {
    const v = e.target;
    if (press) { endPress(press, { cancelled: true }); press = null; }
    if (!(v instanceof HTMLVideoElement) || !e.isPrimary) return;
    if (document.fullscreenElement === v) return;
    if (seekVideoFrom(e)) return; // 영상 하단 탐색 영역은 재생바 조작으로 처리
    if (Date.now() - lastScrollAt < SCROLL_GUARD_MS) return; // 관성 스크롤 멈춤 터치
    const p = { video: v, id: e.pointerId, x: e.clientX, y: e.clientY, at: Date.now(), paused: v.paused, timer: 0, fast: false };
    p.timer = setTimeout(() => startFast(p), LONG_PRESS_MS);
    press = p;
  }

  function onPressMove(e) {
    const p = press;
    if (!p || e.pointerId !== p.id || p.fast) return; // 2배속 시작 후엔 움직여도 유지
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_MOVE) {
      clearTimeout(p.timer); // 움직이면 길게 누르기 취소(스크롤 의도)
      press = null;
    }
  }

  function onPressUp(e) {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    press = null;
    clearTimeout(p.timer);
    if (p.fast) {
      endPress(p, { cancelled: false }); // 1배속 + 원래 재생/정지 상태로 복귀
      // 2배속이 켜졌더라도 짧게 눌렀다 뗀 거면 탭으로 처리(트리거가 탭보다 빠르기 때문)
      if (Date.now() - p.at > TAP_MAX_DURATION) return;
    }

    // 짧은 탭만 토글
    if (e.target !== p.video) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_MAX_MOVE) return;
    if (Date.now() - p.at > TAP_MAX_DURATION) return;
    if (scrolledSince(p.at)) return;

    const v = p.video;
    markInteract(v);
    setTimeout(() => {
      if (scrolledSince(p.at)) return;
      if (v.paused === p.paused) { // 브라우저가 토글하지 않았으면 직접 토글
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      }
      // 직접 멈춘 영상: 화면에 머무는 동안 자동재생 안 함 / 직접 재생한 영상: 사라질 때까지 유지
      if (p.paused) { userPausedVideos.delete(v); userPinnedVideos.add(v); }
      else { userPausedVideos.add(v); userPinnedVideos.delete(v); }
    }, NATIVE_TOGGLE_WAIT);
  }

  function onPressCancel(e) {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    if (p.fast) return; // 2배속 중엔 손을 뗄 때(touchend)까지 유지
    press = null;
    endPress(p, { cancelled: true });
  }

  // 2배속 중 손가락이 움직여도 스크롤이 시작되지 않게 막음(스크롤이 시작되면 pointercancel 발생)
  // 2배속 중엔 스크롤 차단(살짝 흔들려도 유지).
  //   단, 트리거가 빨라서 "잠깐 멈췄다 스와이프"도 2배속이 될 수 있으므로,
  //   2배속 직후 짧은 시간 안에 크게 세로로 움직이면 스크롤 의도로 보고 2배속 해제 + 스크롤 허용.
  function onTouchMoveBlock(e) {
    const p = press;
    if (!p?.fast) return;
    const t = e.touches[0];
    if (t && Date.now() - p.fastAt < FAST_SCROLL_ESCAPE_MS
        && Math.abs(t.clientY - p.y) > FAST_SCROLL_ESCAPE_PX
        && Math.abs(t.clientY - p.y) > Math.abs(t.clientX - p.x)) {
      press = null;
      endPress(p, { cancelled: true });
      return; // preventDefault 안 함 → 스크롤 진행
    }
    if (e.cancelable) e.preventDefault();
  }

  // pointercancel 이후엔 pointerup이 오지 않으므로 touchend로 종료
  function onTouchEnd(e) {
    const p = press;
    if (!p || !p.fast || e.touches.length) return;
    press = null;
    endPress(p, { cancelled: false });
  }

  function initTapToggle() {
    window.addEventListener('scroll', () => { lastScrollAt = Date.now(); }, { capture: true, passive: true });
    document.addEventListener('pointerdown', onPressDown, { capture: true, passive: true });
    document.addEventListener('pointermove', onPressMove, { capture: true, passive: true });
    document.addEventListener('pointerup', onPressUp, { capture: true, passive: true });
    document.addEventListener('pointercancel', onPressCancel, { capture: true, passive: true });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });
    // 길게 누를 때 뜨는 기본 메뉴(동영상 저장 등) 차단
    document.addEventListener('contextmenu', (e) => {
      if (e.target instanceof HTMLVideoElement) e.preventDefault();
    }, true);
    // 앱 전환 등으로 손을 뗀 이벤트를 놓친 경우 복구
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && press) { endPress(press, { cancelled: true }); press = null; }
    });
  }

  /* ──────────────────────────────────────────────────────────
   * 5-5. 미니 컨트롤 바 (Mini controls)
   *
   *  - 영상 바로 아래, 항상 표시: [재생바] [시간] [소리 버튼]. 영상을 가리지 않음.
   *  - 재생 상태 표시: 재생 중이면 영상 테두리·재생바·시간이 빨강, 정지면 회색.
   *  - 오터치 방지:
   *    · 터치 영역 28px + 영상과 6px 간격(영상 탭 토글과 분리)
   *    · touch-action: pan-y → 바 위에서 세로 스와이프는 그냥 스크롤, 탐색 안 함
   *    · 탐색은 "가로로 끌기" 또는 "짧게 탭"일 때만
   *  - 사이트 CSS(아이디 선택자 + !important 등)를 피하려고
   *    커스텀 태그(<uw-*>) + 인라인 !important 스타일로 완전히 격리.
   * ────────────────────────────────────────────────────────── */

  const MINI_BAR_HEIGHT = 44;   // px. 터치 영역 높이(재생바 위아래로 넉넉히)
  const MINI_TRACK_HEIGHT = 5;  // px. 보이는 재생바 두께
  const MINI_KNOB_SIZE = 12;    // px. 재생 위치 손잡이
  const MINI_GAP_TOP = 0;       // px. 영상과의 간격(터치 영역 자체가 위아래 여유를 가짐)
  const SEEK_DRAG_START = 3;    // px. 이만큼 가로로 움직이면 끌기 탐색 시작
  const SEEK_SCROLL_START = 6;  // px. 세로로 이만큼(가로보다 크게) 움직이면 페이지 스크롤로 전달
  const SEEK_HIT_Y = 26;        // px. 보이는 재생바 중심선에서 위아래로 이 거리까지 판정(대칭)
  const SEEK_HIT_X = 12;        // px. 재생바 좌우 끝에서 이만큼 바깥까지 판정
  const SEEK_TAP_MAX_MOVE = 16; // px. 탭으로 인정하는 최대 이동
  const SEEK_TAP_MAX_MS = 600;  // ms. 탭으로 인정하는 최대 시간
  const PLAYING_COLOR = '#ff5a5a'; // 재생 중 표시 색(영상 테두리는 CSS의 video.uw-playing에서 지정)
  const PAUSED_COLOR = '#777';     // 정지 상태 재생바 색

  function css(el, styles) {
    for (const [k, val] of Object.entries(styles)) el.style.setProperty(k, val, 'important');
    return el;
  }

  const RESET = {
    margin: '0', padding: '0', border: '0', 'box-sizing': 'border-box',
    'line-height': '1', 'letter-spacing': '0', 'text-indent': '0',
    'box-shadow': 'none', opacity: '1', visibility: 'visible', float: 'none',
    'min-width': '0', 'max-width': 'none', 'min-height': '0', 'max-height': 'none',
    background: 'transparent',
  };

  function el(tag, styles) {
    return css(document.createElement(tag), { ...RESET, ...styles });
  }

  const miniResizeObserver = new ResizeObserver(entries => {
    for (const { target } of entries) syncMiniBar(target);
  });

  function fmtTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  // 스피커 아이콘(SVG). 음소거면 X 표시.
  const ICON_SOUND_ON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:block">' +
    '<path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/>' +
    '<path d="M14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
  const ICON_SOUND_OFF =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:block">' +
    '<path d="M3 9v6h4l5 5V4L7 9H3z"/>' +
    '<path d="M16.6 8.6 15.2 10l2 2-2 2 1.4 1.4 2-2 2 2 1.4-1.4-2-2 2-2-1.4-1.4-2 2-2-2z"/></svg>';

  function attachMiniBar(v) {
    if (v.uwMini) return;

    const bar = el('uw-mini', {
      'touch-action': 'none',
      display: 'flex', 'align-items': 'center', gap: '8px',
      height: `${MINI_BAR_HEIGHT}px`, 'margin-top': `${MINI_GAP_TOP}px`, padding: '0 2px',
      'user-select': 'none', '-webkit-user-select': 'none',
      '-webkit-tap-highlight-color': 'transparent',
    });

    // 재생바 영역(터치 영역 = 바 높이 전체)
    const seekArea = el('uw-seek', {
      display: 'flex', 'align-items': 'center', position: 'relative',
      flex: '1 1 auto', width: 'auto', height: '100%',
      'touch-action': 'none', cursor: 'pointer',
    });
    const track = el('uw-track', {
      display: 'block', position: 'relative', width: '100%',
      height: `${MINI_TRACK_HEIGHT}px`, 'border-radius': '3px', overflow: 'hidden',
      background: 'rgba(255,255,255,.25)',
    });
    // 진행률은 width/left 대신 transform으로 갱신 → 레이아웃 재계산 없이 GPU 합성만(스크롤 버벅임 방지)
    const fillStyle = {
      display: 'block', position: 'absolute', left: '0', top: '0', height: '100%', width: '100%',
      'transform-origin': '0 50%', transform: 'scaleX(0)', 'will-change': 'transform',
    };
    const buf = el('uw-buf', { ...fillStyle, background: 'rgba(255,255,255,.3)' });
    const fill = el('uw-fill', { ...fillStyle, background: '#ff5a5a' });
    const knobRail = el('uw-rail', {
      display: 'block', position: 'absolute', left: '0', right: '0', top: '50%', height: '0',
      transform: 'translateX(0%)', 'will-change': 'transform', 'pointer-events': 'none',
    });
    const knob = el('uw-knob', {
      display: 'block', position: 'absolute', left: '0', top: '0',
      width: `${MINI_KNOB_SIZE}px`, height: `${MINI_KNOB_SIZE}px`, 'border-radius': '50%',
      background: '#ff5a5a', transform: 'translate(-50%, -50%)', 'pointer-events': 'none',
    });
    knobRail.appendChild(knob);
    track.append(buf, fill);
    seekArea.append(track, knobRail);

    const time = el('uw-time', {
      display: 'block', flex: 'none', color: '#aaa',
      'font-size': '11px', 'font-family': 'ui-monospace, monospace', 'font-weight': 'normal',
      'font-variant-numeric': 'tabular-nums', 'white-space': 'nowrap',
    });
    const timeText = document.createTextNode('0:00/0:00'); // .data만 바꿔서 DOM 노드 교체(→ MutationObserver 발동) 방지
    time.appendChild(timeText);

    const sound = el('uw-sound', {
      display: 'flex', 'align-items': 'center', 'justify-content': 'center',
      flex: 'none', width: `${MINI_BAR_HEIGHT}px`, height: '100%',
      color: '#ddd', cursor: 'pointer', 'touch-action': 'manipulation',
    });
    sound.uwVideo = v;
    sound.addEventListener('pointerdown', (e) => e.stopPropagation()); // 소리 버튼은 탐색 제스처 제외

    bar.append(seekArea, time, sound);
    bar.className = 'uw-mini';
    bar.uwVideo = v;
    bar.uwTrack = track;
    v.after(bar);
    v.uwMini = bar;

    // ── 렌더 ──
    let lastRatio = -1, lastBuf = -1;
    const render = () => {
      const d = v.duration;
      const ratio = d > 0 ? Math.min(1, v.currentTime / d) : 0;
      if (Math.abs(ratio - lastRatio) > 0.0005) { // 변화 없으면 스타일 쓰기 생략
        lastRatio = ratio;
        fill.style.setProperty('transform', `scaleX(${ratio})`, 'important');
        knobRail.style.setProperty('transform', `translateX(${ratio * 100}%)`, 'important');
      }
      if (d > 0 && v.buffered.length) {
        const b = Math.min(1, v.buffered.end(v.buffered.length - 1) / d);
        if (Math.abs(b - lastBuf) > 0.005) { lastBuf = b; buf.style.setProperty('transform', `scaleX(${b})`, 'important'); }
      }
      const txt = `${fmtTime(v.currentTime)}/${fmtTime(d)}`;
      if (timeText.data !== txt) timeText.data = txt;
    };
    // 재생 상태 표시: 재생 중 = 빨강(영상 테두리 + 바), 정지 = 회색
    const renderState = () => {
      const playing = !v.paused && !v.ended;
      v.classList.toggle('uw-playing', playing);
      const c = playing ? PLAYING_COLOR : PAUSED_COLOR;
      css(fill, { background: c });
      css(knob, { background: c });
      css(time, { color: playing ? PLAYING_COLOR : '#888' });
    };
    const renderSound = () => {
      sound.innerHTML = v.muted ? ICON_SOUND_OFF : ICON_SOUND_ON;
      css(sound, { color: v.muted ? '#888' : '#ddd' });
    };

    let rafId = 0;
    // 재생 중 갱신: 화면 밖이면 건너뜀, 화면 안이면 rAF(부드러운 재생바)
    const loop = () => {
      if (cov(v) > 0) render();
      rafId = v.paused ? 0 : requestAnimationFrame(loop);
    };
    v.addEventListener('play', () => { if (!rafId) rafId = requestAnimationFrame(loop); });
    for (const t of ['loadedmetadata', 'durationchange', 'timeupdate', 'progress', 'seeked', 'pause']) {
      v.addEventListener(t, render);
    }
    v.addEventListener('volumechange', renderSound);
    for (const t of ['play', 'playing', 'pause', 'ended', 'emptied']) v.addEventListener(t, renderState);

    // ── 소리 버튼 ──
    sound.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const muted = !v.muted;
      setMuted(v, muted);
      if (muted) userMutedVideos.add(v);
      else userMutedVideos.delete(v);
      renderSound();
    });

    // ── 탐색: 가로 끌기 또는 짧은 탭만 ──
    const seekTo = (clientX) => {
      const r = track.getBoundingClientRect();
      if (!(v.duration > 0) || r.width === 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      v.currentTime = ratio * v.duration;
      render();
    };

    v.uwSeekTo = seekTo; // 탐색 제스처(5-6)에서 사용

    render();
    renderSound();
    renderState();
    syncMiniBar(v);
    miniResizeObserver.observe(v);
  }

  // 바 너비·위치를 영상에 맞춤(영상이 축소/정렬돼도 일치)
  function syncMiniBar(v) {
    const bar = v.uwMini;
    if (!bar) return;
    // 사이트/스크립트 CSS의 margin !important를 이기도록 important로 지정
    const curMargin = parseFloat(bar.style.marginLeft) || 0;
    bar.style.setProperty('width', `${v.offsetWidth}px`, 'important');
    bar.style.setProperty('margin-left', `${curMargin + v.offsetLeft - bar.offsetLeft}px`, 'important');
  }

  /* ──────────────────────────────────────────────────────────
   * 5-6. 재생바 탐색 제스처 (Seek gesture)
   *
   *  - 판정 영역: 보이는 재생바 중심선 기준 위아래 SEEK_HIT_Y(26px), 좌우 SEEK_HIT_X(12px).
   *    누른 요소(영상/바/여백)와 상관없이 화면상 거리로만 판정 → 보이는 위치와 정확히 일치.
   *  - 영역에서 시작한 터치는 브라우저 스크롤에 뺏기지 않음(touch-action:none + touchmove 차단).
   *    → 시작이 애매해도 끌기가 끊기지 않음.
   *  - 가로로 움직이면 탐색, 세로로 움직이면 페이지를 직접 스크롤(영역이 스크롤 사각지대가 되지 않게).
   *  - 짧게 탭하면 그 위치로 이동.
   * ────────────────────────────────────────────────────────── */

  let sg = null; // { v, id, x, y, lastY, at, mode: null | 'drag' | 'scroll' }

  // 판정은 "어떤 요소를 눌렀나"가 아니라 "보이는 재생바와의 거리"로 한다.
  //   → 레이아웃/브라우저의 터치 보정과 무관하게 화면에 보이는 바 기준으로 위아래 대칭.
  function seekVideoFrom(e) {
    const t = e.target;
    if (t instanceof Element && t.closest('uw-sound')) return null;
    let best = null, bestD = Infinity;
    for (const bar of document.querySelectorAll('uw-mini')) {
      const v = bar.uwVideo;
      if (!v || !v.isConnected || !bar.uwTrack || document.fullscreenElement === v) continue;
      const r = bar.uwTrack.getBoundingClientRect();
      if (r.width === 0) continue;
      if (e.clientX < r.left - SEEK_HIT_X || e.clientX > r.right + SEEK_HIT_X) continue;
      const d = Math.abs(e.clientY - (r.top + r.height / 2));
      if (d <= SEEK_HIT_Y && d < bestD) { best = v; bestD = d; }
    }
    return best;
  }

  function onSeekDown(e) {
    sg = null;
    if (!e.isPrimary) return;
    const v = seekVideoFrom(e);
    if (!v) return;
    sg = { v, id: e.pointerId, x: e.clientX, y: e.clientY, lastY: e.clientY, at: Date.now(), mode: null };
  }

  function onSeekMove(e) {
    if (!sg || e.pointerId !== sg.id) return;
    const ax = Math.abs(e.clientX - sg.x), ay = Math.abs(e.clientY - sg.y);
    if (!sg.mode) {
      if (ax >= SEEK_DRAG_START && ax >= ay * 0.6) sg.mode = 'drag';
      else if (ay >= SEEK_SCROLL_START && ay > ax) sg.mode = 'scroll';
      else return;
    }
    if (sg.mode === 'drag') sg.v.uwSeekTo(e.clientX);
    else window.scrollBy(0, sg.lastY - e.clientY);
    sg.lastY = e.clientY;
  }

  function onSeekUp(e) {
    if (!sg || e.pointerId !== sg.id) return;
    const g = sg; sg = null;
    if (g.mode === 'drag') { g.v.uwSeekTo(e.clientX); return; }
    if (g.mode) return;
    const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y);
    if (moved <= SEEK_TAP_MAX_MOVE && Date.now() - g.at <= SEEK_TAP_MAX_MS) g.v.uwSeekTo(e.clientX);
  }

  function initSeekGesture() {
    document.addEventListener('pointerdown', onSeekDown, { capture: true, passive: true });
    document.addEventListener('pointermove', onSeekMove, { capture: true, passive: true });
    document.addEventListener('pointerup', onSeekUp, { capture: true, passive: true });
    document.addEventListener('pointercancel', (e) => { if (sg && e.pointerId === sg.id) sg = null; }, { capture: true, passive: true });
    // 영역에서 시작한 터치는 브라우저 스크롤 차단(영상 하단 영역은 touch-action으로 못 막으므로)
    // touchmove 차단 리스너는 문서 전체가 아닌 각 영상에만 등록(hookVideos) → 나머지 영역 스크롤은 메인 스레드 대기 없이 부드럽게
  }

  /* ──────────────────────────────────────────────────────────
   * 5-4. 화면 노출 자동재생 (Viewport autoplay)
   *
   *  "노출도(coverage)" = 보이는 높이 / min(영상 높이, 화면 높이).
   *    → 화면보다 큰 세로 영상도 화면을 꽉 채우면 1.0.
   *  - 시작: 노출도 START_MIN(35%) 이상인 영상 중 가장 많이 보이는 것 1개만 재생.
   *    (가장자리에 살짝 걸친 영상은 재생하지 않음)
   *  - 교체: 다른 영상이 현재 영상보다 SWITCH_MARGIN(10%p) 이상 더 보이면 바로 교체.
   *    → 스크롤로 두 영상이 엇갈리는 "중간 지점"에서 넘어감. 비슷하게 보일 땐 유지(깜빡임 방지).
   *    현재 영상이 KEEP_MIN(25%) 밑이면 START_MIN 이상인 다른 영상으로 교체.
   *  - 직접 탭해서 재생한 영상은 화면에서 완전히 사라질 때까지 유지.
   *  - 직접 멈춘 영상이 USER_PAUSED_HOLD(50%) 이상 보이는 동안엔 다른 영상을 자동재생하지 않음.
   *  - 완전히 벗어나면 일시정지(+ 직접 재생/정지 기록 초기화).
   *  - 판단 주기: 스크롤 중에도 EVAL_INTERVAL마다 판단(스로틀). 멈출 때까지 기다리지 않음.
   * ────────────────────────────────────────────────────────── */

  const START_MIN = 0.35;       // 자동재생 시작 노출도
  const KEEP_MIN = 0.25;        // 이 밑으로 내려가면 무조건 교체 대상
  const SWITCH_MARGIN = 0.1;    // 다른 영상이 이만큼 더 보이면 교체
  const USER_PAUSED_HOLD = 0.5; // 직접 멈춘 영상을 보고 있다고 판단하는 노출도
  const EVAL_INTERVAL = 80;     // ms. 스크롤 중 판단 주기

  const coverage = new Map();              // video → 노출도(0~1)
  const userPausedVideos = new WeakSet();  // 사용자가 탭으로 멈춘 영상
  const userPinnedVideos = new WeakSet();  // 사용자가 탭으로 재생한 영상

  function cov(v) {
    return v.isConnected ? (coverage.get(v) || 0) : 0;
  }

  function calcCoverage(entry) {
    if (!entry.isIntersecting) return 0;
    const vh = entry.rootBounds?.height || window.innerHeight;
    const base = Math.min(entry.boundingClientRect.height, vh);
    return base > 0 ? Math.min(1, entry.intersectionRect.height / base) : 0;
  }

  // 자동재생: 단일 재생 규칙에서 "의도된 재생"으로 인정되도록 표시 후 재생.
  //   소리 켠 상태로 차단되면 음소거로 재생(자동재생 정책).
  function autoPlay(v) {
    if (!v || !v.paused || userPausedVideos.has(v) || document.fullscreenElement) return;
    markInteract(v);
    v.play().catch(() => {
      if (!v.muted) {
        soundBlocked = true;
        setMuted(v, true);
        markInteract(v);
        v.play().catch(() => {});
      }
    });
  }

  function evaluatePlayback() {
    if (document.fullscreenElement) return;
    const cur = isActivePlaying() ? activeVideo : null;
    const curCov = cur ? cov(cur) : 0;

    // 직접 탭해서 재생한 영상은 보이는 동안 유지
    if (cur && userPinnedVideos.has(cur) && curCov > 0) return;

    // 재생 중이던 영상이 예기치 않게 멈춘 경우(버퍼링 끊김, 브라우저 자동재생 정책 등) 다시 재생
    const a = activeVideo;
    if (!cur && a && a.isConnected && a.paused && !a.ended && !userPausedVideos.has(a)
        && (cov(a) >= KEEP_MIN || (userPinnedVideos.has(a) && cov(a) > 0))) {
      // 단, 더 잘 보이는 영상이 있으면 아래 교체 로직으로 넘어감
      let better = false;
      for (const v of coverage.keys()) {
        if (v !== a && !userPausedVideos.has(v) && cov(v) >= START_MIN && cov(v) - cov(a) >= SWITCH_MARGIN) { better = true; break; }
      }
      if (!better) { autoPlay(a); return; }
    }

    let best = null, bestCov = 0;
    for (const v of coverage.keys()) {
      const c = cov(v);
      // 직접 멈춘 영상을 보고 있는 중이면 다른 영상 자동재생 안 함
      if (userPausedVideos.has(v) && c >= USER_PAUSED_HOLD) return;
      if (v === cur || userPausedVideos.has(v)) continue;
      if (c >= START_MIN && c > bestCov) { best = v; bestCov = c; } // 동률이면 문서상 위쪽 우선
    }
    if (!best) return;
    if (cur && curCov >= KEEP_MIN && bestCov - curCov < SWITCH_MARGIN) return; // 비슷하면 유지
    autoPlay(best); // 단일 재생 규칙으로 기존 영상은 일시정지
  }

  // 스로틀: 스크롤 중에도 EVAL_INTERVAL마다 1회(앞·뒤 모두 실행)
  let evalTimer = 0, lastEvalAt = 0;
  function scheduleEvaluate() {
    if (evalTimer) return;
    const wait = Math.max(0, EVAL_INTERVAL - (Date.now() - lastEvalAt));
    evalTimer = setTimeout(() => {
      evalTimer = 0;
      lastEvalAt = Date.now();
      evaluatePlayback();
    }, wait);
  }

  function onViewportChange(entries) {
    for (const entry of entries) {
      const v = entry.target;
      const c = calcCoverage(entry);
      coverage.set(v, c);
      if (c === 0) {
        userPausedVideos.delete(v); // 다시 들어오면 자동재생 허용
        userPinnedVideos.delete(v);
        if (!v.paused) v.pause();
      }
    }
    scheduleEvaluate();
  }

  const viewportObserver = new IntersectionObserver(onViewportChange, {
    threshold: Array.from({ length: 21 }, (_, i) => i / 20), // 5% 단위
  });

  /* ── MP4 썸네일 자동 펼치기 ──
   *  본문 영상은 처음엔 썸네일(이미지)이고, 클릭해야 comment_mp4_expand()가 <video>로 교체한다.
   *  → 썸네일이 화면 근처에 오면 대신 클릭해서 영상으로 바꾼다. 생성된 영상은 위의
   *    화면 노출 로직(viewportObserver)이 그대로 재생/정지를 맡는다.
   *  약간 미리(THUMB_PRELOAD_MARGIN) 펼쳐서 화면에 들어올 때 로딩 지연을 줄인다. */

  const THUMB_SEL = '[onclick*="comment_mp4_expand"]';
  const THUMB_PRELOAD_MARGIN = 300; // px
  const hookedThumbs = new WeakSet();
  const autoExpandedKeys = new Set(); // 스크립트가 펼친 영상 키(예: 'mp4_1_1_')

  function thumbKey(el) {
    const m = (el.getAttribute('onclick') || '').match(/comment_mp4_expand\(\s*['"]([^'"]+)['"]/);
    return m ? m[1] : '';
  }

  // 영상이 스크립트가 펼친 것인지(=사용자 클릭으로 생긴 영상이 아님)
  function isAutoExpanded(v) {
    const fromId = v.id.startsWith('video_mp4_') ? v.id.slice('video_mp4_'.length) : '';
    if (fromId && autoExpandedKeys.has(fromId)) return true;
    const box = v.closest('[id^="comment_file_"]');
    return !!box && autoExpandedKeys.has(box.id.slice('comment_file_'.length));
  }

  function expandThumb(el) {
    thumbObserver.unobserve(el);
    if (!el.isConnected) return;
    const key = thumbKey(el);
    if (key) autoExpandedKeys.add(key);
    el.click(); // 인라인 onclick(comment_mp4_expand) 실행
  }

  const thumbObserver = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) if (isIntersecting) expandThumb(target);
  }, { rootMargin: `${THUMB_PRELOAD_MARGIN}px 0px` });

  function hookThumbs() {
    for (const el of document.querySelectorAll(THUMB_SEL)) {
      if (hookedThumbs.has(el)) continue;
      hookedThumbs.add(el);
      thumbObserver.observe(el);
    }
  }

  // DOM에서 제거된 영상 정리(Map 누수 방지)
  function pruneVisibility() {
    for (const v of coverage.keys()) {
      if (!v.isConnected) { coverage.delete(v); viewportObserver.unobserve(v); }
    }
  }

  /* ──────────────────────────────────────────────────────────
   * 6. 댓글 처리 (Comments)
   * ────────────────────────────────────────────────────────── */

  // 비추천 많은 댓글 강조
  function highlightLowReactionComments() {
    for (const li of document.querySelectorAll('li[id^="comment_li_"]')) {
      if (li.dataset.uwDone) continue;
      const notok = li.querySelector('.notok');
      if (!notok) continue;
      li.dataset.uwDone = '1';
      if (countDigits(notok.textContent) >= LOW_REACTION_NOTOK) li.classList.add('low-reaction');
    }
  }

  function isSubComment(li) {
    return li.getAttribute('name') === 'sub_comm_block' || li.classList.contains('sub_comm_bt');
  }
  function commentOk(li) {
    const r = li.querySelector('.ok .r') || li.querySelector('.ok');
    return r ? countDigits(r.textContent) : 0;
  }
  function commentNotok(li) {
    const n = li.querySelector('.notok');
    return n ? countDigits(n.textContent) : 0;
  }
  function isZeroComment(li) {
    return commentOk(li) === 0 && commentNotok(li) === 0;
  }

  // 추천0·비추천0인 댓글 그룹(원댓글 + 대댓글들)을 통째로 숨김
  function hideEmptyCommentGroups() {
    const cont = document.getElementById('comment');
    if (!cont) return;
    const lis = [...cont.querySelectorAll('li[id^="comment_li_"]')];
    let i = 0;
    while (i < lis.length) {
      const top = lis[i];
      if (isSubComment(top)) { i++; continue; }
      let j = i + 1;
      const group = [top];
      while (j < lis.length && isSubComment(lis[j])) group.push(lis[j++]);
      if (!top.dataset.uwgrp) {
        top.dataset.uwgrp = '1';
        if (group.every(isZeroComment)) group.forEach(el => el.classList.add('uw-cmt-hide'));
      }
      i = j;
    }
  }

  /* ──────────────────────────────────────────────────────────
   * 7. 게시글: 읽음 표시 / 필터 (Posts)
   * ────────────────────────────────────────────────────────── */

  function postNum(el) {
    if (el.id && el.id.startsWith('post_')) return el.id.slice(5);
    return el.querySelector('.list_body_href')?.dataset.number || '';
  }

  // 사이트의 읽음 표시 함수를 강제 호출.
  //   더보기로 추가된 글은 사이트 자동 표시가 누락/지연될 수 있어 직접 찍어준다.
  function applyReadMark(el) {
    if (typeof window.check_read_mark !== 'function') return;
    const num = postNum(el);
    if (num) { try { window.check_read_mark(table, String(num)); } catch {} }
  }

  // 뒤로가기(bfcache) 복귀 시: 그새 읽은 글이 생겼을 수 있으므로 전체 읽음 표시 재적용.
  function refreshAllReadMarks() {
    for (const el of document.querySelectorAll('.post_item')) applyReadMark(el);
  }

  // OK(추천) 수 기준 필터: 통과한 글에만 uw-ok 부여(스타일로 노출)
  function classifyFilter(el, okEl) {
    const ok = countDigits(okEl.textContent);
    const title = el.querySelector('.link_hover')?.textContent || '';
    const matchedExempt = filterRule.exemptKeywords.some(k => title.includes(k));
    if (matchedExempt || ok > filterRule.threshold) el.classList.add('uw-ok');
    if (matchedExempt && /ai/i.test(title)) el.classList.add('uw-ai-dim');
  }

  // 게시글 단일 패스: 신규 글 읽음 표시·카운트 + OK 필터 분류.
  let seenTotal = 0; // 누적 본 글 수(더보기 재클릭 준비 판정에 사용)
  function scanPosts() {
    for (const el of document.querySelectorAll('.post_item')) {
      if (el.dataset.uwseen !== '1') {
        el.dataset.uwseen = '1';
        seenTotal++;
        applyReadMark(el);
      }
      if (filterRule && el.dataset.uwfiltered !== '1') {
        const okEl = el.querySelector('.ok_num');
        if (okEl) { el.dataset.uwfiltered = '1'; classifyFilter(el, okEl); }
      }
    }
    scheduleSaveNavList();
  }

  /* ──────────────────────────────────────────────────────────
   * 7-1. 필터/검색 기준 이전글·다음글 (Filtered prev/next)
   *
   *  - 목록 페이지(필터 적용 게시판 또는 검색 결과)에서 "보이는 글" 순서를 sessionStorage에 저장.
   *    더보기로 불러온 글까지 포함. 목록 주소와 페이지 범위(firstPg~lastPg)도 함께 저장.
   *  - 글 페이지에서 현재 글이 그 목록에 있으면:
   *      ▲ 다음글 = 목록에서 바로 위 글, ▼ 이전글 = 바로 아래 글 로 교체
   *      (하단 다음글/이전글 블록 2곳 + 제목 옆 ▲/▼ 버튼)
   *  - 현재 글이 저장된 목록의 끝(페이지 경계)이면 이웃 페이지(pg±1)를 백그라운드로 불러와
   *    같은 필터를 적용한 뒤 목록에 이어 붙인다. (필터로 전부 걸러지면 최대 NAV_FETCH_MAX 페이지까지)
   *    불러오는 동안 해당 버튼은 숨김, 끝까지 없으면 계속 숨김.
   *  - 목록에 없는 글(다른 경로로 진입)은 사이트 기본 동작 유지.
   *  - 블록의 날짜·댓글 수·조회수는 목록에서 알 수 없어 숨기고, 제목·작성자·추천만 표시.
   * ────────────────────────────────────────────────────────── */

  const NAV_KEY = (t) => `uw-nav:${t}`;
  const NAV_FETCH_MAX = 5; // 이웃 페이지 탐색 최대 횟수(필터로 전부 걸러질 때)
  let navSaveTimer = 0;

  function scheduleSaveNavList() {
    clearTimeout(navSaveTimer);
    navSaveTimer = setTimeout(saveNavList, 250);
  }

  // 원본 쿼리 문자열에서 pg 값 읽기/바꾸기(EUC-KR sk가 깨지지 않게 URLSearchParams 사용 안 함)
  function getPg(url) {
    const m = String(url).match(/[?&]pg=(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }
  function setPg(url, pg) {
    const u = String(url).replace(/#.*$/, '');
    return /[?&]pg=\d+/.test(u) ? u.replace(/([?&])pg=\d+/, `$1pg=${pg}`) : `${u}${u.includes('?') ? '&' : '?'}pg=${pg}`;
  }

  // 제목: .link_hover가 없을 수 있는 경우(불러온 페이지 등) 글 링크 텍스트로 대체
  function rowTitle(el) {
    return (el.querySelector('.link_hover')?.textContent
      || el.querySelector('a[href*="read.html"]')?.textContent
      || '').trim();
  }

  // 페이지 번호 링크 수집: { "2": "list.html?...pg=2...", ... } (주소 추측 대신 실제 링크 사용)
  function collectPageLinks(root, baseUrl) {
    const links = {};
    for (const a of root.querySelectorAll('a[href*="list.html"]')) {
      const t = a.textContent.trim();
      if (/^\d{1,3}$/.test(t)) links[t] = new URL(a.getAttribute('href'), baseUrl).href;
    }
    return links;
  }

  // 필터 통과 여부(현재 페이지·불러온 페이지 공통)
  function rowPasses(el) {
    if (!filterRule) return true;
    if (el.classList.contains('uw-ok')) return true;
    if (el.dataset.uwfiltered === '1') return false;
    const ok = countDigits(el.querySelector('.ok_num')?.textContent || '');
    return filterRule.exemptKeywords.some((k) => rowTitle(el).includes(k)) || ok > filterRule.threshold;
  }

  function rowToItem(el, baseUrl) {
    const n = postNum(el);
    if (!n) return null;
    // 일반 목록은 행 링크가 read.html이 아닐 수 있음(스크립트 클릭 방식) → 번호로 주소 생성
    const a = el.querySelector('a[href*="read.html"]');
    const href = a
      ? new URL(a.getAttribute('href'), baseUrl).href
      : new URL(`/board/read.html?table=${encodeURIComponent(table)}&number=${n}`, baseUrl).href;
    const txt = (sel) => el.querySelector(sel)?.textContent.trim() || '';
    return {
      n: String(n),
      href,
      title: rowTitle(el),
      ok: countDigits(txt('.ok_num')),
      notok: el.querySelector('.not_ok_num') ? countDigits(txt('.not_ok_num')) : null,
      nick: txt('.hu_nick_txt') || txt('.nick'),
    };
  }

  function rowsToItems(root, baseUrl) {
    const items = [];
    for (const el of root.querySelectorAll('.post_item')) {
      if (!rowPasses(el)) continue;
      const it = rowToItem(el, baseUrl);
      if (it) items.push(it);
    }
    return items;
  }

  function saveNavList() {
    if (!isList) return;
    const searching = /[?&]sk=[^&]/.test(location.search);
    if (!filterRule && !searching) {               // 필터도 검색도 아니면 사이트 기본 순서와 같음
      try { sessionStorage.removeItem(NAV_KEY(table)); } catch {}
      return;
    }
    const listUrl = location.href.replace(/#.*$/, '');
    const firstPg = getPg(listUrl);
    const pageLinks = collectPageLinks(document, location.href);
    // 더보기 방식 목록(페이지 번호 링크 없음)일 때만: 마지막으로 불러온 페이지 = (다음 페이지 번호 - 1)
    let lastPg = firstPg;
    const hasPaging = Object.keys(pageLinks).length > 0;
    if (!hasPaging && document.getElementById('btn_load_more')) {
      const nextSpan = parseInt(document.getElementById('list_container_next_page_span')?.textContent || '', 10);
      if (Number.isFinite(nextSpan) && nextSpan > firstPg) lastPg = nextSpan - 1;
    }
    const items = rowsToItems(document, location.href);
    saveNavCtx({ at: Date.now(), listUrl, firstPg, lastPg, pageLinks, items });
  }

  function saveNavCtx(ctx) {
    try { sessionStorage.setItem(NAV_KEY(table), JSON.stringify(ctx)); } catch {}
  }
  function loadNavList() {
    try { return JSON.parse(sessionStorage.getItem(NAV_KEY(table)) || 'null'); } catch { return null; }
  }

  // 목록 페이지 하나를 받아서(EUC-KR) 필터 통과 글 목록으로 변환. 글이 하나도 없으면 null(끝).
  async function fetchListPage(ctx, pg) {
    const url = ctx.pageLinks?.[String(pg)] || setPg(ctx.listUrl, pg);
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    let html;
    try { html = new TextDecoder('euc-kr').decode(buf); } catch { html = new TextDecoder().decode(buf); }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc.querySelector('.post_item')) return null;
    ctx.pageLinks = { ...collectPageLinks(doc, url), ...(ctx.pageLinks || {}) }; // 다음 페이지 링크 누적
    return rowsToItems(doc, url);
  }

  // dir=+1: 다음 페이지(더 오래된 글)를 뒤에, dir=-1: 이전 페이지(더 최신 글)를 앞에 붙임
  async function extendNav(ctx, dir) {
    for (let i = 0; i < NAV_FETCH_MAX; i++) {
      const pg = dir > 0 ? ctx.lastPg + 1 : ctx.firstPg - 1;
      if (pg < 1 || (dir > 0 && pg > MAX_LOAD_MORE_PAGE * 4)) return false;
      let got;
      try { got = await fetchListPage(ctx, pg); } catch { return false; }
      if (!got) return false; // 마지막 페이지 지남
      if (dir > 0) ctx.lastPg = pg; else ctx.firstPg = pg;
      const known = new Set(ctx.items.map((it) => it.n));
      const fresh = got.filter((it) => !known.has(it.n)); // 새 글 등록으로 밀린 중복 제거
      if (fresh.length) {
        ctx.items = dir > 0 ? ctx.items.concat(fresh) : fresh.concat(ctx.items);
        saveNavCtx(ctx);
        return true;
      }
    }
    return false;
  }

  // 하단 다음글/이전글 li 하나를 item 내용으로 교체
  function fillNavLi(li, item) {
    li.id = `li_chk_${table}-${item.n}`;
    const a = li.querySelector('a');
    if (a) a.href = item.href;
    const dd = li.querySelector('dd');
    if (dd) dd.textContent = item.title;
    const meta = dd?.nextElementSibling;
    if (meta) {
      for (const sp of meta.querySelectorAll('.extra, .comment_num')) css(sp, { display: 'none' });
      const nick = meta.querySelector('.nick');
      if (nick) { if (item.nick) { nick.textContent = item.nick; nick.style.removeProperty('display'); } else css(nick, { display: 'none' }); }
      const ok = meta.querySelector('.ok_num');
      if (ok?.lastChild?.nodeType === 3) ok.lastChild.data = ` ${item.ok}`;
      const notok = meta.querySelector('.not_ok_num');
      if (notok) {
        if (item.notok == null) css(notok, { display: 'none' });
        else if (notok.lastChild?.nodeType === 3) notok.lastChild.data = ` ${item.notok}`;
      }
    }
  }

  // 방향(isUp)별 버튼에 item 적용. item이 null이면 숨김.
  function renderNav(isUpTarget, item) {
    for (const li of document.querySelectorAll('li.next_prev_li')) {
      const isUp = (li.querySelector('.btn')?.textContent || '').includes('다음글');
      if (isUp !== isUpTarget) continue;
      if (item) { fillNavLi(li, item); li.style.removeProperty('display'); }
      else css(li, { display: 'none' });
    }
    for (const sp of document.querySelectorAll('span.top_btn')) {
      const isUp = sp.textContent.includes('▲');
      if (isUp !== isUpTarget) continue;
      const a = sp.closest('a');
      if (!a) continue;
      if (item) { a.href = item.href; sp.id = `li_chk_${table}-${item.n}`; a.style.removeProperty('visibility'); }
      else css(a, { visibility: 'hidden' }); // 자리는 유지(맨밑 버튼 위치 고정)
    }
    if (item && typeof window.check_read_mark === 'function') {
      try { window.check_read_mark(table, item.n); } catch {}
    }
  }

  async function applyFilteredNav() {
    if (!isRead || !table) return;
    if (document.documentElement.dataset.uwNav) return;
    if (!document.querySelector('li.next_prev_li, span.top_btn')) return; // 아직 파싱 전

    const ctx = loadNavList();
    const cur = params.get('number');
    document.documentElement.dataset.uwNav = '1';
    if (!ctx?.items || ctx.items.findIndex((it) => it.n === cur) < 0) return; // 목록에 없는 글 → 기본 동작 유지
    ctx.firstPg ||= 1; ctx.lastPg ||= ctx.firstPg;

    const idxOf = () => ctx.items.findIndex((it) => it.n === cur);
    let i = idxOf();
    renderNav(true, ctx.items[i - 1] || null);  // ▲ 다음글(더 최신)
    renderNav(false, ctx.items[i + 1] || null); // ▼ 이전글(더 오래됨)

    // 페이지 경계면 이웃 페이지를 불러와 이어 붙임
    if (!ctx.items[i + 1] && await extendNav(ctx, +1)) {
      i = idxOf();
      renderNav(false, ctx.items[i + 1] || null);
    }
    if (!ctx.items[i - 1] && ctx.firstPg > 1 && await extendNav(ctx, -1)) {
      i = idxOf();
      renderNav(true, ctx.items[i - 1] || null);
    }
  }

  /* ── 이전글·다음글 블록 중복 정리 ──
   *  글 페이지엔 같은 블록이 본문 아래·댓글 아래 2곳에 있음. 댓글이 없거나(숨김 포함) 짧아서
   *  두 블록이 한 화면에 같이 보이면 위쪽 블록을 숨김. 댓글이 늘어나면 다시 표시.
   *  위쪽 블록 바로 뒤에 높이 0 표식을 두고 "표식 ~ 아래 블록" 간격으로 판단 → 숨겨도 측정값이 같아 깜빡이지 않음.
   */
  const NAV_DUP_GAP_RATIO = 0.6; // 두 블록 사이 내용이 화면 높이의 60% 미만이면 위쪽 숨김

  function dedupeNavBlocks() {
    if (!isRead) return;
    const blocks = [];
    for (const li of document.querySelectorAll('li.next_prev_li')) {
      const b = li.parentElement;
      if (b && !blocks.includes(b)) blocks.push(b);
    }
    if (blocks.length < 2) return;
    const [upper, lower] = blocks;
    let mark = upper.nextElementSibling;
    if (!mark || mark.tagName !== 'UW-MARK') {
      mark = el('uw-mark', { display: 'block', height: '0', overflow: 'hidden' });
      upper.after(mark);
    }
    const gap = lower.getBoundingClientRect().top - mark.getBoundingClientRect().top;
    const hide = gap < window.innerHeight * NAV_DUP_GAP_RATIO;
    if (hide) css(upper, { display: 'none' });
    else upper.style.removeProperty('display');
  }

  /* ──────────────────────────────────────────────────────────
   * 8. 더보기 자동 클릭 (Auto load-more)
   * ────────────────────────────────────────────────────────── */

  // "다시 누를 준비됨"을 4개 신호의 OR로 판정 → 사이트 동작 변화에 견고:
  //   (1) 누적 본 글 수 증가  (2) 다음 페이지 번호 변화  (3) 버튼 요소 교체
  //   (4) 마지막 클릭 후 LOAD_MORE_RETRY_MS 경과(클릭이 무시된 경우 재시도)
  //
  //  버그 원인: document-start로 바뀐 뒤 사이트 스크립트가 더보기 핸들러를 붙이기 전에
  //  먼저 클릭 → 클릭이 무시됐는데 (1)~(3)이 영원히 바뀌지 않아 다시 누르지 않던 문제.
  //  → load 직후 즉시 재시도 + (4) 안전망 재시도 + 주기적 확인으로 해결.
  let lastSeen = -1, lastPage = null, lastBtn = null, lastClickAt = 0;
  function tryClickLoadMore() {
    if (!isList) return;

    const btn = document.getElementById('btn_load_more');
    if (!btn || btn.disabled || !btn.offsetParent) return;
    const r = btn.getBoundingClientRect();
    if (r.height === 0 || r.bottom < 0 || r.top > window.innerHeight * LOAD_MORE_AHEAD) return;

    const span = document.getElementById('list_container_next_page_span');
    const page = span ? span.textContent.trim() : '';
    const pageNum = parseInt(page, 10);
    if (Number.isFinite(pageNum) && pageNum > MAX_LOAD_MORE_PAGE) return;

    const ready = lastSeen < 0
      || seenTotal > lastSeen
      || (page && page !== lastPage)
      || btn !== lastBtn
      || Date.now() - lastClickAt > LOAD_MORE_RETRY_MS;
    if (!ready) return;

    lastSeen = seenTotal; lastPage = page; lastBtn = btn; lastClickAt = Date.now();
    btn.click();
  }

  function initLoadMore() {
    if (!isList) return;
    let scrollRaf = 0; // 스크롤 이벤트마다 레이아웃 읽기 방지 → 프레임당 1회
    window.addEventListener('scroll', () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; tryClickLoadMore(); });
    }, { passive: true });
    // 사이트 핸들러가 준비된 뒤: 이전 클릭(무시됐을 수 있음) 기록을 지우고 즉시 다시 시도
    window.addEventListener('load', () => { lastSeen = -1; tryClickLoadMore(); });
    setInterval(() => { if (!document.hidden) tryClickLoadMore(); }, LOAD_MORE_TICK_MS);
  }

  /* ──────────────────────────────────────────────────────────
   * 9. 유틸 (Utils)
   * ────────────────────────────────────────────────────────── */

  function countDigits(text) {
    return parseInt(String(text).replace(/[^0-9]/g, ''), 10) || 0;
  }

  /* ──────────────────────────────────────────────────────────
   * 9-1. header-bar 보정 (구 "header-bar inert 제거 + z-index 설정" 스크립트 통합)
   *  - #header-bar의 inert 속성 제거(터치·클릭 가능하게), z-index 9 고정.
   *  - 사이트가 다시 inert/style을 바꾸면 즉시 되돌림(해당 속성 변경만 감시).
   * ────────────────────────────────────────────────────────── */

  function fixHeaderBar() {
    const el = document.getElementById('header-bar');
    if (!el) return;
    if (el.hasAttribute('inert')) el.removeAttribute('inert');
    if (el.style.zIndex !== '9') el.style.zIndex = '9';
  }

  function initHeaderBarFix() {
    fixHeaderBar();
    new MutationObserver(fixHeaderBar).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['inert', 'style', 'id'],
    });
  }

  /* ──────────────────────────────────────────────────────────
   * 9-2. 새 버전 알림 (로더 사용 시)
   *  - 로더가 새 버전을 받아 저장하면 'uw-loader:updated' 이벤트 → 상단 메뉴 바로 아래 알림.
   *  - 이미 저장돼 있는데 아직 적용 안 된 경우(이전 페이지에서 받음)도 페이지 열 때 알림.
   *  - 알림을 탭하면 새로고침해서 즉시 적용.
   * ────────────────────────────────────────────────────────── */

  const versionOfCode = (code) => (String(code || '').match(/@version\s+([\w.\-]+)/) || [])[1] || '';

  function showUpdateBanner(ver) {
    const show = () => {
      if (!document.body || document.querySelector('uw-update')) return;
      const b = el('uw-update', {
        display: 'block', position: 'fixed', left: '50%', top: '48px', transform: 'translateX(-50%)',
        'z-index': '2147483645', padding: '8px 14px', 'border-radius': '18px',
        background: '#ff5a5a', color: '#fff', 'font-size': '13px', 'font-weight': 'bold',
        'white-space': 'nowrap', 'box-shadow': '0 4px 14px rgba(0,0,0,.4)', cursor: 'pointer',
      });
      b.textContent = `새 버전 v${ver} · 탭하여 적용`;
      b.addEventListener('click', () => location.reload());
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 10000);
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show, { once: true });
  }

  function initUpdateNotice() {
    window.addEventListener('uw-loader:updated', (e) => {
      if (e.detail) e.detail.handled = true;
      showUpdateBanner(e.detail?.version || '');
    });
    let stored = null;
    try { stored = localStorage.getItem('uw-loader:code'); } catch {}
    const v = versionOfCode(stored);
    if (v && v !== SCRIPT_VERSION) showUpdateBanner(v);
  }

  /* ──────────────────────────────────────────────────────────
   * 10. 메인 루프 / 생명주기 (Lifecycle)
   * ────────────────────────────────────────────────────────── */

  const OBS_CONFIG = { childList: true, subtree: true };
  // 스크립트가 만든 UI(uw-*) 내부 변경은 무시 → 재생 중 불필요한 전체 스캔 방지
  const OWN_UI_SEL = 'uw-mini, uw-navi, uw-search';
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.target instanceof Element ? m.target : m.target.parentElement;
      if (!t || !t.closest(OWN_UI_SEL)) { scheduleProcess(); return; }
    }
  });

  let rafId = 0;
  function scheduleProcess() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; process(); });
  }

  function process() {
    highlightLowReactionComments();
    hideEmptyCommentGroups();
    hookVideos();
    hookThumbs();
    injectNaviSearch();
    applyFilteredNav();
    dedupeNavBlocks();
    if (!isList) return;
    scanPosts();
    tryClickLoadMore();
  }

  // ── 부팅 ──
  //  @run-at document-start: 페이지가 그려지기 전에 스타일을 넣어 깜빡임을 없앤다.
  //   1) 즉시: 스타일 주입 + 이벤트 리스너 등록
  //   2) #navi가 파싱되는 즉시: 내비 교체(원래 내비는 CSS로 이미 숨김 상태)
  //   3) DOMContentLoaded: 나머지 DOM 처리 시작

  function watchNavi() {
    const tryNavi = () => {
      if (!document.querySelector('#navi > .flex-container')) return false;
      injectNaviSearch();
      return true;
    };
    if (tryNavi()) return;
    const mo = new MutationObserver(() => { if (tryNavi()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { tryNavi(); mo.disconnect(); }, { once: true });
  }

  function start() {
    process();
    booted = true; // 이후 hookVideos에서 만나는 영상은 "나중에 삽입된 영상"
    obs.observe(document.body, OBS_CONFIG);
  }

  injectStyles();
  initSinglePlayback(); // 자동재생보다 먼저 등록해야 초기 중복 재생을 잡음
  initSeekGesture();
  initTapToggle();
  initAutoUnmute();
  watchNavi();
  initLoadMore();
  initHeaderBarFix();
  window.addEventListener('resize', () => { if (document.body) dedupeNavBlocks(); }, { passive: true });
  initUpdateNotice();
  window.addEventListener('pageshow', (e) => {
    if (!document.body) return;
    refreshAllReadMarks();
    process();
    if (e.persisted && !soundBlocked) for (const v of allVideos()) unmute(v); // bfcache 복귀 시 재적용
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
