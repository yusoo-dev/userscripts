// ==UserScript==
// @name         웃대
// @namespace    https://greasyfork.org/users/your-username
// @version      1.46.4
// @description  레이아웃 정리, 더보기 자동 클릭(최대 50p, 목록 페이지 전용), OK 수 기준 게시글 숨기기, ㅇㅎ/ㅎㅂ AI글 흐리게, 댓글 강조/0추천·0비추천 그룹 숨김, 답글 베스트 박스 숨김, 상세페이지 하단 목록 숨김, 상단 내비(게시판 이동·ㅇㅎ/ㅎㅂ·검색 팝업), 동영상 소리 자동 켜기·단일 재생·탭 재생/정지·길게 눌러 2배속·화면 노출 자동재생(MP4 썸네일 자동 펼침)·미니 컨트롤 바·같은 영상 재생 위치 동기화, 필터/검색 기준 이전글·다음글, 불필요 요소 숨김·header-bar 보정, 작성자 차단
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
    { label: '웃자', name: '웃긴자료', table: 'pds' },
    { label: '대자', name: '대기자료', table: 'pdswait' },
    { label: '얼인', name: '얼굴인식', table: 'face' },
    { label: '패션', name: '패션', table: 'fashion' },
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
  const SCRIPT_VERSION = '1.46.4';
  const SHOW_VERSION = true; // 상단 오른쪽 끝 버전 표시

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
      #navi > .flex-container > :not(uw-navi):not(uw-ver) { display: none !important; }
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

      /* 베스트 탭 줄(오늘의/주간/월간/연간/추천수 500) — 목록·글 화면 모두 숨김 */
      #list_top { display: none !important; }

      /* 차단한 작성자의 글 숨김(게시판별 목록) */
      .post_item.uw-blocked { display: none !important; }
      /* 차단 선택 모드: 글 행 강조 */
      html.uw-picking .post_item { outline: 1px dashed rgba(255,90,90,.7) !important; outline-offset: -3px !important; }

      /* ㅇㅎ/ㅎㅂ 글 중 제목에 'ai' 포함: 숨기지 않고 흐리게 */
      .post_item.uw-ai-dim { opacity: 0.3 !important; }

      /* 상세(read) 페이지: 하단 목록 네비/컨테이너/더보기 숨김 (목록 페이지엔 영향 없음) */
      html.uw-read #list_container_navi,
      html.uw-read #list_container,
      html.uw-read #btn_load_more_div { display: none !important; }

      /* 빠른 검색 버튼: 현재 검색어와 일치하면 강조 */
      #navi .uw-qs.uw-qs-on { color: #ff5a5a !important; border-color: #ff5a5a !important; }
      /* 볼 새 글이 있는 버튼: 연두색 글씨 */
      #navi .uw-qs.uw-has-new { color: #9be15d !important; }

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

    // 최근: 웃긴자료에서 마지막으로 읽은 글의 바로 다음(더 최신) 글로 이동 — 밀린 글 이어 읽기
    const recentBtn = navBtn('최근', '#', false);
    recentBtn.dataset.uwNewKey = NEW_KEY_RECENT;
    recentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      goNextUnread(recentBtn);
    });
    bar.appendChild(recentBtn);

    // 게시판 버튼(현재 게시판 제외)
    for (const b of NAVI_BOARDS) {
      if (b.table === table) continue;
      const bb = navBtn(b.label, `/board/list.html?table=${b.table}`, false);
      // 새 글(연두색) 표시 제외: 웃자는 '최근'이 담당, 대자는 표시 안 함
      if (!NEW_MARK_EXCLUDE.includes(b.table)) { bb.dataset.uwNewKey = listKey(b.table, ''); bindUnreadJump(bb); }
      bar.appendChild(bb);
    }

    // ㅇㅎ / ㅎㅂ
    const currentSk = currentRawSk().toUpperCase();
    for (const { label, sk } of QUICK_SEARCH_KEYWORDS) {
      const qb = navBtn(label, buildSearchUrl(sk), currentSk === sk.toUpperCase());
      qb.dataset.uwNewKey = listKey(SEARCH_TABLE, sk);
      bindUnreadJump(qb);
      bar.appendChild(qb);
    }

    // 검색 버튼 → 검색 팝업
    const searchBtn = navBtn('검색', '#', false);
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openSearchModal(); // 클릭 핸들러 안에서 바로 focus해야 모바일 키보드가 뜸
    });
    bar.appendChild(searchBtn);

    // 목록 화면: 작성자 차단 설정
    if (isList) {
      const blockBtn = navBtn(blockedNicks().size ? `차단 ${blockedNicks().size}` : '차단', '#', false);
      blockBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setBlockPick(!blockPick, blockBtn); // 차단 선택 모드 켜기/끄기
      });
      bar.appendChild(blockBtn);
    }

    root.appendChild(bar);
    applyNewMarks(); // 저장된 새 글 여부를 바로 표시(깜빡임 없이), 최신 확인은 페이지 로드 후

    // 버전: 메뉴 줄 오른쪽 끝에 고정(버튼이 많아 가로 스크롤돼도 항상 보이게 메뉴 밖에 겹쳐 둠)
    if (SHOW_VERSION) {
      const ver = el('uw-ver', {
        display: 'flex', 'align-items': 'center', position: 'absolute', right: '0', top: '0', bottom: '0',
        padding: '0 6px 0 10px', color: '#777', 'font-size': '10px', 'white-space': 'nowrap',
        background: 'linear-gradient(to right, rgba(34,34,34,0), #222 8px)', 'pointer-events': 'none',
      });
      ver.textContent = `v${SCRIPT_VERSION}`;
      root.appendChild(ver);
      css(bar, { 'padding-right': '52px' }); // 마지막 버튼이 버전 글자에 가리지 않게
    }
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
    let tableInput = null;
    for (const [name, value] of [['table', SEARCH_TABLE], ['st', 'subject'], ['searchday', SEARCH_DAY]]) {
      const h = document.createElement('input');
      h.type = 'hidden'; h.name = name; h.value = value;
      if (name === 'table') tableInput = h;
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

    return { backdrop, input, tableInput, open: false };
  }

  // targetTable: 검색할 게시판(기본: 대기자료). 플로팅 버튼은 현재 게시판을 넘김.
  function openSearchModal(targetTable = SEARCH_TABLE) {
    searchModal ||= buildSearchModal();
    if (searchModal.open) return;
    searchModal.open = true;
    const name = NAVI_BOARDS.find((b) => b.table === targetTable)?.name || '게시판';
    searchModal.tableInput.value = targetTable;
    searchModal.input.placeholder = `${name} 제목 검색`;
    if (targetTable !== SEARCH_TABLE && searchModal.input.dataset.forTable !== targetTable) searchModal.input.value = '';
    searchModal.input.dataset.forTable = targetTable;
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

  /* ── 작성자 차단 ──
   *  [차단] 버튼 → 목록의 글 선택 → 그 글 작성자 차단. (닉네임 직접 편집은 '목록 관리')
   *  게시판별로 따로 적용·저장(localStorage, 키: uw-blocked-nicks:<table>).
   *  필터/검색 기준 이전글·다음글에서도 제외됨.
   */
  // 게시판(table)별로 따로 저장·적용. 예: 대기자료에서 차단한 사람은 대기자료 목록에서만 숨김.
  const BLOCK_KEY_LEGACY = 'uw-blocked-nicks';            // 예전(전체 공통) 목록
  const BLOCK_KEY = () => `uw-blocked-nicks:${table || '_'}`;
  let blockedCache = null;

  function blockedNicks() {
    if (!blockedCache) {
      let raw = null;
      try {
        raw = localStorage.getItem(BLOCK_KEY());
        // 처음 쓰는 게시판: 예전 공통 목록으로 시작(기존 동작 유지). 이후엔 게시판마다 따로 편집.
        if (raw == null) raw = localStorage.getItem(BLOCK_KEY_LEGACY);
      } catch {}
      let arr = [];
      try { arr = JSON.parse(raw || '[]'); } catch {}
      blockedCache = new Set(arr.map((n) => String(n).trim()).filter(Boolean));
    }
    return blockedCache;
  }

  function saveBlockedNicks(list) {
    const uniq = [...new Set(list.map((n) => String(n).trim()).filter(Boolean))];
    try { localStorage.setItem(BLOCK_KEY(), JSON.stringify(uniq)); } catch {}
    blockedCache = new Set(uniq);
  }

  const boardLabel = () => NAVI_BOARDS.find((b) => b.table === table)?.name || '이 게시판';

  function rowNick(el) {
    for (const sel of ['.hu_nick_txt', '.nick', '[class*="nick"]']) { // 우선순위 순서대로
      const t = el.querySelector(sel)?.textContent.trim();
      if (t) return t;
    }
    return '';
  }

  function isBlockedRow(el) {
    const set = blockedNicks();
    return set.size > 0 && set.has(rowNick(el));
  }

  let blockModal = null;

  function openBlockModal(btn) {
    if (!blockModal) {
      const backdrop = el('uw-block', {
        display: 'none', position: 'fixed', inset: '0', 'z-index': '2147483000',
        background: 'rgba(0,0,0,.6)', 'align-items': 'flex-start', 'justify-content': 'center',
        'padding-top': '14vh',
      });
      const box = el('div', {
        display: 'flex', 'flex-direction': 'column', gap: '8px', width: 'min(92vw, 420px)',
        padding: '12px', background: '#2a2a2a', 'border-radius': '12px',
        'box-shadow': '0 8px 30px rgba(0,0,0,.5)',
      });
      const title = el('div', { display: 'block', color: '#eee', 'font-size': '15px', 'font-weight': 'bold' });
      title.textContent = `작성자 차단 · ${boardLabel()}`;
      const hint = el('div', { display: 'block', color: '#999', 'font-size': '12px', 'line-height': '1.4' });
      hint.textContent = `닉네임을 한 줄에 하나씩 입력하세요. ${boardLabel()} 목록에서만 해당 작성자의 글이 숨겨집니다.`;
      const ta = el('textarea', {
        display: 'block', width: '100%', height: '160px', padding: '8px 10px',
        'border-radius': '8px', border: '1px solid #555', background: '#1b1b1b',
        color: '#eee', 'font-size': '16px', 'line-height': '1.5', outline: 'none', resize: 'vertical',
      });
      ta.placeholder = '닉네임1\n닉네임2';
      const row = el('div', { display: 'flex', gap: '8px' });
      const mk = (label, bg) => {
        const b = el('button', {
          display: 'block', flex: '1 1 auto', height: '42px', 'border-radius': '8px',
          background: bg, color: '#fff', 'font-size': '15px', 'font-weight': 'bold', cursor: 'pointer',
        });
        b.type = 'button'; b.textContent = label;
        return b;
      };
      const cancel = mk('취소', '#555');
      const ok = mk('확인', '#ff5a5a');
      row.append(cancel, ok);
      const backupLink = el('button', {
        display: 'block', 'align-self': 'flex-end', height: '28px', padding: '0 4px', background: 'transparent',
        color: '#8ab4f8', 'font-size': '12px', 'text-decoration': 'underline', cursor: 'pointer',
      });
      backupLink.type = 'button';
      backupLink.textContent = '설정 백업 · 복원';
      backupLink.addEventListener('click', () => { close(); openBackupModal(); });
      box.append(title, hint, ta, row, backupLink);
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);

      const close = () => { css(backdrop, { display: 'none' }); ta.blur(); };
      cancel.addEventListener('click', close);
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
      ok.addEventListener('click', () => {
        saveBlockedNicks(ta.value.split(/[\n,]/));
        close();
        applyBlockedToRows();
        if (blockModal.btn) { pickBtn = blockModal.btn; updateBlockBtnLabel(); }
      });
      blockModal = { backdrop, ta, btn: null };
    }
    blockModal.btn = btn;
    blockModal.ta.value = [...blockedNicks()].join('\n');
    css(blockModal.backdrop, { display: 'flex' });
    blockModal.ta.focus();
  }

  /* ── 설정 백업 · 복원 ──
   *  차단 목록, 읽은 위치·읽은 글, 새 글 기준, [최근] 기록을 한 덩어리 텍스트(JSON)로 내보내고 가져옴.
   *  다른 기기·브라우저로 옮기거나 브라우저 데이터 삭제에 대비.
   */
  const BACKUP_PREFIXES = ['uw-blocked-nicks', 'uw-seen:', 'uw-read:', 'uw-last-read:'];

  function exportSettings() {
    const data = {};
    try {
      for (const k of Object.keys(localStorage)) {
        if (BACKUP_PREFIXES.some((p) => k.startsWith(p))) data[k] = localStorage.getItem(k);
      }
    } catch {}
    return JSON.stringify({ app: 'uw-humoruniv', v: 1, at: new Date().toISOString(), data });
  }

  function importSettings(text) {
    const obj = JSON.parse(text);
    if (obj?.app !== 'uw-humoruniv' || typeof obj.data !== 'object') throw new Error('형식이 맞지 않아요');
    let n = 0;
    for (const [k, v] of Object.entries(obj.data)) {
      if (!BACKUP_PREFIXES.some((p) => k.startsWith(p)) || typeof v !== 'string') continue;
      localStorage.setItem(k, v);
      n++;
    }
    for (const k of Object.keys(localStorage)) if (k.startsWith('uw-new:')) localStorage.removeItem(k); // 새 글 표시 재계산
    blockedCache = null;
    return n;
  }

  function openBackupModal() {
    const backdrop = el('uw-backup', {
      display: 'flex', position: 'fixed', inset: '0', 'z-index': '2147483000',
      background: 'rgba(0,0,0,.6)', 'align-items': 'flex-start', 'justify-content': 'center', 'padding-top': '10vh',
    });
    const box = el('div', {
      display: 'flex', 'flex-direction': 'column', gap: '8px', width: 'min(92vw, 420px)',
      padding: '12px', background: '#2a2a2a', 'border-radius': '12px', 'box-shadow': '0 8px 30px rgba(0,0,0,.5)',
    });
    const title = el('div', { display: 'block', color: '#eee', 'font-size': '15px', 'font-weight': 'bold' });
    title.textContent = '설정 백업 · 복원';
    const hint = el('div', { display: 'block', color: '#999', 'font-size': '12px', 'line-height': '1.4' });
    hint.textContent = '복사한 내용을 메모장 등에 보관하세요. 복원하려면 보관한 내용을 붙여넣고 [가져오기]를 누르세요.';
    const ta = el('textarea', {
      display: 'block', width: '100%', height: '180px', padding: '8px', 'border-radius': '8px',
      border: '1px solid #555', background: '#1b1b1b', color: '#ddd', 'font-size': '12px',
      'font-family': 'monospace', outline: 'none', resize: 'vertical',
    });
    ta.value = exportSettings();
    const row = el('div', { display: 'flex', gap: '8px' });
    const mk = (label, bg) => {
      const b = el('button', {
        display: 'block', flex: '1 1 auto', height: '42px', 'border-radius': '8px',
        background: bg, color: '#fff', 'font-size': '14px', 'font-weight': 'bold', cursor: 'pointer',
      });
      b.type = 'button'; b.textContent = label;
      return b;
    };
    const copy = mk('복사', '#555');
    const imp = mk('가져오기', '#ff5a5a');
    const close = mk('닫기', '#444');
    row.append(copy, imp, close);
    box.append(title, hint, ta, row);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(ta.value); }
      catch { ta.select(); document.execCommand('copy'); }
      copy.textContent = '복사됨 ✓';
    });
    imp.addEventListener('click', () => {
      try {
        const n = importSettings(ta.value.trim());
        imp.textContent = `${n}개 항목 복원 ✓`;
        setTimeout(() => location.reload(), 600);
      } catch (e) {
        imp.textContent = '형식 오류';
        setTimeout(() => { imp.textContent = '가져오기'; }, 1500);
      }
    });
    close.addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  }

  /* ── 차단 선택 모드 ──
   *  [차단] → 상단 안내 바 표시 → 목록의 글을 누르면 그 글 작성자 차단(확인 후) → 모드 종료.
   *  안내 바: [목록 관리](닉네임 직접 편집/해제) [취소]
   */
  let blockPick = false;
  let pickBar = null;
  let pickBtn = null;

  function updateBlockBtnLabel() {
    const n = blockedNicks().size;
    const span = pickBtn?.querySelector('span');
    if (span) span.textContent = n ? `차단 ${n}` : '차단';
  }

  function setBlockPick(on, btn) {
    if (btn) pickBtn = btn;
    blockPick = on;
    document.documentElement.classList.toggle('uw-picking', on);
    pickBtn?.querySelector('span')?.classList.toggle('uw-qs-on', on);
    if (!on) { pickBar?.remove(); pickBar = null; return; }

    pickBar = el('uw-pickbar', {
      display: 'flex', 'align-items': 'center', gap: '8px', position: 'fixed', left: '8px', right: '8px',
      top: '46px', 'z-index': '2147483000', padding: '8px 10px', 'border-radius': '10px',
      background: 'rgba(40,40,40,.97)', 'box-shadow': '0 4px 16px rgba(0,0,0,.45)',
    });
    const msg = el('span', { display: 'block', flex: '1 1 auto', color: '#eee', 'font-size': '13px' });
    msg.textContent = `${boardLabel()}: 차단할 작성자의 글을 누르세요`;
    const mk = (label, bg) => {
      const b = el('button', {
        display: 'block', flex: 'none', height: '30px', padding: '0 10px', 'border-radius': '6px',
        background: bg, color: '#fff', 'font-size': '12px', 'font-weight': 'bold', cursor: 'pointer',
      });
      b.type = 'button'; b.textContent = label;
      return b;
    };
    const manage = mk('목록 관리', '#555');
    const cancel = mk('취소', '#777');
    manage.addEventListener('click', () => { setBlockPick(false); openBlockModal(pickBtn); });
    cancel.addEventListener('click', () => setBlockPick(false));
    pickBar.append(msg, manage, cancel);
    document.body.appendChild(pickBar);
  }

  // 선택 모드에서 글 클릭 가로채기(글로 이동하지 않음)
  function onPickClick(e) {
    if (!blockPick) return;
    const row = e.target instanceof Element ? e.target.closest('.post_item') : null;
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const nick = rowNick(row);
    if (!nick) { alert('이 글의 작성자 닉네임을 찾지 못했어요.'); return; }
    if (!confirm(`${boardLabel()}에서 '${nick}' 님의 글을 모두 숨길까요?`)) return;
    saveBlockedNicks([...blockedNicks(), nick]);
    applyBlockedToRows();
    updateBlockBtnLabel();
    setBlockPick(false);
  }
  document.addEventListener('click', onPickClick, true);

  // 목록의 모든 글에 차단 여부 반영(설정 변경 직후·새 글 로드 시)
  function applyBlockedToRows() {
    for (const el of document.querySelectorAll('.post_item')) {
      el.classList.toggle('uw-blocked', isBlockedRow(el));
    }
    scheduleSaveNavList();
  }

  /* ── 최근(밀린 글 이어 읽기) ──
   *  - 웃긴자료 글을 열 때마다 그 글 번호를 "마지막으로 읽은 글"로 저장.
   *  - [최근]: 마지막으로 읽은 글 페이지를 백그라운드로 받아 그 글의 "▲ 다음글"(바로 위, 더 최신 글)로 이동.
   *    예) 3페이지 3번째 글을 마지막으로 읽었으면 → 3페이지 2번째 글.
   *  - 기록이 없으면 웃긴자료 목록으로, 더 최신 글이 없으면 마지막으로 읽은 글로 이동.
   */
  const RECENT_TABLE = 'pds';
  const RECENT_KEY = `uw-last-read:${RECENT_TABLE}`;

  /* 읽은 글 번호 모음(게시판별). 어느 목록에서 읽었든 같은 글이면 다른 목록(대자↔ㅇㅎ·ㅎㅂ)에서도 읽음으로 침. */
  const READ_SET_MAX = 3000;
  const readSetKey = (t) => `uw-read:${t}`;
  function readSetFor(t) {
    try { return new Set(JSON.parse(localStorage.getItem(readSetKey(t)) || '[]').map(String)); } catch { return new Set(); }
  }
  function markRead(t, n) {
    if (!t || !n) return;
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(readSetKey(t)) || '[]').map(String); } catch {}
    if (arr.includes(String(n))) return;
    arr.push(String(n));
    if (arr.length > READ_SET_MAX) arr = arr.slice(-READ_SET_MAX);
    try {
      localStorage.setItem(readSetKey(t), JSON.stringify(arr));
      // 이 게시판 관련 새 글 표시를 다시 계산하도록 무효화
      for (const k of Object.keys(localStorage)) if (k.startsWith(`uw-new:${t}|`)) localStorage.removeItem(k);
    } catch {}
  }

  function recordLastRead() {
    if (isRead && table) markRead(table, params.get('number'));
    if (!isRead || table !== RECENT_TABLE) return;
    const n = params.get('number');
    if (n) {
      try { localStorage.setItem(RECENT_KEY, n); localStorage.removeItem(`uw-new:${NEW_KEY_RECENT}`); } catch {}
    }
  }

  async function goNextUnread(btn) {
    let last = null;
    try { last = localStorage.getItem(RECENT_KEY); } catch {}
    const listUrl = `/board/list.html?table=${RECENT_TABLE}`;
    if (!last) { location.href = listUrl; return; }

    const span = btn?.querySelector('span');
    const label = span?.textContent;
    try {
      const url = `/board/read.html?table=${RECENT_TABLE}&number=${encodeURIComponent(last)}`;
      const res = await fetch(url, { credentials: 'include' });
      const buf = await res.arrayBuffer();
      let html;
      try { html = new TextDecoder('euc-kr').decode(buf); } catch { html = new TextDecoder().decode(buf); }
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nextLi = [...doc.querySelectorAll('li.next_prev_li')]
        .find((li) => (li.querySelector('.btn')?.textContent || '').includes('다음글'));
      const href = nextLi?.querySelector('a')?.getAttribute('href');
      if (href) { location.href = new URL(href, new URL(url, location.href)).href; return; }
      // 새 글이 없으면 마지막으로 읽은 글로 이동(이미 그 글을 보고 있으면 그대로)
      if (isRead && table === RECENT_TABLE && params.get('number') === last) {
        if (span) span.textContent = label;
        return;
      }
      location.href = new URL(url, location.href).href;
    } catch {
      if (span) span.textContent = label;
      location.href = listUrl; // 실패 시 목록으로
    }
  }

  /* ── 목록 화면 플로팅 검색 버튼 ──
   *  자동 더보기로 목록이 끝없이 이어져 맨 아래 사이트 검색창에 닿을 수 없는 문제 해결.
   *  오른쪽 아래 작은 돋보기 → 사이트 원래 검색 폼(검색 대상·기간 선택 포함)을 화면 아래에 띄움.
   *  원래 폼 요소를 그대로 옮겨 쓰므로 사이트 검색 동작·옵션이 그대로 유지됨.
   *  사이트 폼을 못 찾으면 스크립트 검색 팝업(현재 게시판)으로 대체.
   */
  let searchPanel = null;

  function findSiteSearchForm() {
    for (const inp of document.querySelectorAll('form input[name="sk"]')) {
      const f = inp.closest('form');
      if (f && !f.closest('uw-search, uw-searchpanel')) return f;
    }
    return null;
  }

  function toggleSearchPanel() {
    if (searchPanel) {
      const show = searchPanel.style.getPropertyValue('display') === 'none';
      css(searchPanel, { display: show ? 'block' : 'none' });
      if (show) searchPanel.querySelector('input[name="sk"]')?.focus();
      return;
    }
    const form = findSiteSearchForm();
    if (!form) { openSearchModal(table); return; }

    searchPanel = el('uw-searchpanel', {
      display: 'block', position: 'fixed', left: '8px', right: '8px',
      bottom: 'calc(54px + env(safe-area-inset-bottom, 0px))', 'z-index': '2147482001',
      padding: '10px', background: 'rgba(42,42,42,.97)', 'border-radius': '10px',
      'box-shadow': '0 6px 20px rgba(0,0,0,.5)',
    });
    form.parentNode.insertBefore(el('uw-formhome', { display: 'none' }), form); // 원래 자리 표시
    searchPanel.appendChild(form);
    restyleSearchForm(form);
    const sk = form.querySelector('input[name="sk"]');
    document.body.appendChild(searchPanel);
    sk?.focus();
  }

  // 옮겨 온 사이트 폼을 한 줄로 정돈: [입력][검색] (선택 상자는 숨김)
  //  - 입력 요소를 감싼 상자는 펼쳐서(display:contents) 입력 요소만 한 줄에 나란히
  //  - 입력 요소가 없는 상자·글자(안내문, 빈칸 등)는 숨김 → 사이 빈 공간 제거
  //  - 높이·색·테두리를 통일(사이트 기본 스타일의 두꺼운 흰 테두리 제거)
  function restyleSearchForm(form) {
    const CTRL = 'select, input:not([type="hidden"]), button, .btn';
    const isCtrl = (e) => e.matches(CTRL);
    // 검색과 무관한 버튼(글쓰기 등)은 숨김
    for (const b of form.querySelectorAll('.btn, button, a')) {
      if (/글쓰기/.test(b.textContent)) css(b.closest('a') || b, { display: 'none' });
    }
    css(form, { display: 'flex', 'flex-wrap': 'nowrap', 'align-items': 'center', gap: '6px', margin: '0', padding: '0' });
    for (const e of [...form.querySelectorAll('*')]) {
      if (e.style.getPropertyValue('display') === 'none') continue;             // 위에서 숨긴 것
      if (isCtrl(e) || (e.closest('.btn, button') && e.closest('.btn, button') !== e)) continue; // 버튼 안쪽 글자 등
      if (e.querySelector(CTRL)) css(e, { display: 'contents' });
      else if (!(e instanceof HTMLInputElement)) css(e, { display: 'none' });
    }
    // 빈칸 글자(&nbsp; 등)는 펼친 상자 안에서 한 칸씩 자리를 차지하므로 비움
    const tw = document.createTreeWalker(form, NodeFilter.SHOW_TEXT);
    const blanks = [];
    while (tw.nextNode()) if (/^[\s\u00a0]*$/.test(tw.currentNode.data)) blanks.push(tw.currentNode);
    for (const n of blanks) n.data = '';
    const base = {
      height: '36px', 'box-sizing': 'border-box', margin: '0', 'border-radius': '6px',
      'font-size': '14px', 'line-height': '34px', outline: 'none', 'box-shadow': 'none',
    };
    // 검색 대상·기간 선택은 숨김(값은 기본값 그대로 함께 전송됨: 제목 검색 · 최근 3개월)
    for (const sel of form.querySelectorAll('select')) css(sel, { display: 'none' });
    for (const inp of form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')) {
      css(inp, { ...base, display: 'block', flex: '1 1 80px', 'min-width': '0', width: 'auto', padding: '0 10px',
        background: '#1b1b1b', color: '#eee', border: '1px solid #555', 'font-size': '16px' }); // 16px: iOS 확대 방지
    }
    for (const b of form.querySelectorAll('button, input[type="submit"], input[type="button"], .btn')) {
      if (b.style.getPropertyValue('display') === 'none' || b.closest('[style*="display: none"]')) continue;
      css(b, { ...base, display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center', flex: 'none',
        padding: '0 12px', background: '#ff5a5a', color: '#fff', border: '0', 'font-weight': 'bold', cursor: 'pointer' });
    }
  }

  function injectSearchFab() {
    if (!isList || !table || document.querySelector('uw-fab')) return;
    const fab = el('uw-fab', {
      display: 'flex', 'align-items': 'center', 'justify-content': 'center',
      position: 'fixed', right: '10px', bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
      width: '30px', height: '30px', 'border-radius': '50%', 'z-index': '2147482000',
      background: 'rgba(40,40,40,.75)', color: '#bbb', border: '1px solid #555',
      'box-shadow': '0 2px 6px rgba(0,0,0,.4)', cursor: 'pointer',
      '-webkit-tap-highlight-color': 'transparent',
    });
    fab.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" style="display:block"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>';
    fab.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSearchPanel(); // 클릭 핸들러 안에서 바로 focus(모바일 키보드)
    });
    document.body.appendChild(fab);
  }

  /* ── 새 글 표시(연두색) ──
   *  - 최근: 마지막으로 읽은 웃긴자료 글 뒤에 더 최신 글이 있으면.
   *  - 대자·얼인·패션·ㅇㅎ·ㅎㅂ: 그 목록(1페이지)을 마지막으로 본 뒤 새로 올라온 글이 있으면.
   *    각 목록의 필터·작성자 차단·ai 숨김 규칙을 그대로 적용해서 "보일 글"만 셈.
   *  - "읽은 위치": 그 목록에서 연 글 중 마지막으로 읽은 글(처음엔 목록 1페이지를 연 시점의 최신 글).
   *    연두색 버튼을 누르면 안 읽은 가장 오래된 글로 바로 이동(goListUnread).
   *  - 확인은 페이지 내용 준비 직후 백그라운드로, 목록별 NEW_CHECK_TTL(1분)마다 최대 1회(결과는 저장해서 즉시 표시).
   */
  const AI_RE = /(^|[^a-z])ai($|[^a-z])/i;
  const NEW_KEY_RECENT = 'recent';
  const NEW_MARK_EXCLUDE = ['pds', 'pdswait']; // 연두색 표시를 하지 않는 게시판 버튼(웃자·대자)
  const NEW_CHECK_TTL = 60 * 1000; // 목록별 확인 간격(페이지를 넘겨도 이 간격 안에서는 저장된 결과 사용)
  const listKey = (t, sk) => `${t}|${String(sk || '').toUpperCase()}`;
  const store2 = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // 연두색(새 글 있음)일 때 누르면 안 읽은 가장 오래된 글로, 아니면 원래대로 목록으로
  function bindUnreadJump(a) {
    a.addEventListener('click', (e) => {
      if (!a.querySelector('.uw-has-new')) return;
      e.preventDefault();
      goListUnread(a.dataset.uwNewKey, a);
    });
  }

  function applyNewMarks() {
    // 이미 웃긴자료 글을 보고 있으면 '최근'은 표시하지 않음(▲ 다음글로 바로 이어 읽으면 되므로)
    const readingRecent = isRead && table === RECENT_TABLE;
    for (const a of document.querySelectorAll('uw-navi a[data-uw-new-key]')) {
      const key = a.dataset.uwNewKey;
      const st = store2.get(`uw-new:${key}`);
      const has = !!st?.has && !(key === NEW_KEY_RECENT && readingRecent);
      a.querySelector('span')?.classList.toggle('uw-has-new', has);
    }
  }

  /* ── 검색 요청 보호 ──
   *  사이트는 게시판 하단검색(list.html?...&sk=)을 자주 하면 약 4시간 검색을 막음.
   *  스크립트가 백그라운드에서 검색 주소를 부르지 않도록:
   *   - 새 글 확인·안 읽은 글 찾기는 검색 대신 일반 목록을 받아 제목에 검색어가 든 글만 직접 골라냄
   *   - 그래도 검색 주소가 필요한 경우(검색 결과 다음 페이지 등)는 SEARCH_MIN_GAP_MS에 1회로 제한
   *   - 응답에 "잦은 검색이 제한" 안내가 오면 4시간 동안 스크립트 검색 요청 중단
   */
  const SEARCH_MIN_GAP_MS = 3 * 60 * 1000; // 스크립트 검색 최소 간격(사용자 직접 검색 포함)
  const SEARCH_BLOCK_MS = 4 * 60 * 60 * 1000;
  const isSearchUrl = (u) => /[?&]sk=[^&#]/.test(String(u));

  function scriptSearchAllowed() {
    const now = Date.now();
    const until = Number(store2.get('uw-search-block-until')) || 0;
    const last = Number(store2.get('uw-search-last')) || 0;
    if (now < until || now - last < SEARCH_MIN_GAP_MS) return false;
    store2.set('uw-search-last', now);
    return true;
  }

  // user=true: 사용자가 버튼을 눌러 직접 요청한 검색(검색 목록을 여는 것과 같은 1회) → 간격 제한 없이 허용(차단 중엔 불가)
  async function fetchDoc(url, user = false) {
    if (isSearchUrl(url)) {
      if (user) {
        if (Date.now() < (Number(store2.get('uw-search-block-until')) || 0)) throw new Error('search-blocked');
        store2.set('uw-search-last', Date.now());
      } else if (!scriptSearchAllowed()) throw new Error('search-throttled');
    }
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    let html;
    try { html = new TextDecoder('euc-kr').decode(buf); } catch { html = new TextDecoder().decode(buf); }
    if (/잦은\s*검색이\s*제한/.test(html)) {
      store2.set('uw-search-block-until', Date.now() + SEARCH_BLOCK_MS);
      throw new Error('search-blocked');
    }
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // 검색어(EUC-KR 인코딩된 sk) → 글자. 일반 목록에서 제목으로 직접 거를 때 사용.
  const kwFromSk = (sk) => (sk ? decodeEucKr(sk).trim() : '');
  const titleOf = (el) => (el.querySelector('.link_hover')?.textContent || el.querySelector('a[href*="read.html"]')?.textContent || '').trim();

  // 다른 게시판 목록의 글이 그 게시판 규칙상 보이는 글인지(필터·차단·ai 숨김)
  function blockedNicksFor(t) {
    let raw = null;
    try { raw = localStorage.getItem(`uw-blocked-nicks:${t}`) ?? localStorage.getItem('uw-blocked-nicks'); } catch {}
    try { return new Set((JSON.parse(raw || '[]')).map((n) => String(n).trim()).filter(Boolean)); } catch { return new Set(); }
  }
  function rowVisibleFor(el, t, hideAi, blocked) {
    const title = (el.querySelector('.link_hover')?.textContent || el.querySelector('a[href*="read.html"]')?.textContent || '').trim();
    if (blocked.size && blocked.has(rowNick(el))) return false;
    if (hideAi && AI_RE.test(title)) return false;
    const rule = TABLE_FILTERS[t];
    if (!rule) return true;
    const ok = countDigits(el.querySelector('.ok_num')?.textContent || '');
    return rule.exemptKeywords.some((k) => title.includes(k)) || ok > rule.threshold;
  }

  // 목록 1페이지를 열었을 때: 가장 최신 글 번호를 "본 것"으로 저장, 새 글 표시 끄기
  function recordListSeen() {
    if (!isList || getPg(location.href) !== 1) return;
    let max = 0;
    for (const el of document.querySelectorAll('.post_item')) max = Math.max(max, Number(postNum(el)) || 0);
    if (!max) return;
    const sk = (location.search.match(/[?&]sk=([^&#]*)/) || [])[1] || '';
    const key = listKey(table, sk);
    // 처음 연 목록만 기준점 설정(이후엔 글을 읽을 때 갱신 → 목록만 열어선 '읽음' 처리 안 함)
    if (store2.get(`uw-seen:${key}`) == null) {
      store2.set(`uw-seen:${key}`, max);
      store2.set(`uw-new:${key}`, { at: Date.now(), has: false });
      applyNewMarks();
    }
  }

  const keyFromUrl = (url) => listKey(
    (String(url).match(/[?&]table=([^&#]*)/) || [])[1] || '',
    (String(url).match(/[?&]sk=([^&#]*)/) || [])[1] || '');

  // 목록에서 연 글을 읽으면 그 목록의 "마지막으로 읽은 글"로 기록
  function recordListProgress(listUrl, num, keyOverride) {
    const key = keyOverride || keyFromUrl(listUrl);
    if (!key.split('|')[0] || !Number(num)) return;
    // 더 최신 글을 읽었을 때만 앞으로 이동(옛 글을 다시 열어도 기준이 뒤로 가지 않음)
    if (Number(num) > (Number(store2.get(`uw-seen:${key}`)) || 0)) store2.set(`uw-seen:${key}`, Number(num));
    try { localStorage.removeItem(`uw-new:${key}`); } catch {} // 다음 확인 때 다시 계산
  }

  /* ── 안 읽은 가장 오래된 글로 이동 (대자·얼인·패션·ㅇㅎ·ㅎㅂ, 연두색일 때) ──
   *  목록을 1페이지부터 받아 그 목록 규칙(필터·차단·ai 숨김)으로 보이는 글을 모으다가,
   *  마지막으로 읽은 글(번호 이하)에 닿으면 그 바로 앞(=안 읽은 글 중 가장 오래된 글)으로 이동.
   *  모은 목록은 이전글·다음글 순서로 저장 → 그 글에서 ▲ 다음글로 최신까지 이어 읽기.
   */
  const UNREAD_MAX_PAGES = 10;

  async function goListUnread(key, btn) {
    const [t, sk] = key.split('|');
    const listUrl = new URL(sk
      ? `/board/list.html?table=${t}&st=subject&searchday=${SEARCH_DAY}&sk=${sk}`
      : `/board/list.html?table=${t}`, location.href).href;
    // 검색 목록(ㅇㅎ·ㅎㅂ)도 검색 대신 일반 목록을 훑으며 제목으로 거름(검색 제한 회피)
    const kw = kwFromSk(sk);
    const scanUrl = new URL(`/board/list.html?table=${t}`, location.href).href;
    const maxPages = kw ? UNREAD_MAX_PAGES * 2 : UNREAD_MAX_PAGES;
    const seen = Number(store2.get(`uw-seen:${key}`)) || 0;
    if (!seen) { location.href = listUrl; return; }

    const span = btn?.querySelector('span');
    const label = span?.textContent;
    try {
      const blocked = blockedNicksFor(t);
      const hideAi = hideAiFor(listUrl);
      const readNow = readSetFor(t);
      const items = [];
      let pageLinks = {};
      let lastPg = 1;
      let target = -1; // 안 읽은 가장 오래된 글의 items 인덱스
      let boundary = false;
      // ㅇㅎ·ㅎㅂ: 누를 때 검색 결과로 1회 확인(정확, 사용자 동작 1회 = 검색 1회). 검색이 막혔으면 일반 목록 훑기.
      let viaSearch = !!kw && Date.now() >= (Number(store2.get('uw-search-block-until')) || 0);
      const base = () => (viaSearch ? listUrl : scanUrl);
      for (let pg = 1; pg <= (viaSearch ? 5 : maxPages); pg++) {
        const url = pg === 1 ? base() : (pageLinks[String(pg)] || setPg(base(), pg));
        let doc;
        try { doc = await fetchDoc(url, viaSearch); }
        catch (e) {
          if (!viaSearch || pg > 1) throw e;
          viaSearch = false; pg = 0; continue; // 검색 실패 → 일반 목록으로 처음부터
        }
        const rows = [...doc.querySelectorAll('.post_item')];
        if (!rows.length) break;
        pageLinks = { ...collectPageLinks(doc, url), ...pageLinks };
        lastPg = pg;
        let reached = false;
        for (const el of rows) {
          // 검색어가 없는 글이라도 번호로 경계(마지막으로 읽은 글 위치)는 판정
          if (kw && !titleOf(el).includes(kw)) {
            if (!reached && (Number(postNum(el)) || 0) <= seen) { reached = true; boundary = true; target = items.length - 1; }
            continue;
          }
          if (!rowVisibleFor(el, t, hideAi, blocked)) continue;
          const it = rowToItem(el, url, t);
          if (!it || items.some((x) => x.n === it.n)) continue;
          // 경계 = 이 목록에서 읽은 가장 최신 글(최근과 동일: 그 바로 다음 글로 이동)
          if (!reached && (Number(it.n) <= seen || readNow.has(it.n))) { reached = true; boundary = true; target = items.length - 1; }
          items.push(it); // 경계 페이지는 끝까지 모아 둠(▼ 이전글 연결용)
        }
        if (reached) break;
      }
      if (!boundary) target = items.length - 1; // 경계 못 찾음(최대 페이지 초과) → 받은 것 중 가장 오래된 글
      // 다른 목록에서 이미 읽은 글은 건너뜀(경계 위쪽에서 가장 오래된 '안 읽은' 글)
      if (kw) addKnown(key, items.map((it) => it.n));
      const read = readSetFor(t);
      const lastIdx = boundary ? target + 1 : -1; // 마지막으로 읽은 글(경계)
      while (target >= 0 && read.has(items[target].n)) target--;
      if (target < 0) {
        // 안 읽은 글 없음 → 최근과 같이 마지막으로 읽은 글로(표시도 끔). 그 글을 보고 있으면 그대로.
        store2.set(`uw-new:${key}`, { at: Date.now(), has: false });
        try { localStorage.removeItem(`uw-srch:${key}`); } catch {}
        applyNewMarks();
        const last = items[lastIdx];
        if (span) span.textContent = label;
        if (!last) { location.href = listUrl; return; }
        if (isRead && table === t && params.get('number') === last.n) return;
        saveNavCtx({ at: Date.now(), listUrl: base(), kw, hideAi, progressKey: key,
          firstPg: 1, lastPg, pageLinks, items }, t);
        location.href = last.href;
        return;
      }
      saveNavCtx({ at: Date.now(), listUrl: base(), kw, hideAi, progressKey: key,
        firstPg: 1, lastPg, pageLinks, items }, t);
      location.href = items[target].href;
    } catch {
      if (span) span.textContent = label;
      location.href = listUrl;
    }
  }

  async function checkListNew(key) {
    const [t, sk] = key.split('|');
    const seen = Number(store2.get(`uw-seen:${key}`)) || 0;
    if (!seen) return false; // 한 번도 안 본 목록은 기준이 없어 표시 안 함
    // 검색 목록(ㅇㅎ·ㅎㅂ)도 검색 대신 일반 목록 1페이지에서 제목으로 거름(검색 제한 회피).
    // 새 글은 항상 일반 목록 1페이지에 먼저 올라오므로 결과는 같음.
    const kw = kwFromSk(sk);
    const doc = await fetchDoc(`/board/list.html?table=${t}`);
    const blocked = blockedNicksFor(t);
    const hideAi = hideAiFor(`?table=${t}&sk=${sk || ''}`);
    const read = readSetFor(t);
    for (const el of doc.querySelectorAll('.post_item')) {
      const n = Number(postNum(el)) || 0;
      if (kw && !titleOf(el).includes(kw)) continue;
      if (n > seen && !read.has(String(n)) && rowVisibleFor(el, t, hideAi, blocked)) return true;
    }
    return false;
  }

  async function checkRecentNew() {
    let last = null;
    try { last = localStorage.getItem(RECENT_KEY); } catch {}
    if (!last) return false;
    const doc = await fetchDoc(`/board/read.html?table=${RECENT_TABLE}&number=${encodeURIComponent(last)}`);
    return [...doc.querySelectorAll('li.next_prev_li')]
      .some((li) => (li.querySelector('.btn')?.textContent || '').includes('다음글'));
  }

  /* 같은 게시판의 여러 목록(예: 대기자료의 ㅇㅎ·ㅎㅂ)을 일반 목록 한 번 훑기로 함께 확인.
   *  일반 목록 1페이지만 보면, 글이 빨리 올라오는 대기자료에선 새 ㅇㅎ·ㅎㅂ 글이 금방 2~3페이지로 밀려
   *  놓칠 수 있음 → 마지막으로 읽은 위치(가장 오래된 기준)에 닿을 때까지 최대 NEW_SCAN_MAX_PAGES 훑음. */
  const NEW_SCAN_MAX_PAGES = 8;

  /* 검색 목록(ㅇㅎ·ㅎㅂ)에 속한 글 번호 모음(보이는 글만) — 판정의 근거.
   *  일반 목록 앞쪽 몇 페이지만으로는 오래된 ㅇㅎ·ㅎㅂ 글이 안 보여 놓쳤음 →
   *  한 번이라도 본 검색 결과(직접 연 검색 목록, 버튼 이동 때의 검색, 가끔 하는 검색 확인, 이어 읽기 목록)와
   *  일반 목록에서 새로 발견한 글을 모아 두고, 여기서 "읽은 가장 최신 글보다 새로운 안 읽은 글"을 찾음. */
  const KNOWN_MAX = 400;
  function addKnown(key, nums) {
    if (!key.split('|')[1]) return;
    const cur = new Set((store2.get(`uw-known:${key}`) || []).map(Number));
    let changed = false;
    for (const n of nums) { const v = Number(n); if (v && !cur.has(v)) { cur.add(v); changed = true; } }
    if (!changed) return false;
    store2.set(`uw-known:${key}`, [...cur].sort((a, b) => b - a).slice(0, KNOWN_MAX));
    dlog(`known+ ${key} → ${cur.size}개`);
    return true;
  }
  // 읽은 가장 최신 글(기준) 갱신 후, 그보다 새로운 안 읽은 글이 있는지
  function knownHasNew(key) {
    const t = key.split('|')[0];
    const known = (store2.get(`uw-known:${key}`) || []).map(Number);
    const read = readSetFor(t);
    let seen = Number(store2.get(`uw-seen:${key}`)) || 0;
    for (const n of known) if (n > seen && read.has(String(n))) seen = n;
    if (seen !== (Number(store2.get(`uw-seen:${key}`)) || 0)) store2.set(`uw-seen:${key}`, seen);
    if (!seen) return false;
    return known.some((n) => n > seen && !read.has(String(n)));
  }

  // 결과: { key: { has, done } } — done=true면 "읽은 가장 최신 글"까지 확인해서 결과가 확정됨
  //  최근과 같은 기준: 그 목록에서 읽은 가장 최신 글보다 더 최신이면서 안 읽은(보이는) 글이 있으면 has
  async function checkListsNew(t, keys) {
    const result = Object.fromEntries(keys.map((k) => [k, { has: false, done: false }]));
    const conf = keys.map((k) => {
      const sk = k.split('|')[1] || '';
      return { k, kw: kwFromSk(sk), seen: Number(store2.get(`uw-seen:${k}`)) || 0, hideAi: hideAiFor(`?table=${t}&sk=${sk}`) };
    }).filter((c) => c.seen > 0); // 한 번도 안 본 목록은 기준이 없어 표시 안 함
    for (const k of keys) if (!conf.some((c) => c.k === k)) result[k].done = true;
    if (!conf.length) return result;
    const blocked = blockedNicksFor(t);
    const read = readSetFor(t);
    const base = new URL(`/board/list.html?table=${t}`, location.href).href;
    let pageLinks = {};
    for (let pg = 1; pg <= NEW_SCAN_MAX_PAGES; pg++) {
      const url = pg === 1 ? base : (pageLinks[String(pg)] || setPg(base, pg));
      const doc = await fetchDoc(url);
      const rows = [...doc.querySelectorAll('.post_item')];
      if (!rows.length) break;
      pageLinks = { ...collectPageLinks(doc, url), ...pageLinks };
      for (const el of rows) {
        const n = Number(postNum(el)) || 0;
        for (const c of conf) {
          const r = result[c.k];
          if (r.done) continue;
          if (n <= c.seen) { r.done = true; continue; }
          if (c.kw && !titleOf(el).includes(c.kw)) continue;
          if (!rowVisibleFor(el, t, c.hideAi, blocked)) continue;
          if (c.kw) addKnown(c.k, [n]);
          if (read.has(String(n))) { // 이 목록에서 읽은 가장 최신 글 → 기준을 여기로 당김
            store2.set(`uw-seen:${c.k}`, n); r.done = true; continue;
          }
          r.has = true; r.done = true;
        }
      }
      if (conf.every((c) => result[c.k].done)) break;
    }
    return result;
  }

  async function refreshNewMarks() {
    const keys = [...new Set([...document.querySelectorAll('uw-navi a[data-uw-new-key]')].map((a) => a.dataset.uwNewKey))]
      .filter((key) => {
        const st = store2.get(`uw-new:${key}`);
        return !(st && Date.now() - st.at < NEW_CHECK_TTL);
      });
    const save = (key, has) => { store2.set(`uw-new:${key}`, { at: Date.now(), has }); applyNewMarks(); };
    if (keys.includes(NEW_KEY_RECENT)) {
      try { save(NEW_KEY_RECENT, await checkRecentNew()); } catch {}
    }
    // 게시판별로 묶어서 한 번에 확인
    const byTable = {};
    for (const key of keys) {
      if (key === NEW_KEY_RECENT) continue;
      (byTable[key.split('|')[0]] ||= []).push(key);
    }
    for (const [t, ks] of Object.entries(byTable)) {
      let res = {};
      try { res = await checkListsNew(t, ks); } catch {}
      for (const k of ks) {
        let has = !!res[k]?.has;
        if (k.split('|')[1]) {
          // 검색 목록(ㅇㅎ·ㅎㅂ): 모아 둔 글 번호로 판정. 아직 모은 게 적으면(처음 등) 가끔 검색 1페이지로 보충.
          if (USE_SEARCH_CHECK && !has && res[k] && !res[k].done) await checkListNewBySearch(k);
          has = has || knownHasNew(k);
        }
        dlog(`판정 ${k}: plain=${JSON.stringify(res[k])} → ${has}`);
        save(k, has);
      }
    }
  }

  // 검색 1페이지로 새 글 확인. 간격이 안 됐거나 막혔으면 null(=이번엔 확인 안 함).
  //  - 평소: 목록별 SEARCH_CHECK_EVERY_MS(10분)에 1회
  //  - 글을 읽어서 표시가 초기화된 직후: SEARCH_RECHECK_MIN_MS(2분) 이상 지났으면 바로 1회
  // 검색 제한 경고를 피하면서 정확도 확보: 검색 범위를 '최근 1개월'로 줄이고 아주 드물게만 검색.
  //  - 목록별 15분에 1회(글을 읽어 표시가 초기화되면 5분 지난 뒤 1회)
  //  - 스크립트 검색끼리는 최소 3분 간격(SEARCH_MIN_GAP_MS), 사용자가 직접 검색한 직후 3분간도 쉼
  const USE_SEARCH_CHECK = true;
  const SEARCH_CHECK_DAY = '1month';
  const SEARCH_CHECK_EVERY_MS = 15 * 60 * 1000;
  const SEARCH_RECHECK_MIN_MS = 5 * 60 * 1000;
  async function checkListNewBySearch(key) {
    const prev = store2.get(`uw-srch:${key}`); // { at, has, readVer }
    const readVer = (localStorage.getItem(readSetKey(key.split('|')[0])) || '').length; // 읽은 글이 늘었는지 감지용
    const since = Date.now() - (prev?.at || 0);
    const due = since >= SEARCH_CHECK_EVERY_MS || (prev?.readVer !== readVer && since >= SEARCH_RECHECK_MIN_MS);
    if (!due) return null;
    const [t, sk] = key.split('|');
    const seen = Number(store2.get(`uw-seen:${key}`)) || 0;
    if (!seen) return null;
    let doc;
    try { doc = await fetchDoc(`/board/list.html?table=${t}&st=subject&searchday=${SEARCH_CHECK_DAY}&sk=${sk}`); }
    catch { return null; } // 30초 간격 제한·검색 차단 중이면 이번엔 생략
    const blocked = blockedNicksFor(t);
    const hideAi = hideAiFor(`?table=${t}&sk=${sk}`);
    const read = readSetFor(t);
    let has = false, hit = 0;
    addKnown(key, [...doc.querySelectorAll('.post_item')].filter((el) => rowVisibleFor(el, t, hideAi, blocked)).map(postNum));
    for (const el of doc.querySelectorAll('.post_item')) {
      const n = Number(postNum(el)) || 0;
      if (n <= seen) break;
      if (!rowVisibleFor(el, t, hideAi, blocked)) continue;
      if (read.has(String(n))) { store2.set(`uw-seen:${key}`, n); break; } // 읽은 가장 최신 글에서 멈춤
      has = true; hit = hit || n; // 가장 최신의 안 읽은 글(읽으면 캐시 결과 해제용)
    }
    store2.set(`uw-srch:${key}`, { at: Date.now(), has, n: hit, readVer });
    return has;
  }

  // 확인 시점: 페이지 내용(DOM)이 준비되면 바로(이미지·영상 로딩 완료를 기다리지 않음).
  //  예전엔 'load'(모든 이미지·영상 로딩 완료) 이후에 확인해서, 영상 많은 글을 빠르게 넘기면
  //  확인이 한 번도 안 돌아 새 글 표시가 늦거나 안 켜졌음.
  //  머무는 동안에도 NEW_CHECK_TTL마다 다시 확인.
  // 사용자가 직접 검색 결과를 연 것도 검색 1회로 기록 → 직후 스크립트 검색을 쉼
  function noteUserSearch() {
    if (isList && isSearchUrl(location.href)) store2.set('uw-search-last', Date.now());
  }

  // ㅇㅎ·ㅎㅂ 검색 목록 1페이지를 직접 열었으면 그 화면으로 바로 판정(검색 1회와 같은 정보, 추가 요청 없음)
  //  위에서부터 첫 '보이는 글'이 읽은 글(또는 기준 이하)이면 새 글 없음, 아니면 있음.
  function syncFromSearchPage() {
    if (!isList || getPg(location.href) !== 1) return;
    const sk = currentRawSk();
    if (!sk) return;
    const key = listKey(table, sk);
    if (table !== SEARCH_TABLE || !QUICK_SEARCH_KEYWORDS.some((q) => q.sk.toUpperCase() === sk.toUpperCase())) return;
    const seen = Number(store2.get(`uw-seen:${key}`)) || 0;
    const read = readSetFor(table);
    const blocked = blockedNicksFor(table);
    const hideAi = hideAiFor(location.href);
    let has = false, hit = 0;
    addKnown(key, [...document.querySelectorAll('.post_item')].filter((el) => rowVisibleFor(el, table, hideAi, blocked)).map(postNum));
    for (const el of document.querySelectorAll('.post_item')) {
      const n = Number(postNum(el)) || 0;
      if (!n || n <= seen) break;
      if (!rowVisibleFor(el, table, hideAi, blocked)) continue;
      if (read.has(String(n))) { store2.set(`uw-seen:${key}`, n); break; }
      has = true; hit = hit || n;
    }
    const readVer = (localStorage.getItem(readSetKey(table)) || '').length;
    store2.set(`uw-srch:${key}`, { at: Date.now(), has, n: hit, readVer });
    store2.set(`uw-new:${key}`, { at: Date.now(), has: has && seen > 0 });
    applyNewMarks();
  }

  /* ── 진단 패널: 주소 끝에 #uwdebug 를 붙여 열면 ㅇㅎ·ㅎㅂ 판정 데이터를 화면에 표시(복사 버튼) ── */
  var DEBUG_ON = /#uwdebug/.test(location.hash) || sessionStorage.getItem('uw-debug') === '1';
  if (/#uwdebug/.test(location.hash)) { try { sessionStorage.setItem('uw-debug', '1'); } catch {} }
  var dlogs = [];
  function dlog(m) { if (!DEBUG_ON || !dlogs) return; dlogs.push(`${new Date().toTimeString().slice(0, 8)} ${m}`); renderDebug(); }
  function debugText() {
    const lines = [`v${SCRIPT_VERSION} · ${location.pathname}${location.search}`];
    const read = readSetFor(SEARCH_TABLE);
    lines.push(`읽은글(${SEARCH_TABLE}) ${read.size}개 · 현재글 ${params.get('number') || '-'} 읽음=${read.has(String(params.get('number')))}`);
    for (const { label, sk } of QUICK_SEARCH_KEYWORDS) {
      const k = listKey(SEARCH_TABLE, sk);
      const known = (store2.get(`uw-known:${k}`) || []).map(Number);
      const seen = Number(store2.get(`uw-seen:${k}`)) || 0;
      lines.push(`[${label}] seen=${seen} new=${JSON.stringify(store2.get(`uw-new:${k}`))}`);
      lines.push(`  srch=${JSON.stringify(store2.get(`uw-srch:${k}`))}`);
      lines.push(`  known ${known.length}개: ${known.slice(0, 15).map((n) => n + (read.has(String(n)) ? '✓' : '')).join(' ')}`);
    }
    const ctx = (() => { try { return JSON.parse(sessionStorage.getItem(NAV_KEY(SEARCH_TABLE)) || 'null'); } catch { return null; } })();
    lines.push(`ctx(${SEARCH_TABLE}): key=${ctx?.progressKey || '-'} kw=${ctx?.kw || '-'} items=${ctx?.items?.length || 0} [${(ctx?.items || []).slice(0, 12).map((i) => i.n).join(' ')}]`);
    lines.push(`검색차단까지 ${Math.max(0, ((Number(store2.get('uw-search-block-until')) || 0) - Date.now()) / 60000 | 0)}분 · 마지막검색 ${((Date.now() - (Number(store2.get('uw-search-last')) || 0)) / 1000) | 0}초 전`);
    return lines.concat('— 로그 —', dlogs.slice(-25)).join('\n');
  }
  let debugBox = null;
  function renderDebug() {
    if (!DEBUG_ON || !document.body) return;
    if (!debugBox) {
      debugBox = el('uw-debug', { display: 'block', position: 'fixed', left: '4px', right: '4px', bottom: '4px', 'max-height': '55vh',
        overflow: 'auto', 'z-index': '2147483647', background: 'rgba(0,0,0,.92)', color: '#7CFC9A', padding: '8px',
        font: '11px/1.45 monospace', 'white-space': 'pre-wrap', 'word-break': 'break-all', 'border-radius': '8px' });
      const bar = el('uw-debugbar', { display: 'flex', gap: '6px', 'margin-bottom': '6px' });
      const mk = (txt, fn) => { const b = el('uw-dbtn', { display: 'inline-block', padding: '4px 10px', background: '#333', color: '#fff', 'border-radius': '6px' }); b.textContent = txt; b.addEventListener('click', fn); bar.appendChild(b); };
      mk('복사', () => { navigator.clipboard?.writeText(debugText()).then(() => dlog('복사됨'), () => dlog('복사 실패')); });
      mk('다시 확인', () => { for (const { sk } of QUICK_SEARCH_KEYWORDS) localStorage.removeItem(`uw-new:${listKey(SEARCH_TABLE, sk)}`); refreshNewMarks(); });
      mk('끄기', () => { try { sessionStorage.removeItem('uw-debug'); } catch {} debugBox.remove(); });
      debugBox.appendChild(bar);
      debugBox.appendChild(el('uw-debugtxt', { display: 'block' }));
      document.body.appendChild(debugBox);
    }
    debugBox.lastChild.textContent = debugText();
  }

  function initNewMarks() {
    if (DEBUG_ON) { if (document.body) renderDebug(); else document.addEventListener('DOMContentLoaded', renderDebug, { once: true }); setInterval(renderDebug, 3000); }
    noteUserSearch();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncFromSearchPage, { once: true });
    else syncFromSearchPage();
    const run = () => {
      setTimeout(refreshNewMarks, 600);
      setInterval(() => { if (!document.hidden) refreshNewMarks(); }, NEW_CHECK_TTL);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
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
    // 화면을 보고 있지 않을 때 시작된 재생(사이트 자동재생 등)은 즉시 멈춤
    if (v instanceof HTMLVideoElement && (document.hidden || pageInactive)) { v.pause(); return; }
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

  const MINI_HIDE_MAX_SEC = 5;  // 이 길이(초) 이하 영상은 컨트롤 바 전체 숨김(짧은 움짤형 영상)
  const MINI_SHORT_GAP = 10;    // px. 컨트롤을 숨긴 영상 아래 남길 간격
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
    // 짧은 영상(MINI_HIDE_MAX_SEC 이하)은 컨트롤 바 숨김. 길이를 알게 되는 시점에 판정.
    const applyShortHide = () => {
      const d = v.duration;
      if (!(d > 0) || !Number.isFinite(d)) return;
      const short = d <= MINI_HIDE_MAX_SEC;
      // 숨길 때도 바 자리는 MINI_SHORT_GAP 높이로 남겨 아래 텍스트와 간격 유지(내용물만 숨김)
      css(bar, { height: `${short ? MINI_SHORT_GAP : MINI_BAR_HEIGHT}px` });
      for (const child of bar.children) {
        if (short) css(child, { display: 'none' });
        else child.style.setProperty('display', child === seekArea || child === sound ? 'flex' : 'block', 'important');
      }
    };
    v.addEventListener('loadedmetadata', applyShortHide);
    v.addEventListener('durationchange', applyShortHide);
    applyShortHide();
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
  /* ── 화면을 보고 있지 않을 때 일시정지 ──
   *  다른 탭·앱 전환, 브라우저 내리기, 화면 꺼짐(visibilitychange/pagehide), 창 포커스 아웃(blur) 시
   *  재생 중인 영상 전부 일시정지. 그동안은 자동재생·재생 복구도 하지 않음.
   *  다시 돌아오면 화면 노출 기준으로 자동재생 재개(사용자가 직접 멈춘 영상은 그대로).
   */
  let pageInactive = false;

  function pauseAllForInactive() {
    pageInactive = true;
    for (const v of allVideos()) if (!v.paused) v.pause();
  }

  function initInactivePause() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseAllForInactive();
      else { pageInactive = false; scheduleEvaluate(); }
    });
    window.addEventListener('pagehide', pauseAllForInactive);
    window.addEventListener('blur', () => {
      // 페이지 안 iframe으로 포커스가 옮겨간 경우는 제외
      if (document.activeElement instanceof HTMLIFrameElement) return;
      pauseAllForInactive();
    });
    window.addEventListener('focus', () => {
      if (document.hidden) return;
      pageInactive = false;
      scheduleEvaluate();
    });
    // 화면을 터치했다면 보고 있는 것(포커스 이벤트가 안 오는 모바일 대비)
    window.addEventListener('pointerdown', () => { if (!document.hidden) pageInactive = false; }, { capture: true, passive: true });
  }

  function autoPlay(v) {
    if (!v || !v.paused || userPausedVideos.has(v) || document.fullscreenElement) return;
    if (pageInactive || document.hidden) return; // 화면을 보고 있지 않으면 재생 안 함
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
    if (document.fullscreenElement || pageInactive || document.hidden) return;
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
  // 특정 검색에서 제목에 'ai'가 든 글을 아예 숨김(흐리게가 아니라 제외). 대상: 대기자료 'ㅎㅂ' 검색.
  //   검색어는 EUC-KR 인코딩 값으로 비교(주소의 sk 값 그대로). 다른 검색어 추가 시 여기에.
  const HIDE_AI_SEARCHES = [{ table: 'pdswait', sk: '%A4%BE%A4%B2' }]; // ㅎㅂ
  function hideAiFor(url) {
    const u = String(url || '');
    const t = (u.match(/[?&]table=([^&#]*)/) || [])[1];
    const sk = ((u.match(/[?&]sk=([^&#]*)/) || [])[1] || '').toUpperCase();
    return HIDE_AI_SEARCHES.some((h) => h.table === t && h.sk.toUpperCase() === sk);
  }
  const HIDE_AI_HERE = isList && hideAiFor(location.href);
  // 'ai'가 독립된 표기일 때만(AI), .ai, ai그림 등). mail·daily처럼 영어 단어 속 ai는 제외.
  const hasAi = (title) => AI_RE.test(title);

  function classifyFilter(el, okEl) {
    const ok = countDigits(okEl.textContent);
    const title = el.querySelector('.link_hover')?.textContent || '';
    if (HIDE_AI_HERE && hasAi(title)) return; // uw-ok 미부여 → 숨김
    const matchedExempt = filterRule.exemptKeywords.some(k => title.includes(k));
    if (matchedExempt || ok > filterRule.threshold) el.classList.add('uw-ok');
    if (matchedExempt && hasAi(title)) el.classList.add('uw-ai-dim');
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
      if (el.dataset.uwblk !== '1') {
        el.dataset.uwblk = '1';
        if (isBlockedRow(el)) el.classList.add('uw-blocked');
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
  // hideAi: 이 목록이 'ai 제목 숨김' 검색인지(현재 페이지·불러온 페이지 모두 목록 주소 기준으로 판단)
  function rowPasses(el, hideAi = false) {
    if (el.classList.contains('uw-blocked') || isBlockedRow(el)) return false;
    if (hideAi && hasAi(rowTitle(el))) return false;
    if (!filterRule) return true;
    if (el.classList.contains('uw-ok')) return true;
    if (el.dataset.uwfiltered === '1') return false;
    const ok = countDigits(el.querySelector('.ok_num')?.textContent || '');
    return filterRule.exemptKeywords.some((k) => rowTitle(el).includes(k)) || ok > filterRule.threshold;
  }

  function rowToItem(el, baseUrl, t = table) {
    const n = postNum(el);
    if (!n) return null;
    // 일반 목록은 행 링크가 read.html이 아닐 수 있음(스크립트 클릭 방식) → 번호로 주소 생성
    const a = el.querySelector('a[href*="read.html"]');
    const href = a
      ? new URL(a.getAttribute('href'), baseUrl).href
      : new URL(`/board/read.html?table=${encodeURIComponent(t)}&number=${n}`, baseUrl).href;
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

  function rowsToItems(root, baseUrl, hideAi = false, kw = '') {
    const items = [];
    for (const el of root.querySelectorAll('.post_item')) {
      if (kw && !rowTitle(el).includes(kw)) continue;
      if (!rowPasses(el, hideAi)) continue;
      const it = rowToItem(el, baseUrl);
      if (it) items.push(it);
    }
    return items;
  }

  function saveNavList() {
    if (!isList) return;
    recordListSeen();
    const searching = /[?&]sk=[^&]/.test(location.search);
    if (!filterRule && !searching && blockedNicks().size === 0) { // 필터·검색·차단 모두 없으면 사이트 기본 순서와 같음
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
    const items = rowsToItems(document, location.href, HIDE_AI_HERE);
    saveNavCtx({ at: Date.now(), listUrl, firstPg, lastPg, pageLinks, items });
  }

  function saveNavCtx(ctx, t = table) {
    // tmp: 필터에 걸린 '현재 글' 자리표시(이웃 계산용) — 저장하지 않음
    const clean = { ...ctx, items: (ctx.items || []).filter((it) => !it.tmp) };
    try { sessionStorage.setItem(NAV_KEY(t), JSON.stringify(clean)); } catch {}
  }

  // 게시판 목록(일반, 1페이지부터)을 받아 현재 글 위치까지 필터 기준 순서를 만듦.
  // 현재 글이 필터에 걸린 글이어도 이웃 계산을 위해 자리표시(tmp)로 넣음.
  const BOARD_CTX_MAX_PAGES = 15;
  async function buildBoardCtx(cur) {
    const curN = Number(cur);
    const listUrl = new URL(`/board/list.html?table=${encodeURIComponent(table)}`, location.href).href;
    const blocked = blockedNicksFor(table);
    const self = { n: String(cur), href: location.href.replace(/#.*$/, ''), title: '', ok: 0, notok: null, nick: '', tmp: true };
    const items = [];
    let pageLinks = {};
    let lastPg = 1;
    let found = false;
    try {
      for (let pg = 1; pg <= BOARD_CTX_MAX_PAGES; pg++) {
        const url = pg === 1 ? listUrl : (pageLinks[String(pg)] || setPg(listUrl, pg));
        const doc = await fetchDoc(url);
        const rows = [...doc.querySelectorAll('.post_item')];
        if (!rows.length) break;
        pageLinks = { ...collectPageLinks(doc, url), ...pageLinks };
        lastPg = pg;
        for (const el of rows) {
          const it = rowToItem(el, url, table);
          if (!it || items.some((x) => x.n === it.n)) continue;
          const vis = rowVisibleFor(el, table, false, blocked);
          if (!found && it.n === String(cur)) { found = true; if (!vis) it.tmp = true; items.push(it); continue; }
          if (!found && Number(it.n) < curN) { found = true; items.push(self); } // 목록에 안 보이는 글(삭제 등) 자리
          if (vis) items.push(it);
        }
        if (found) break; // 현재 글이 있는 페이지까지(나머지는 extendNav가 이어 받음)
      }
    } catch { return null; }
    return found ? { at: Date.now(), listUrl, firstPg: 1, lastPg, pageLinks, items } : null;
  }
  function loadNavList() {
    try { return JSON.parse(sessionStorage.getItem(NAV_KEY(table)) || 'null'); } catch { return null; }
  }

  // 목록 페이지 하나를 받아서(EUC-KR) 필터 통과 글 목록으로 변환. 글이 하나도 없으면 null(끝).
  async function fetchListPage(ctx, pg) {
    const hideAi = ctx.hideAi ?? hideAiFor(ctx.listUrl);
    const sk = (String(ctx.listUrl).match(/[?&]sk=([^&#]*)/) || [])[1] || '';
    // 검색 결과 목록의 1페이지(=최신 글 확인)는 검색 대신 일반 목록 1페이지 + 제목 거르기로 대체
    if (!ctx.kw && sk && pg === 1) {
      const t = (String(ctx.listUrl).match(/[?&]table=([^&#]*)/) || [])[1] || table;
      const plainUrl = new URL(`/board/list.html?table=${t}`, location.href).href;
      const doc = await fetchDoc(plainUrl);
      if (!doc.querySelector('.post_item')) return null;
      return rowsToItems(doc, plainUrl, hideAi, kwFromSk(sk));
    }
    const url = ctx.pageLinks?.[String(pg)] || setPg(ctx.listUrl, pg);
    const doc = await fetchDoc(url); // 검색 주소면 30초에 1회 제한(초과 시 예외 → 호출부에서 실패 처리)
    if (!doc.querySelector('.post_item')) return null;
    ctx.pageLinks = { ...collectPageLinks(doc, url), ...(ctx.pageLinks || {}) }; // 다음 페이지 링크 누적
    return rowsToItems(doc, url, hideAi, ctx.kw || '');
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

  // 목록 맨 위(1페이지) 글에서 ▲ 다음글: 목록을 연 뒤 새로 올라온 글을 1페이지에서 다시 받아 앞에 붙임
  async function refreshTop(ctx) {
    let got;
    try { got = await fetchListPage(ctx, 1); } catch { return false; }
    if (!got?.length) return false;
    const known = new Set(ctx.items.map((it) => it.n));
    const firstKnown = ctx.items[0]?.n;
    const idx = got.findIndex((it) => it.n === firstKnown);
    // 기존 첫 글보다 위에 있는 글 = 새 글. 기존 첫 글이 안 보이면(새 글이 한 페이지 넘게 쌓임) 1페이지의 모르는 글 전부
    const newer = (idx >= 0 ? got.slice(0, idx) : got)
      .filter((it) => !known.has(it.n) && (!firstKnown || Number(it.n) > Number(firstKnown)));
    if (!newer.length) return false;
    ctx.items = newer.concat(ctx.items);
    saveNavCtx(ctx);
    return true;
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

  // 방향(isUp)별 버튼에 item 적용. item이 null이면 숨김(restore=true면 사이트 원래 링크를 다시 표시).
  function renderNav(isUpTarget, item, restore = false) {
    for (const li of document.querySelectorAll('li.next_prev_li')) {
      const isUp = (li.querySelector('.btn')?.textContent || '').includes('다음글');
      if (isUp !== isUpTarget) continue;
      if (item) { fillNavLi(li, item); li.style.removeProperty('display'); }
      else if (restore) li.style.removeProperty('display');
      else css(li, { display: 'none' });
    }
    for (const sp of document.querySelectorAll('span.top_btn')) {
      const isUp = sp.textContent.includes('▲');
      if (isUp !== isUpTarget) continue;
      const a = sp.closest('a');
      if (!a) continue;
      if (item) { a.href = item.href; sp.id = `li_chk_${table}-${item.n}`; a.style.removeProperty('visibility'); }
      else if (restore) a.style.removeProperty('visibility');
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

    let ctx = loadNavList();
    const cur = params.get('number');
    document.documentElement.dataset.uwNav = '1';
    if (!ctx?.items || ctx.items.findIndex((it) => it.n === cur) < 0) {
      // 저장된 목록에 없는 글(다른 경로로 진입 등):
      //  - 필터가 있는 게시판(대자·얼인·패션): 게시판 목록을 직접 받아 필터 기준 순서를 새로 만듦
      //  - 필터 없는 게시판: 사이트 기본 동작 유지
      if (!filterRule || !cur) return;
      renderNav(true, null); renderNav(false, null); // 만드는 동안 필터 안 된 사이트 링크 숨김
      ctx = await buildBoardCtx(cur);
      if (!ctx) { renderNav(true, null, true); renderNav(false, null, true); return; } // 못 찾으면 원래대로
      saveNavCtx(ctx);
    }
    recordListProgress(ctx.listUrl, cur, ctx.progressKey); // 이 목록에서 마지막으로 읽은 글 = 지금 글
    {
      const kk = ctx.progressKey || keyFromUrl(ctx.listUrl);
      // 새 번호가 들어오면 저장된 판정(1분 캐시)을 버리고 바로 다시 계산
      if (addKnown(kk, ctx.items.filter((it) => !it.tmp).map((it) => it.n))) {
        store2.set(`uw-new:${kk}`, { at: Date.now(), has: knownHasNew(kk) });
        applyNewMarks();
      }
    }
    ctx.firstPg ||= 1; ctx.lastPg ||= ctx.firstPg;

    const idxOf = () => ctx.items.findIndex((it) => it.n === cur);
    let i = idxOf();
    renderNav(true, ctx.items[i - 1] || null);  // ▲ 다음글(더 최신)
    renderNav(false, ctx.items[i + 1] || null); // ▼ 이전글(더 오래됨)

    // 페이지 경계면 이웃 페이지를 불러와 이어 붙임.
    // 그래도 못 찾으면:
    //  - 검색 결과·필터 게시판(대자·얼인·패션): 숨김 유지(걸러진 글로 넘어가지 않게)
    //  - 필터 없는 게시판(차단만 있는 경우 등): 사이트 원래 이전글/다음글을 다시 보여줌
    const fromSearch = /[?&]sk=[^&]/.test(ctx.listUrl || '') || !!filterRule;
    if (!ctx.items[i + 1]) {
      const ok = await extendNav(ctx, +1);
      i = idxOf();
      renderNav(false, ctx.items[i + 1] || null, !ok && !fromSearch);
    }
    if (!ctx.items[i - 1]) {
      // 1페이지 맨 위면 목록을 연 뒤 올라온 새 글 확인(검색이면 검색 결과 1페이지), 아니면 앞 페이지 불러오기
      const ok = ctx.firstPg > 1 ? await extendNav(ctx, -1) : await refreshTop(ctx);
      i = idxOf();
      renderNav(true, ctx.items[i - 1] || null, !ok && !fromSearch);
    }
  }

  /* ── 베스트 영역 숨김 (목록·글 화면 공통) ──
   *  1) "오늘의 베스트 / 주간 베스트 …" 탭 줄: #list_top(CSS) + 다른 이름일 때 대비해 글자로도 찾음
   *  2) "OO 오늘의 베스트" 제목과 그 아래 순위(1~5위) 상자
   *  구조(id/class)를 모르는 영역은 글자로 찾고, 게시글 목록(.post_item)·본문·이전글/다음글·댓글·영상이
   *  들어 있는 상자에는 절대 손대지 않음(오삭제 방지).
   */
  const BEST_SAFE = '.post_item, .wrap_body, li.next_prev_li, #comment, video, uw-navi, #list_container';

  function hideBestTabs() {
    if (document.documentElement.dataset.uwTabsHidden) return;
    for (const a of document.querySelectorAll('a')) {
      if (a.closest('uw-navi') || !/주간\s*베스트/.test(a.textContent)) continue;
      for (let e = a.parentElement; e && e !== document.body; e = e.parentElement) {
        if (e.querySelector(BEST_SAFE)) break;
        if (/오늘의\s*베스트/.test(e.textContent)) {
          css(e, { display: 'none' });
          document.documentElement.dataset.uwTabsHidden = '1';
          return;
        }
      }
    }
  }

  function hideTodayBest() {
    if (document.documentElement.dataset.uwBestHidden) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.data.trim();
      if (!/오늘의\s*베스트$/.test(t) || t.length > 20) continue;
      const head = walker.currentNode.parentElement;
      if (!head || head.closest('uw-navi, a')) continue; // 메뉴·버튼 속 글자 제외
      // 제목에서 위로: 순위 링크 3개 이상 든 상자(제목+순위) → 그 상자 숨김.
      // 게시글 목록 등 보호 대상에 닿으면 멈추고, 그 직전 상자(=제목 줄)만 숨김.
      let target = head;
      for (let e = head; e && e !== document.body; e = e.parentElement) {
        if (e.querySelector(BEST_SAFE)) break;
        target = e;
        if (e.querySelectorAll('a[href*="read.html"]').length >= 3) break;
      }
      css(target, { display: 'none' });
      // 순위 상자가 제목과 형제로 따로 있는 경우: 바로 다음 형제가 순위 링크만 가진 상자면 함께 숨김
      const next = target.nextElementSibling;
      if (next && !next.querySelector(BEST_SAFE) && next.querySelectorAll('a[href*="read.html"]').length >= 3) {
        css(next, { display: 'none' });
      }
      document.documentElement.dataset.uwBestHidden = '1';
      return;
    }
  }

  function hideBestAreas() {
    hideBestTabs();
    hideTodayBest();
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
   * 9-2. 새 버전 자동 적용 (로더 사용 시, 알림 없음)
   *  - 로더가 새 버전을 받아 저장하면 'uw-loader:updated' 이벤트가 옴.
   *  - 페이지를 연 직후(AUTO_RELOAD_WINDOW_MS 이내)이고 아직 조작 전이면 조용히 새로고침해서 즉시 적용.
   *  - 이미 보고 있는 중이면 방해하지 않고 다음 페이지부터 자동 적용(로더가 저장해 둔 최신 코드로 실행).
   *  - 같은 버전으로 두 번 새로고침하지 않음(무한 새로고침 방지).
   * ────────────────────────────────────────────────────────── */

  const AUTO_RELOAD_WINDOW_MS = 8000; // 페이지 연 뒤 이 시간 안이고 조작 전이면 즉시 적용

  function initUpdateNotice() {
    let touched = false;
    const mark = () => { touched = true; };
    for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, mark, { capture: true, passive: true, once: true });
    window.addEventListener('scroll', () => { if (window.scrollY > 80) touched = true; }, { passive: true });

    window.addEventListener('uw-loader:updated', (e) => {
      if (e.detail) e.detail.handled = true; // 로더 자체 알림 끄기
      const ver = e.detail?.version || '';
      let last = '';
      try { last = sessionStorage.getItem('uw-auto-reloaded') || ''; } catch {}
      if (touched || last === ver || performance.now() > AUTO_RELOAD_WINDOW_MS) return; // 다음 페이지부터 적용
      try { sessionStorage.setItem('uw-auto-reloaded', ver); } catch {}
      location.reload();
    });
  }

  /* ──────────────────────────────────────────────────────────
   * 10. 메인 루프 / 생명주기 (Lifecycle)
   * ────────────────────────────────────────────────────────── */

  const OBS_CONFIG = { childList: true, subtree: true };
  // 스크립트가 만든 UI(uw-*) 내부 변경은 무시 → 재생 중 불필요한 전체 스캔 방지
  const OWN_UI_SEL = 'uw-mini, uw-navi, uw-search, uw-fab, uw-searchpanel';
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
    injectSearchFab();
    applyFilteredNav();
    dedupeNavBlocks();
    hideBestAreas();
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
  initNewMarks();
  initInactivePause();
  recordLastRead();
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
