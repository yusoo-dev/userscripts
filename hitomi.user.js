// ==UserScript==
// @name         [HITOMI]
// @namespace    user-js-css
// @version      7.40
// @updateURL    https://raw.githubusercontent.com/yusoo-dev/userscripts/main/hitomi.user.js
// @downloadURL  https://raw.githubusercontent.com/yusoo-dev/userscripts/main/hitomi.user.js
// @homepageURL  https://github.com/yusoo-dev/userscripts
// @match https://*.hitomi.la/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @run-at       document-start
// @inject-into  content
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        window.close
// @connect      translate.googleapis.com
// @connect      ltn.gold-usergeneratedcontent.net
// @noframes
// ==/UserScript==

// 중복 실행 방지: 로더(hitomi.loader.user.js)와 본체를 함께 설치한 경우 먼저 실행된 쪽만 동작
if (window === top) {
	if (document.documentElement.hasAttribute('data-hh-running')) {
		throw new Error('[HITOMI] 중복 실행 방지: 로더와 본체가 함께 설치되어 있음 — 하나만 켜 주세요');
	}
	document.documentElement.setAttribute('data-hh-running', '1');
}
// 현재 버전 (헤더 @version 과 같게 유지) — 좌측 상단에 작게 표시
const HH_VERSION = '7.40';

// 탭 닫기: 로더로 실행되면 로더가 넘긴 함수(@grant window.close 권한) 사용
const hhCloseTab = typeof __hhCloseTab === 'function' ? __hhCloseTab : () => window.close();

if (window === top) (document.head || document.documentElement).appendChild(
  Object.assign(document.createElement('style'), { textContent: ".acg,\n.imageset,\n.top-content,\n.page-container.page-top,\n.donate,\ntr:nth-child(1),\ntr:nth-child(2),\n#nozomi-link {\n  display: none !important;\n}\n\nbody,\n.navbar,\n.gallery-content,\n.page-container {\n  background-color: #474747 !important;\n  background-image: none !important;\n}\n\n.container,\n.dj,\n.container:hover,\n.dj:hover {\n  box-shadow: none !important;\n  border: none !important;\n}\n\nli, a {\n  color: #fff !important;\n  text-shadow: none !important;\n}\n\n.lillie {\n  background-color: #171717 !important;\n}\n\n.artist-list {\n  background-color: #232323 !important;\n}\n\n.dj, .manga {\n  background-color: #373737 !important;\n  height: auto !important;\n  min-height: 210px !important;\n  display: flow-root !important;\n  margin-bottom: 8px !important;\n}\n\n.dj-img-back, .date {\n  display: none !important;\n}\n\n.dj-img1, .dj-img2 {\n  transform: rotate(0) !important;\n  background-color: #000 !important;\n}\n\n.dj-img2 img {\n  transform: translate(-85px, -50%) !important;\n}\n\ntd {\n  color: #fff !important;\n}\n\n.page-container li {\n  color: #676767 !important;\n}\n\ndiv {\n  border: none !important;\n}\n\na, td {\n  font-size: 14px !important;\n}\n\np, li {\n  font-size: 11px !important;\n}" }));

// 태그 규칙(숨김/초록) + 태그 메뉴 + 제목 제외 입력창 스타일
if (window === top) (document.head || document.documentElement).appendChild(
  Object.assign(document.createElement('style'), { textContent: `
/* ================= 사이트 보정 ================= */
.hh-filtered, .gallery-content > .hh-filtered { display: none !important; }
/* 중복 숨김: '.dj, .manga { display: flow-root !important }' 보다 우선순위 높게 */
.gallery-content > .hh-dup { display: none !important; }
.gallery-content > .hh-omni-dup, .gallery-content > .hh-omni-fav-dup { display: none !important; } /* 총집편에 포함된 편 */
.relatedtags li.hidden-list-item { display: inline-block !important; }
.relatedtags li:has(> a[href*="/reader/"]) { display: none !important; }
/* 글자색 강조: 연두 = 하이라이트 태그가 있는 카드의 타이틀 / 주황 = 즐겨찾기 작가 이름
   (전역 'li, a { color: #fff !important }' 보다 선택자 우선순위가 높아야 함) */
.gallery-content > .hh-hl h1.lillie a { color: var(--hh-ok) !important; }
.artist-list a.hh-artist-fav, a.hh-artist-fav { color: var(--hh-artist) !important; }
/* 숨길 작가: 작가 페이지/설정 패널에서 보일 때 취소선 */
.artist-list a.hh-artist-hide, a.hh-artist-hide { color: var(--hh-danger) !important; text-decoration: line-through !important; opacity: .7; }
/* 썸네일 호버 시 이미지 이동 차단 (사이트는 .dj-img1 :hover 로 형제 .dj-img2 를 움직임) */
.dj-img-cont .dj-img1, .dj-img-cont .dj-img2 { pointer-events: none !important; }
.dj-img1, .dj-img2, .dj-img1 img, .dj-img2 img { transition: none !important; animation: none !important; }
/* 태그 상태 */
ul a.hh-tag-hl { outline: 2px solid var(--hh-ok) !important; outline-offset: -2px; }
ul a.hh-tag-filter { text-decoration: line-through !important; opacity: .6; }
ul a.hh-tag-block { text-decoration: line-through !important; outline: 2px solid var(--hh-danger) !important; outline-offset: -2px; opacity: .6; }
/* 상단 네비게이션 제거 — 검색창(.header-table)만 남겨 Cmd+K 오버레이로 사용
   ※ 노드는 그대로 두고 CSS로만 숨김 → 사이트 search.js 자동완성 그대로 동작 */
.navbar {
  height: 0 !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important;
  border: 0 !important; overflow: visible !important; background: none !important;
}
.navbar > :not(.header-table), .navbar > .header-table { display: none !important; }

/* ================= 공통 디자인 토큰 =================
   모든 스크립트 UI 는 아래 값만 사용 (색·글꼴·모서리·그림자·투명도 통일)
   의미 색: 연두 = 하이라이트 태그·총집편·완료 / 노랑 = 즐겨찾기 작품·시리즈 / 주황 = 즐겨찾기 작가 / 빨강 = 숨김·삭제 */
:root {
  --hh-bg: #1f1f1f; --hh-bg-deep: #171717; --hh-raised: #282828; --hh-hover: #303030;
  --hh-line: #333; --hh-line-strong: #555; --hh-overlay: rgba(0,0,0,.72);
  --hh-text: #e8e8e8; --hh-sub: #9a9a9a; --hh-dim: #6b6b6b;
  --hh-ok: #4ade80; --hh-fav: #facc15; --hh-artist: #fb923c; --hh-danger: #f87171;
  --hh-r: 8px; --hh-r-sm: 6px; --hh-pill: 999px;
  --hh-shadow: 0 10px 30px rgba(0,0,0,.45);
  --hh-ff: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  --hh-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --hh-font: 13px/1.45 var(--hh-ff);
  --hh-idle: .45; /* 화면 모서리 위젯(버전·단축키·설정·즐겨찾기 버튼 등) 평소 투명도 */
  --hh-ease: .15s ease;
}

/* ---- 공통 표면: 떠 있는 패널/메뉴/입력창 ---- */
#hh-tag-menu, #hh-panel, #hh-title-prompt, #hh-artist-pop, html.hh-search-open .navbar > .header-table {
  background: var(--hh-bg) !important; color: var(--hh-text); border: 1px solid var(--hh-line) !important;
  border-radius: var(--hh-r); box-shadow: var(--hh-shadow); font: var(--hh-font);
}
#hh-tag-menu *, #hh-panel *, #hh-favbar *, #hh-title-prompt *, #hh-artist-pop * { box-sizing: border-box; font-size: 13px !important; }

/* ---- 공통 입력창 ---- */
#hh-panel input, #hh-panel textarea, #hh-favbar input, #hh-title-prompt input, html.hh-search-open #query-input {
  width: 100%; padding: 7px 10px; border: 1px solid var(--hh-line) !important; border-radius: var(--hh-r-sm);
  background: var(--hh-bg-deep) !important; color: var(--hh-text) !important; outline: none; font: inherit;
}
#hh-panel input:focus, #hh-panel textarea:focus, #hh-favbar input:focus, #hh-title-prompt input:focus, html.hh-search-open #query-input:focus {
  border-color: var(--hh-line-strong) !important;
}
#hh-panel input::placeholder, #hh-favbar input::placeholder, #hh-title-prompt input::placeholder { color: var(--hh-dim); }

/* ---- 공통 키 표시 ---- */
#hh-panel kbd, #hh-keys kbd {
  display: inline-block; min-width: 18px; padding: 0 5px; text-align: center;
  border: 1px solid var(--hh-line); border-radius: 4px; background: var(--hh-raised); color: var(--hh-sub);
  font: 11px/16px var(--hh-mono) !important;
}

/* ---- 공통 배지(알약 모양): 의미 색만 바꿔 씀 ---- */
.hh-series-hint, #hh-favbar .fb-item .cnt, #hh-favbar .fb-head span, #hh-favbar .fb-random, #hh-rtags .tg, #hh-favbar .fb-item .omni {
  display: inline-block; padding: 0 7px; border-radius: var(--hh-pill); white-space: nowrap;
  font: 500 11px/18px var(--hh-ff) !important; letter-spacing: 0 !important;
}

/* ================= 별표 (SVG: 사이트 h1 글자 효과 차단) ================= */
.hh-star {
  all: unset; display: inline-block !important; width: 14px; height: 14px; margin-right: 5px !important;
  vertical-align: -1px; cursor: pointer; line-height: 0;
}
.hh-star svg { display: block; width: 100%; height: 100%; overflow: visible; }
.hh-star path { fill: none; stroke: var(--hh-dim); stroke-width: 1.6; stroke-linejoin: round; transition: stroke var(--hh-ease); }
.hh-star:hover path { stroke: var(--hh-sub); }
.hh-star.on path { fill: var(--hh-fav); stroke: var(--hh-fav); }

/* ================= 목록 카드 제목 옆 표시 (사이트 h1 글자 효과 차단) ================= */
.hh-pages, .hh-omnibus, .hh-series-hint {
  all: unset; text-shadow: none !important; -webkit-text-stroke: 0 !important; filter: none !important;
  text-transform: none !important; letter-spacing: 0 !important; -webkit-font-smoothing: antialiased;
}
/* 페이지 수: 흐린 글자만 */
.hh-pages { display: inline !important; margin-left: 6px !important; color: var(--hh-dim) !important; white-space: nowrap; font: 400 12px/1 var(--hh-ff) !important; }
/* [총집편]: 연두 굵은 글자 */
.hh-omnibus { display: inline !important; margin-right: 5px !important; color: var(--hh-ok) !important; font: 600 14px/1 var(--hh-ff) !important; }
/* 즐겨찾기 시리즈의 다른 편: 노랑 배지 */
.hh-series-hint {
  display: inline-block !important; margin-left: 6px !important; padding: 0 7px !important; vertical-align: 2px; cursor: pointer;
  border: 1px solid rgba(250,204,21,.5) !important; border-radius: var(--hh-pill); background: rgba(250,204,21,.12) !important;
  color: var(--hh-fav) !important; font: 500 11px/18px var(--hh-ff) !important;
}
.hh-series-hint:hover { border-color: var(--hh-fav) !important; background: rgba(250,204,21,.22) !important; }

/* ================= 클릭 메뉴 (태그/제목) + 작가 호버 팝오버: 같은 버튼 모양 ================= */
#hh-tag-menu { position: fixed; z-index: 100000; min-width: 180px; max-width: 280px; padding: 4px; }
#hh-tag-menu .hh-title {
  padding: 6px 10px 4px; color: var(--hh-sub); font-size: 12px !important;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#hh-tag-menu .hh-sep { height: 1px; margin: 4px 0; background: var(--hh-line); }
#hh-tag-menu button, #hh-artist-pop button {
  all: unset; display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--hh-r-sm);
  color: var(--hh-text); cursor: pointer; white-space: nowrap; font: var(--hh-font) !important;
  transition: background var(--hh-ease), color var(--hh-ease);
}
#hh-tag-menu button { width: 100%; box-sizing: border-box; }
#hh-tag-menu button:hover, #hh-artist-pop button:hover { background: var(--hh-hover); }
#hh-tag-menu button .mk { margin-left: auto; width: 14px; text-align: center; color: var(--hh-dim); }
#hh-tag-menu button.on .mk { color: var(--hh-ok); }
#hh-artist-pop { position: fixed; z-index: 100000; display: none; gap: 2px; padding: 4px; }
#hh-artist-pop.open { display: flex; }
#hh-artist-pop button { color: var(--hh-sub); }
#hh-artist-pop button.fav.on { color: var(--hh-artist); }
#hh-artist-pop button.hide.on { color: var(--hh-danger); }

/* ================= 제목 제외 입력창 / Cmd+K 검색 ================= */
#hh-title-prompt { position: fixed; z-index: 100001; top: 20%; left: 50%; translate: -50% 0; width: min(420px, 90vw); padding: 10px; }
#hh-title-prompt .hh-title { color: var(--hh-sub); margin: 0 2px 6px; }
#hh-title-prompt .hh-hint { color: var(--hh-dim); margin: 6px 2px 0; font-size: 11px !important; }
html.hh-search-open .navbar > .header-table {
  display: flex !important; align-items: flex-start; gap: 6px;
  position: fixed !important; z-index: 100002; top: 18%; left: 50%; transform: none !important; translate: -50% 0;
  width: min(640px, 92vw); margin: 0 !important; padding: 10px !important;
}
html.hh-search-open .navbar .search-input { flex: 1; position: relative; margin: 0 !important; width: auto !important; }
html.hh-search-open #query-input { padding: 8px 10px !important; font-size: 15px !important; }
html.hh-search-open #search-button {
  flex: none; padding: 8px 14px !important; border: 1px solid var(--hh-line) !important; border-radius: var(--hh-r-sm);
  background: var(--hh-raised) !important; color: var(--hh-text) !important; cursor: pointer; font: var(--hh-font) !important;
}
html.hh-search-open #search-button:hover { background: var(--hh-hover) !important; }
#hh-search-dim { position: fixed; inset: 0; z-index: 100001; background: rgba(0,0,0,.4); display: none; }
html.hh-search-open #hh-search-dim { display: block; }

/* ================= 화면 모서리 위젯: 평소 흐리게(--hh-idle) → 마우스 올리면 또렷하게 ================= */
#hh-ver, #hh-keys, #hh-fab, #hh-favbar-toggle, #hh-rstar, #hh-slide { opacity: var(--hh-idle); transition: opacity var(--hh-ease), color var(--hh-ease); }
#hh-ver:hover, #hh-keys:hover, #hh-fab:hover, #hh-fab.active, #hh-favbar-toggle:hover, #hh-rstar-zone:hover #hh-rstar, #hh-rstar.flash { opacity: 1; }

/* 좌측 상단 버전 */
#hh-ver {
  position: fixed; left: 8px; top: 6px; z-index: 99979; user-select: none;
  font: 10px/1.2 var(--hh-mono); color: var(--hh-sub);
  scale: var(--hh-ui-scale, 1); transform-origin: 0 0;
}
/* 좌측 하단 단축키 안내 */
#hh-keys {
  position: fixed; left: 8px; bottom: 8px; z-index: 99980;
  display: flex; flex-direction: column; gap: 3px; user-select: none;
  font: 11px/1.3 var(--hh-ff); color: var(--hh-sub);
}
#hh-keys span { display: flex; align-items: center; white-space: nowrap; }
#hh-keys kbd { min-width: 34px; margin-right: 6px; }
/* 리더 우하단 자동 넘김 상태 */
#hh-slide {
  position: fixed; right: 8px; bottom: 6px; z-index: 99999; pointer-events: none;
  font: 10px/1.2 var(--hh-mono); color: var(--hh-sub);
  scale: var(--hh-ui-scale, 1); transform-origin: 100% 100%;
}
#hh-slide.on { opacity: 1; color: var(--hh-ok); }

/* ================= 우측 즐겨찾기 사이드바 (] 키 / 버튼으로 여닫기, 상태 저장) =================
   열리면 본문을 왼쪽으로 밀어 겹치지 않게 함 */
:root { --hh-favbar-w: 460px; }
#hh-favbar {
  position: fixed; right: 0; top: 0; z-index: 99990;
  width: var(--hh-favbar-w); height: calc(100vh / var(--hh-ui-scale, 1));
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--hh-bg-deep) !important; color: var(--hh-text); border-left: 1px solid var(--hh-line) !important;
  font: var(--hh-font);
  transform: translateX(100%); visibility: hidden;
  transition: transform .18s ease, visibility 0s linear .18s;
}
html.hh-favbar-open #hh-favbar { transform: none; visibility: visible; transition: transform .18s ease; }
html.hh-favbar-open body { margin-right: calc(var(--hh-favbar-w) * var(--hh-ui-scale, 1)) !important; transition: margin-right .18s ease; }
/* 사이드바가 열리면 우측 하단 설정 버튼/패널을 왼쪽으로 */
html.hh-favbar-open #hh-fab, html.hh-favbar-open #hh-panel { right: calc(var(--hh-favbar-w) * var(--hh-ui-scale, 1) + 16px); }
/* 왼쪽 가장자리 드래그로 폭 조절 */
#hh-favbar .fb-resize { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 2; }
#hh-favbar .fb-resize:hover, html.hh-favbar-resizing #hh-favbar .fb-resize { background: rgba(250,204,21,.25); }
html.hh-favbar-resizing, html.hh-favbar-resizing * { cursor: col-resize !important; user-select: none !important; }
html.hh-favbar-resizing #hh-favbar, html.hh-favbar-resizing body { transition: none !important; }
/* 닫혔을 때 우측 가장자리 열기 버튼 */
#hh-favbar-toggle {
  all: unset; position: fixed; right: 0; top: 50%; z-index: 99989; translate: 0 -50%;
  scale: var(--hh-ui-scale, 1); transform-origin: 100% 50%;
  padding: 10px 6px; border-radius: var(--hh-r) 0 0 var(--hh-r); cursor: pointer;
  background: var(--hh-bg); border: 1px solid var(--hh-line); border-right: 0; color: var(--hh-fav);
  font: 12px/1 var(--hh-ff); box-shadow: var(--hh-shadow);
}
html.hh-favbar-open #hh-favbar-toggle { display: none; }
/* 헤더 */
#hh-favbar .fb-head { display: flex; align-items: center; gap: 8px; padding: 14px 16px 6px; user-select: none; }
#hh-favbar .fb-head b { flex: 1; color: var(--hh-sub); font-weight: 600; font-size: 11px !important; letter-spacing: .14em; }
#hh-favbar .fb-head span { min-width: 22px; text-align: center; background: var(--hh-raised); color: var(--hh-text); }
#hh-favbar .fb-random { all: unset; padding: 0 9px; border-radius: var(--hh-pill); border: 1px solid var(--hh-line); color: var(--hh-sub); cursor: pointer; transition: color var(--hh-ease), border-color var(--hh-ease); }
#hh-favbar .fb-random:hover { border-color: var(--hh-fav); color: var(--hh-fav); }
#hh-favbar .fb-close {
  all: unset; width: 24px; height: 24px; border-radius: var(--hh-r-sm); text-align: center; line-height: 24px;
  color: var(--hh-sub); cursor: pointer;
}
#hh-favbar .fb-close:hover { background: var(--hh-hover); color: var(--hh-text); }
#hh-favbar .fb-body { display: flex; flex-direction: column; min-height: 0; flex: 1; }
#hh-favbar input { margin: 4px 16px 8px; width: auto; }
#hh-favbar .fb-list { overflow: auto; overscroll-behavior: contain; padding: 4px 10px 14px; scrollbar-width: thin; scrollbar-color: var(--hh-line) transparent; }
#hh-favbar .fb-empty { color: var(--hh-dim); padding: 16px 8px; text-align: center; }
/* 작가 그룹 */
#hh-favbar .fb-group + .fb-group { margin-top: 10px; }
#hh-favbar .fb-artist {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: var(--hh-r-sm);
  cursor: pointer; user-select: none; color: var(--hh-text); font-weight: 600;
}
#hh-favbar .fb-artist:hover { background: var(--hh-hover); }
#hh-favbar .fb-artist::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--hh-artist); flex: none; }
#hh-favbar .fb-artist .arr { display: none; }
#hh-favbar .fb-artist .n { margin-left: auto; color: var(--hh-dim); font-weight: 400; font-size: 11px !important; }
#hh-favbar .fb-group.closed .fb-artist { color: var(--hh-sub); }
#hh-favbar .fb-group.closed .fb-artist::before { background: var(--hh-line-strong); }
#hh-favbar .fb-group.closed > .fb-items { display: none; }
/* 작품 카드: 큰 썸네일 + 제목은 아래, [총집편]·× 는 썸네일 위, n편·페이지 수·⚠️ 는 제목 아래 */
#hh-favbar .fb-items {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px 10px;
  margin: 6px 0 0 4px; padding-left: 8px; border-left: 1px solid var(--hh-line);
}
#hh-favbar .fb-item {
  position: relative; display: flex; flex-wrap: wrap; align-items: center; align-content: flex-start; gap: 5px 6px;
  padding: 5px; border-radius: var(--hh-r); color: var(--hh-text) !important; text-decoration: none;
  transition: background var(--hh-ease);
}
#hh-favbar .fb-item:hover { background: var(--hh-hover); }
#hh-favbar .fb-item .th {
  order: 0; flex: 0 0 100%; width: 100%; aspect-ratio: 3 / 4; border-radius: var(--hh-r-sm); object-fit: cover;
  background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
}
#hh-favbar .fb-item.series .th { box-shadow: 4px -4px 0 -1px #3a3a3a, 4px -4px 0 0 #2a2a2a; } /* 겹친 카드 느낌 */
#hh-favbar .fb-item .tt {
  order: 1; flex: 0 0 100%; min-width: 0; line-height: 1.35; font-size: 12px !important;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
#hh-favbar .fb-item .cnt, #hh-favbar .fb-item .pg, #hh-favbar .fb-item .warn { order: 2; flex: none; }
#hh-favbar .fb-item .cnt { background: rgba(250,204,21,.14); color: var(--hh-fav); }
#hh-favbar .fb-item .pg { color: var(--hh-dim); font-size: 11px !important; white-space: nowrap; }
#hh-favbar .fb-item .warn { font-size: 11px !important; line-height: 1; cursor: pointer; }
#hh-favbar .fb-item .warn:hover { transform: scale(1.2); }
#hh-favbar .fb-item .omni { position: absolute; top: 10px; left: 10px; z-index: 1; background: var(--hh-overlay); color: var(--hh-ok); font-weight: 600 !important; }
#hh-favbar .fb-item button {
  all: unset; position: absolute; top: 10px; right: 10px; z-index: 1;
  width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 50%;
  background: var(--hh-overlay); color: var(--hh-sub); cursor: pointer; opacity: 0; transition: opacity var(--hh-ease), color var(--hh-ease);
}
#hh-favbar .fb-item:hover button { opacity: 1; }
#hh-favbar .fb-item button:hover { color: var(--hh-danger); }
#hh-favbar .fb-item.dragging { opacity: .4; }
#hh-favbar .fb-item.drop { background: rgba(250,204,21,.12); outline: 1px dashed var(--hh-fav); outline-offset: -1px; }

/* ================= 리더: 우측 상단 연두 태그 목록 ================= */
/* 화면 배율과 무관하게 모서리에 붙도록 여백도 배율만큼 축소 */
#hh-rtags {
  position: fixed; top: calc(12px * var(--hh-ui-scale, 1)); right: calc(12px * var(--hh-ui-scale, 1));
  z-index: 99996; max-width: 220px;
  scale: var(--hh-ui-scale, 1); transform-origin: 100% 0;
  display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
  font: 12px/1.3 var(--hh-ff); opacity: .75; transition: opacity var(--hh-ease);
}
#hh-rtags:hover { opacity: 1; }
#hh-rtags:empty { display: none; }
#hh-rtags .hd { color: var(--hh-sub); font-size: 10px; letter-spacing: .08em; line-height: 14px; }
#hh-rtags .tg {
  background: var(--hh-overlay); border: 1px solid rgba(74,222,128,.45); color: var(--hh-ok);
  overflow: hidden; text-overflow: ellipsis; max-width: 220px;
}
#hh-rtags .tg .g { margin-left: 3px; opacity: .8; }

/* ================= 리더: 우측 상단 즐겨찾기 상태/버튼 (항상 표시) ================= */
/* 즐겨찾기 중: ★ 즐겨찾기됨(노랑, 진하게) / 아님: ☆ 즐겨찾기(흐리게). 태그 목록이 있으면 그 왼쪽 (--hh-rtags-w: JS) */
#hh-rstar-zone {
  position: fixed; top: 0; right: 0; z-index: 99995;
  width: calc(132px + var(--hh-rtags-w, 0px)); height: 80px;
}
#hh-rstar {
  position: absolute; top: 12px; right: calc(12px + var(--hh-rtags-w, 0px) + var(--hh-rtags-gap, 0px));
  display: flex; align-items: center; gap: 6px; padding: 6px 12px;
  border: 1px solid var(--hh-line); border-radius: var(--hh-pill); cursor: pointer;
  background: var(--hh-bg); color: var(--hh-sub); box-shadow: var(--hh-shadow); font: var(--hh-font);
}
#hh-rstar.on { opacity: .9; color: var(--hh-fav); }
#hh-rstar:hover { color: var(--hh-text); }
#hh-rstar.on:hover { color: var(--hh-fav); }
#hh-rstar .hh-star { margin: 0 !important; }

/* ================= 설정 버튼 / 패널 ================= */
#hh-fab {
  position: fixed; right: 16px; bottom: 20px; z-index: 99998;
  width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--hh-line); cursor: pointer;
  background: var(--hh-bg); color: var(--hh-sub); font-size: 16px; box-shadow: var(--hh-shadow);
}
#hh-fab:hover, #hh-fab.active { color: var(--hh-text); }
#hh-fab.hh-top { bottom: auto; top: 16px; }
#hh-panel {
  position: fixed; right: 16px; bottom: 66px; z-index: 99999;
  width: min(620px, calc(100vw - 32px)); height: min(76vh, 640px);
  display: none; flex-direction: column; overflow: hidden;
}
#hh-panel.open { display: flex; }
#hh-panel.hh-top { bottom: auto; top: 66px; }
#hh-panel .hh-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--hh-line); }
#hh-panel .hh-head b { flex: 1; font-weight: 600; }
#hh-panel .hh-head .kbd { color: var(--hh-dim); font-size: 12px !important; }
#hh-panel .hh-x { all: unset; width: 24px; height: 24px; border-radius: var(--hh-r-sm); text-align: center; line-height: 24px; color: var(--hh-sub); cursor: pointer; }
#hh-panel .hh-x:hover { background: var(--hh-hover); color: var(--hh-text); }
#hh-panel .hh-main { display: flex; flex: 1; min-height: 0; }
#hh-panel .hh-tabs { width: 148px; flex: none; overflow: auto; overscroll-behavior: contain; padding: 8px 6px; border-right: 1px solid var(--hh-line); }
#hh-panel .hh-group { color: var(--hh-dim); padding: 12px 8px 4px; font-size: 11px !important; }
#hh-panel .hh-group:first-child { padding-top: 2px; }
#hh-panel .hh-tab {
  display: flex; align-items: center; width: 100%; padding: 6px 8px; border: 0; border-radius: var(--hh-r-sm);
  background: none; color: var(--hh-sub); cursor: pointer; text-align: left; font: inherit; transition: background var(--hh-ease), color var(--hh-ease);
}
#hh-panel .hh-tab:hover { background: var(--hh-hover); color: var(--hh-text); }
#hh-panel .hh-tab.active { background: var(--hh-raised); color: var(--hh-text); }
#hh-panel .hh-tab .cnt { margin-left: auto; color: var(--hh-dim); font-size: 11px !important; }
@media (max-width: 560px) {
  #hh-panel .hh-main { flex-direction: column; }
  #hh-panel .hh-tabs { width: auto; display: flex; gap: 4px; border-right: 0; border-bottom: 1px solid var(--hh-line); white-space: nowrap; }
  #hh-panel .hh-group { display: none; }
  #hh-panel .hh-tab { width: auto; flex: none; }
}
#hh-panel .hh-body { padding: 14px 16px; overflow: auto; overscroll-behavior: contain; flex: 1; min-width: 0; }
#hh-panel .hh-title-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
#hh-panel .hh-title-row h3 { margin: 0; font-size: 15px !important; font-weight: 600; color: var(--hh-text); }
#hh-panel .hh-desc { color: var(--hh-sub); margin-bottom: 10px; }
#hh-panel .hh-sec { color: var(--hh-sub); margin: 14px 0 6px; }
#hh-panel .hh-add { display: flex; gap: 6px; margin-bottom: 12px; }
#hh-panel textarea { height: 140px; font-family: var(--hh-mono); resize: vertical; }
#hh-panel .hh-btn {
  padding: 6px 12px; border: 1px solid var(--hh-line); border-radius: var(--hh-r-sm); background: var(--hh-raised);
  color: var(--hh-text); cursor: pointer; white-space: nowrap; font: inherit; transition: background var(--hh-ease);
}
#hh-panel .hh-btn:hover { background: var(--hh-hover); }
#hh-panel .hh-btn.danger { color: var(--hh-danger); }
#hh-panel .hh-btn.sel { border-color: var(--hh-line-strong); }
#hh-panel .hh-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
#hh-panel .hh-empty { color: var(--hh-dim); padding: 8px 0; }
#hh-panel .hh-chips { display: flex; flex-wrap: wrap; gap: 6px; }
#hh-panel .hh-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 4px 3px 10px; background: var(--hh-raised); border-radius: var(--hh-pill); }
#hh-panel .hh-chip.hide { display: none; }
#hh-panel .hh-chip .ko { color: var(--hh-sub); }
#hh-panel .hh-chip button { all: unset; width: 18px; height: 18px; border-radius: 50%; text-align: center; line-height: 18px; color: var(--hh-dim); cursor: pointer; }
#hh-panel .hh-chip button:hover { background: var(--hh-hover); color: var(--hh-danger); }
#hh-panel ul.hh-gtags { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 0; }
#hh-panel ul.hh-gtags a { display: inline-block; padding: 3px 8px; border-radius: var(--hh-r-sm); background: var(--hh-raised); color: var(--hh-text) !important; text-decoration: none; }
#hh-panel .hh-dict { display: grid; grid-template-columns: 1fr 1fr 24px; gap: 4px 6px; align-items: center; }
#hh-panel .hh-dict span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#hh-panel .hh-dict input.auto { color: var(--hh-dim) !important; }
#hh-panel .hh-favs { display: flex; flex-direction: column; gap: 4px; }
#hh-panel .hh-fav-row { display: grid; grid-template-columns: 72px 1fr 24px; gap: 12px; align-items: center; padding: 5px; border-radius: var(--hh-r-sm); }
#hh-panel .hh-fav-row:hover { background: var(--hh-hover); }
#hh-panel .hh-fav-row img, #hh-panel .hh-fav-row .ph { width: 72px; height: 96px; object-fit: cover; border-radius: var(--hh-r-sm); background: var(--hh-bg-deep); }
#hh-panel .hh-fav-row a { color: var(--hh-text) !important; text-decoration: none; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
#hh-panel .hh-fav-row .meta { color: var(--hh-dim); font-size: 11px !important; }
#hh-panel .hh-toast { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 6px 12px; border-top: 1px solid var(--hh-line); color: var(--hh-ok); font-size: 12px !important; }
#hh-panel .hh-toast:empty::before { content: attr(data-hint); color: var(--hh-dim); }
#hh-panel .hh-toast button { all: unset; padding: 2px 8px; border-radius: var(--hh-r-sm); background: var(--hh-raised); color: var(--hh-text); cursor: pointer; }
#hh-panel .hh-toast button:hover { background: var(--hh-hover); }

/* ================= 브라우저 배율 보정 =================
   --hh-ui-scale = 1 / 브라우저 확대율 → 175% 에서도 100% 크기로 보이게 (JS 에서 계산)
   개별 scale 속성 사용: 기존 transform(슬라이드 애니메이션 등)과 겹치지 않음 */
#hh-fab, #hh-panel, #hh-favbar, #hh-title-prompt, #hh-tag-menu, #hh-keys, #hh-rstar-zone,
html.hh-search-open .navbar > .header-table { scale: var(--hh-ui-scale, 1); }
#hh-fab { transform-origin: 100% 100%; }
#hh-panel {
  transform-origin: 100% 100%;
  bottom: calc(20px + 46px * var(--hh-ui-scale, 1));
  width: min(620px, calc((100vw - 32px) / var(--hh-ui-scale, 1)));
  height: min(calc(76vh / var(--hh-ui-scale, 1)), 640px);
}
#hh-favbar { transform-origin: 100% 0; }
#hh-title-prompt { transform-origin: 50% 0; width: min(420px, calc(90vw / var(--hh-ui-scale, 1))); }
html.hh-search-open .navbar > .header-table { transform-origin: 50% 0; width: min(640px, calc(92vw / var(--hh-ui-scale, 1))) !important; }
#hh-tag-menu { transform-origin: 0 0; }
#hh-artist-pop { scale: var(--hh-ui-scale, 1); transform-origin: 0 0; }
#hh-keys { transform-origin: 0 100%; }
#hh-rstar-zone { transform-origin: 100% 0; }
` }));

// === 좌측 상단 버전 표시 ===
if (window === top) {
	const addBadge = () => {
		if (document.getElementById('hh-ver')) return;
		const el = document.createElement('div');
		el.id = 'hh-ver';
		el.textContent = `HH v${HH_VERSION}${typeof __hhCloseTab === 'function' ? ' · 로더' : ''}`;
		el.title = typeof __hhCloseTab === 'function' ? 'GitHub 로더로 실행 중' : 'Violentmonkey 설치본으로 실행 중';
		document.body.appendChild(el);
	};
	if (document.body) addBadge();
	else document.addEventListener('DOMContentLoaded', addBadge, { once: true });
}

// reader 전용 스타일 (구 [HITOMI 리더])
const isReader = /^\/reader\//.test(location.pathname);
if (isReader) (document.head || document.documentElement).appendChild(
  Object.assign(document.createElement('style'), { textContent: "#comicImages {\n  background-color: #000 !important;\n}\n\n.navbar {\n  display: none !important;\n}\n\nimg {\n  max-height: 100% !important;\n}" }));

// =====================================================================
// === 검색: language:korean 항상 포함 (입력창에는 표시 안 함) ===
// =====================================================================
// 1) search.html URL 에 language:korean 이 없으면 document-start 에서 즉시 붙여서 replace
//    → 사이트 검색창/자동완성/외부 링크 등 어떤 경로로 들어와도 보장 (다른 language: 조건은 제거)
// 2) 사이트 search.js 가 URL 쿼리로 #query-input 을 채울 때 language:korean 만 빼고 표시
const FORCE_LANG = 'language:korean';
const LANG_TERM_RE = /^-?language:/i;

function withForcedLang(query) {
	const terms = (query || '').trim().split(/\s+/).filter((t) => t && !LANG_TERM_RE.test(t));
	return [...terms, FORCE_LANG].join(' ');
}
function stripForcedLang(value) {
	const v = value || '';
	if (!v.toLowerCase().includes(FORCE_LANG)) return v;
	return v.replace(/(^|\s)language:korean(?=\s|$)/gi, '$1').replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
}
const searchUrl = (query) => `https://hitomi.la/search.html?${encodeURIComponent(withForcedLang(query))}`;

if (window === top && location.pathname === '/search.html') {
	const raw = location.search.slice(1);
	let query = raw;
	try {
		query = decodeURIComponent(raw.replace(/\+/g, ' '));
	} catch {}
	const terms = query.trim().split(/\s+/).filter(Boolean);
	const ok =
		terms.some((t) => t.toLowerCase() === FORCE_LANG) &&
		!terms.some((t) => LANG_TERM_RE.test(t) && t.toLowerCase() !== FORCE_LANG);
	if (terms.length && !ok) {
		location.replace(`/search.html?${encodeURIComponent(withForcedLang(query))}${location.hash}`);
	}
}

// 사이트(page 컨텍스트)가 #query-input.value 를 설정할 때 language:korean 을 빼고 넣음
// ※ content 스크립트에서 prototype 을 바꿔도 page 컨텍스트에는 적용되지 않으므로 주입
if (window === top && !isReader) {
	const s = document.createElement('script');
	s.textContent = `(${hideForcedLangInInput})(${JSON.stringify(FORCE_LANG)});`;
	(document.head || document.documentElement).appendChild(s);
	s.remove();
}
// ※ page 컨텍스트에서 실행됨 (외부 변수 참조 금지)
function hideForcedLangInInput(token) {
	const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
	if (!desc || !desc.set) return;
	const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp('(^|\\s)' + esc + '(?=\\s|$)', 'gi');
	Object.defineProperty(HTMLInputElement.prototype, 'value', {
		configurable: true,
		enumerable: desc.enumerable,
		get: desc.get,
		set(v) {
			if (this.id === 'query-input' && typeof v === 'string' && v.toLowerCase().includes(token)) {
				v = v.replace(re, '$1').replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
			}
			desc.set.call(this, v);
		},
	});
}
// 보정: 주입 전에 채워졌거나 attribute 로 들어간 경우 (content 스크립트에서 직접 정리)
function cleanSearchInput() {
	const input = document.getElementById('query-input');
	if (!input) return;
	const next = stripForcedLang(input.value);
	if (next !== input.value) input.value = next;
}

// =====================================================================
// === Reader 이미지 가속: preconnect + 다음 페이지 prefetch/decode ===
// =====================================================================
const IMG_DOMAIN = 'gold-usergeneratedcontent.net';


if (isReader) {
	// 1) 이미지 서버 연결(DNS+TCP+TLS) 미리 확보 → 첫 이미지 대기시간 단축
	const head = document.head || document.documentElement;
	['a1', 'a2', 'a3'].forEach((sub) => {
		head.appendChild(
			Object.assign(document.createElement('link'), {
				rel: 'preconnect',
				href: `https://${sub}.${IMG_DOMAIN}`,
			})
		);
	});

	// 2) galleryinfo / gg 는 페이지 컨텍스트 전역이라 content 스크립트에서 접근 불가
	//    → page 컨텍스트에 prefetch 로직을 주입
	const s = document.createElement('script');
	s.textContent = `(${hitomiPrefetch})(${JSON.stringify(IMG_DOMAIN)});`;
	head.appendChild(s);
	s.remove();
}

// ※ 이 함수는 페이지 컨텍스트에서 실행됨 (외부 변수 참조 금지)
function hitomiPrefetch(domain) {
	const AHEAD = 12; // 앞으로 미리 받을 장수 (2장 펼침 기준 6스프레드)
	const BEHIND = 4; // 뒤로 유지할 장수
	const HIGH = 4; // 바로 다음 2스프레드는 높은 우선순위
	const MAX_CACHE = 60; // 메모리 상한 (다음 탭이 여유 시간에 더 받으므로 여유 있게)
	const cache = new Map(); // url -> { img, page } (GC로 요청 취소 방지)
	const readyPages = new Set(); // 디코딩까지 끝난 페이지 번호 (1-based)
	const failCount = new Map(); // url -> 실패 횟수
	let strategy = null; // 'manual' | 'native' | 'off'

	// content 스크립트(페이지 넘김 게이트)와 공유: <html data-hh-ready="3,4,5">
	const root = document.documentElement;
	let publishQueued = false;
	function publish() {
		if (publishQueued) return;
		publishQueued = true;
		queueMicrotask(() => {
			publishQueued = false;
			root.setAttribute('data-hh-prefetch', strategy === 'off' ? 'off' : 'on');
			root.setAttribute('data-hh-total', String(galleryinfo.files.length));
			root.setAttribute('data-hh-ready', [...readyPages].join(','));
		});
	}

	const ready = () =>
		window.galleryinfo?.files?.length && window.gg && typeof gg.s === 'function';

	// === 리더 탭 간 대역폭 조율 ===
	// 리더를 여러 개 한꺼번에 열면 모든 탭이 동시에 미리 받기를 해서 서로 느려짐
	// → 보고 있는 탭이 최우선, 숨겨진 탭은 '연 순서'대로 순번을 매겨 조금씩(간간히) 받음
	//   (사용자는 연 순서대로 보므로 1번을 보는 동안 2번, 2번을 보는 동안 3번을 데워 둠)
	// → 보고 있는 탭이 자기 앞쪽을 다 받아 '여유(idle)'가 되면 다음 탭들이 더 많이 받음
	//    숨겨진 탭은 동시 요청 수를 1~2개로 제한해서 보고 있는 탭을 방해하지 않음
	const TAB_ID = Math.random().toString(36).slice(2);
	// 탭 순번 = 볼 순서. 기본은 탭 생성 시각이지만, 랜덤/W/E/시리즈 열기는 탭 바 순서를 맞추려고
	// 역순으로 생성하므로(openUrlsInBackground) 열 때 기록해 둔 순서(hitomi_open_order)를 우선 사용
	const OPENED_AT = (() => {
		try {
			const id = (location.pathname.match(/\/reader\/(\d+)\.html/) || [])[1];
			const v = id && (JSON.parse(localStorage.getItem('hitomi_open_order') || '{}') || {})[id];
			if (v > 0) return v;
		} catch {}
		return performance.timeOrigin;
	})();
	const peers = new Map(); // id -> { t, hidden, idle, seen }
	let selfIdle = false; // 보고 있는 탭: 앞쪽 예산만큼 다 받았는지
	let bc = null;
	try {
		bc = new BroadcastChannel('hh-reader');
	} catch {}

	function announce(type = 'hb') {
		bc?.postMessage({ type, id: TAB_ID, t: OPENED_AT, hidden: document.hidden, idle: selfIdle });
	}

	let scheduled = null;
	function schedule() {
		clearTimeout(scheduled);
		scheduled = setTimeout(() => prefetch(), 100);
	}

	if (bc) {
		bc.onmessage = (e) => {
			const m = e.data;
			if (!m || m.id === TAB_ID) return;
			if (m.type === 'bye') peers.delete(m.id);
			else peers.set(m.id, { t: m.t, hidden: m.hidden, idle: !!m.idle, seen: Date.now() });
			if (m.type === 'hello') announce(); // 새 탭에 내 존재 알림
			schedule();
		};
		setInterval(() => {
			announce();
			const now = Date.now();
			for (const [id, p] of peers) if (now - p.seen > 6000) peers.delete(id); // 닫힌 탭 정리
			schedule();
		}, 2000);
		window.addEventListener('pagehide', () => announce('bye'));
		announce('hello');
	}
	document.addEventListener('visibilitychange', () => {
		announce();
		schedule();
	});

	// 이 탭이 지금 쓸 수 있는 미리 받기 예산
	//  ahead/behind: 받을 범위, high: 높은 우선순위 장수, inflight: 동시 요청 상한(Infinity = 제한 없음)
	function budget() {
		if (!document.hidden) return { ahead: AHEAD, behind: BEHIND, high: HIGH, inflight: Infinity };
		// 나보다 먼저 열린 숨김 리더 탭 수 = 대기 순번 (0 = 지금 보는 작품 다음에 볼 탭)
		let rank = 0;
		for (const p of peers.values()) if (p.hidden && p.t < OPENED_AT) rank++;
		// 보고 있는 리더 탭이 여유인지 (보고 있는 리더 탭이 없으면 = 다른 사이트/앱 보는 중 → 여유)
		const visible = [...peers.values()].filter((p) => !p.hidden);
		const idle = !visible.length || visible.every((p) => p.idle);
		if (idle) {
			if (rank === 0) return { ahead: 40, behind: 0, high: 0, inflight: 2 }; // 다음 탭: 거의 전부
			if (rank === 1) return { ahead: 12, behind: 0, high: 0, inflight: 1 }; // 그다음: 앞쪽 6스프레드
			if (rank === 2) return { ahead: 4, behind: 0, high: 0, inflight: 1 }; // 그다음: 첫 2스프레드
			return { ahead: 0, behind: 0, high: 0, inflight: 0 };
		}
		// 보고 있는 탭이 아직 받는 중: 다음 탭만 조금씩
		if (rank === 0) return { ahead: 8, behind: 0, high: 0, inflight: 1 };
		if (rank === 1) return { ahead: 2, behind: 0, high: 0, inflight: 1 };
		return { ahead: 0, behind: 0, high: 0, inflight: 0 }; // 나머지: 사이트 기본 로딩만
	}

	// gg.js 규칙으로 직접 계산: https://a{1+m}.{domain}/{b}{s}/{hash}.avif
	function manualUrl(file) {
		const sv = gg.s(file.hash);
		return `https://a${1 + gg.m(parseInt(sv, 10))}.${domain}/${gg.b}${sv}/${file.hash}.avif`;
	}

	// 사이트 자체 함수 (시그니처 변경 대비 try)
	function nativeUrl(file) {
		try {
			return typeof url_from_url_from_hash === 'function'
				? url_from_url_from_hash(galleryinfo.id, file, 'avif')
				: null;
		} catch {
			return null;
		}
	}

	const urlFor = (file) => (strategy === 'native' ? nativeUrl(file) : manualUrl(file));

	function currentIndex() {
		const n = parseInt(location.hash.replace(/^#/, '').split('-')[0], 10);
		return isNaN(n) ? 0 : n - 1;
	}

	// 실제로 리더가 요청한 URL과 비교해서 계산식 검증 (사이트 로직 변경 시 헛요청 방지)
	function resolveStrategy() {
		const loaded = new Set(
			performance
				.getEntriesByType('resource')
				.map((e) => e.name)
				.filter((n) => n.includes(domain))
		);
		if (!loaded.size) return false; // 아직 현재 페이지 이미지가 안 뜸 → 나중에 재시도

		const file = galleryinfo.files[currentIndex()];
		if (!file) return false;

		try {
			if (loaded.has(manualUrl(file))) strategy = 'manual';
		} catch {}
		if (!strategy && loaded.has(nativeUrl(file))) strategy = 'native';
		if (!strategy) {
			strategy = 'off';
			publish();
			console.warn('[Hitomi] 이미지 URL 규칙 불일치 → prefetch 비활성화');
		}
		return true;
	}

	let retryTimer = null;
	function prefetch() {
		if (!ready()) return;
		if (!strategy && !resolveStrategy()) {
			// 재시도 체인은 하나만 유지 (탭 조율 타이머가 계속 호출하므로)
			if (!retryTimer) retryTimer = setTimeout(() => ((retryTimer = null), prefetch()), 500);
			return;
		}
		if (strategy === 'off') return;

		const files = galleryinfo.files;
		const cur = currentIndex();
		const { ahead, behind, high, inflight } = budget();

		// 예산 밖인데 아직 받는 중인 요청은 취소 (다른 탭에 대역폭 양보)
		for (const [url, entry] of cache) {
			const d = entry.page - 1 - cur;
			if (!entry.done && (d > ahead || d < -behind)) {
				entry.img.src = '';
				cache.delete(url);
			}
		}

		// 가까운 순서대로 (다음 페이지 우선)
		const order = [];
		for (let d = 1; d <= ahead; d++) order.push(cur + d);
		for (let d = 1; d <= behind; d++) order.push(cur - d);
		const HIGH = high;
		let loading = 0;
		for (const entry of cache.values()) if (!entry.done) loading++;

		order.forEach((i, rank) => {
			if (i < 0 || i >= files.length) return;
			const url = urlFor(files[i]);
			if (!url) return;

			if ((failCount.get(url) || 0) > 2) return; // 계속 실패하는 장은 사이트 기본 로딩에 맡김
			const hit = cache.get(url);
			if (hit) {
				// 빠르게 넘기는 중 바로 다음 장이 low로 대기 중이면 승격
				if (rank < HIGH && hit.img.fetchPriority !== 'high' && !hit.done) {
					hit.img.fetchPriority = 'high';
				}
				return;
			}

			// 숨김 탭: 동시 요청 상한 (하나 끝나면 markReady → publish/다음 schedule 에서 이어 받음)
			if (loading >= inflight) return;
			loading++;

			const page = i + 1;
			const entry = { img: new Image(), page, done: false };
			entry.img.decoding = 'async';
			entry.img.fetchPriority = rank < HIGH ? 'high' : 'low';
			entry.img.src = url;
			// AVIF 디코딩까지 미리 → 페이지 넘길 때 즉시 표시
			const markReady = () => {
				if (entry.done) return;
				entry.done = true;
				readyPages.add(page);
				publish();
				schedule(); // 동시 요청 상한으로 미뤄둔 다음 장 이어 받기
			};
			// 숨김 탭은 decode() 가 보일 때까지 미뤄질 수 있음 → 다운로드 완료(load)로도 완료 처리해 다음 장으로 진행
			entry.img.addEventListener('load', markReady, { once: true });
			if (entry.img.decode) entry.img.decode().then(markReady, () => {});
			// 실패: 슬롯을 비우고 잠시 뒤 재시도 (장당 최대 2번)
			entry.img.addEventListener(
				'error',
				() => {
					if (cache.get(url) !== entry) return;
					cache.delete(url);
					const n = (failCount.get(url) || 0) + 1;
					failCount.set(url, n);
					if (n <= 2) setTimeout(schedule, 3000);
				},
				{ once: true }
			);
			cache.set(url, entry);
		});

		// 현재 위치에서 먼 것부터 정리
		if (cache.size > MAX_CACHE) {
			const far = [...cache.entries()].sort(
				(a, b) => Math.abs(b[1].page - 1 - cur) - Math.abs(a[1].page - 1 - cur)
			);
			for (const [url, entry] of far.slice(0, cache.size - MAX_CACHE)) {
				cache.delete(url);
				readyPages.delete(entry.page);
			}
			publish();
		}

		// 보고 있는 탭: 앞쪽 예산을 다 받았으면 '여유'를 다른 탭에 알림 → 다음 탭들이 더 받기 시작
		const idle =
			!document.hidden &&
			order.slice(0, ahead).every((i) => i < 0 || i >= files.length || readyPages.has(i + 1));
		if (idle !== selfIdle) {
			selfIdle = idle;
			announce();
		}
	}

	// 설정 패널(content 스크립트)용 현재 작품 정보: <html data-hh-gallery="{...}">
	function publishGallery() {
		const g = window.galleryinfo;
		if (!g) return;
		root.setAttribute(
			'data-hh-gallery',
			JSON.stringify({
				title: g.title,
				tags: (g.tags || []).map((t) => ({
					tag: t.tag,
					gender: String(t.female) === '1' ? '♀' : String(t.male) === '1' ? '♂' : '',
					url: t.url,
				})),
				artists: (g.artists || []).map((a) => ({ name: a.artist, url: a.url })),
			})
		);
	}

	// galleryinfo / gg 로드 대기
	// (작품 정보는 gg 와 무관하게 galleryinfo 만 있으면 먼저 공개)
	let tries = 0;
	let galleryPublished = false;
	const boot = setInterval(() => {
		if (!galleryPublished && window.galleryinfo) {
			publishGallery();
			galleryPublished = true;
		}
		if (ready() || ++tries > 75) {
			clearInterval(boot);
			if (!galleryPublished) publishGallery();
			if (ready()) prefetch();
		}
	}, 200);

	window.addEventListener('hashchange', () => setTimeout(prefetch, 0));
}

// =====================================================================
// === 이미지 로드 실패(엑박) 자동 재요청 (목록 썸네일 + 리더) ===
// =====================================================================
// error 이벤트는 버블링되지 않으므로 capture 단계에서 문서 전체를 감시
(function setupImageRetry() {
	const MAX_RETRY = 4;
	const DELAYS = [400, 1200, 3000, 6000]; // 점진적 백오프

	// 같은 URL은 실패 응답이 캐시될 수 있어 재시도 횟수 파라미터로 우회
	function withRetryParam(url, n) {
		if (!url) return url;
		return url
			.split(',')
			.map((part) => {
				// srcset 항목: "url 2x" 형태 유지
				const [u, ...rest] = part.trim().split(/\s+/);
				const clean = u.replace(/([?&])_r=\d+(&|$)/, (m, p1, p2) => (p2 ? p1 : '')).replace(/[?&]$/, '');
				const next = `${clean}${clean.includes('?') ? '&' : '?'}_r=${n}`;
				return [next, ...rest].join(' ');
			})
			.join(', ');
	}

	document.addEventListener(
		'error',
		(e) => {
			const img = e.target;
			if (!(img instanceof HTMLImageElement)) return;
			if (!img.closest('.gallery-content, #comicImages, .dj-img-cont')) return;

			const n = Number(img.dataset.hhRetry || 0);
			if (n >= MAX_RETRY) return;
			img.dataset.hhRetry = String(n + 1);

			setTimeout(() => {
				if (!img.isConnected) return;
				// <picture> 안이면 실제로 쓰인 건 <source srcset>일 수 있으니 같이 갱신
				const picture = img.parentElement?.tagName === 'PICTURE' ? img.parentElement : null;
				picture?.querySelectorAll('source').forEach((src) => {
					const base = src.getAttribute('srcset') || src.dataset.srcset;
					if (base) src.srcset = withRetryParam(base, n + 1);
				});
				const base = img.getAttribute('src') || img.dataset.src;
				if (base) img.src = withRetryParam(base, n + 1);
				console.log(`[Hitomi] 이미지 재요청 ${n + 1}/${MAX_RETRY}`, img.currentSrc || img.src);
			}, DELAYS[n]);
		},
		true
	);

	// 성공하면 카운터 초기화 (다음에 src가 바뀌어 다시 실패해도 재시도 가능)
	document.addEventListener(
		'load',
		(e) => {
			if (e.target instanceof HTMLImageElement && e.target.dataset.hhRetry) {
				delete e.target.dataset.hhRetry;
			}
		},
		true
	);
})();

((run) => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run, { once: true }) : run())(() => {

// 이전 버전(v7.32) 업데이트 테스트 알림 플래그 정리
try {
	localStorage.removeItem('hitomi_update_test');
} catch {}

// === 한글 태그 사전 ===
// 우선순위: 사용자 사전(스페이스바 붙여넣기) > 자동 번역 캐시 > 기본 사전
const TAG_KO_STORAGE_KEY = 'hitomi_tag_ko';
const TAG_KO_AUTO_KEY = 'hitomi_tag_ko_auto';

// 자주 나오는 태그 기본 사전 (기계번역이 어색한 일본어 계열 위주)
const BUILTIN_TAG_KO = {
	'full color': '풀컬러',
	'sole female': '단독 여성',
	'sole male': '단독 남성',
	'sole dickgirl': '단독 후타',
	'females only': '여성만',
	'males only': '남성만',
	'multi-work series': '연작',
	'story arc': '스토리 아크',
	'variant set': '베리에이션',
	'no penetration': '삽입 없음',
	'mosaic censorship': '모자이크',
	'bar censorship': '바 검열',
	uncensored: '무수정',
	'first person perspective': '1인칭 시점',
	webtoon: '웹툰',
	artbook: '화집',
	'big breasts': '큰 가슴',
	'huge breasts': '폭유',
	'small breasts': '작은 가슴',
	'big ass': '큰 엉덩이',
	'big penis': '큰 성기',
	'huge penis': '거근',
	'big balls': '큰 고환',
	nakadashi: '질내사정',
	blowjob: '펠라',
	'blowjob face': '펠라 얼굴',
	'multimouth blowjob': '멀티 펠라',
	autofellatio: '셀프 펠라',
	paizuri: '파이즈리',
	footjob: '풋잡',
	handjob: '핸드잡',
	fingering: '핑거링',
	cunnilingus: '커닐링구스',
	kissing: '키스',
	anal: '애널',
	'anal intercourse': '애널 섹스',
	'double penetration': '이중 삽입',
	cowgirl: '기승위',
	squirting: '시오후키',
	lactation: '모유',
	masturbation: '자위',
	bukkake: '붓카케',
	ahegao: '아헤가오',
	'x-ray': '단면도',
	impregnation: '임신시키기',
	pregnant: '임신',
	cumflation: '정액 팽창',
	'stomach deformation': '배 변형',
	condom: '콘돔',
	'sex toys': '성인용품',
	'tail plug': '꼬리 플러그',
	defloration: '첫경험',
	netorare: 'NTR',
	netorase: '네토라세',
	cheating: '바람',
	'hidden sex': '몰래 하기',
	voyeurism: '관음',
	exhibitionism: '노출',
	blackmail: '협박',
	humiliation: '수치플',
	'mind break': '정신 붕괴',
	'mind control': '정신 조작',
	hypnosis: '최면',
	sleeping: '수면',
	drunk: '취함',
	femdom: '펨돔',
	bondage: '구속',
	blindfold: '눈가리개',
	collar: '목줄',
	harem: '하렘',
	group: '그룹',
	'ffm threesome': '여여남 3P',
	'mmf threesome': '남남여 3P',
	milf: '밀프',
	dilf: '딜프',
	gyaru: '갸루',
	'gyaru-oh': '갸루오',
	tomboy: '톰보이',
	'dark skin': '갈색 피부',
	tanlines: '태닝 자국',
	muscle: '근육',
	'old man': '아저씨',
	bbm: '뚱뚱한 남자',
	bald: '대머리',
	'ugly bastard': '추남',
	glasses: '안경',
	twintails: '트윈테일',
	ponytail: '포니테일',
	'hair buns': '똥머리',
	'long hair': '긴 머리',
	'short hair': '짧은 머리',
	'unusual pupils': '특이한 눈동자',
	heterochromia: '오드아이',
	'hairy armpits': '겨드랑이 털',
	hairy: '털',
	piercing: '피어싱',
	tattoo: '문신',
	kemonomimi: '동물 귀',
	'fox girl': '여우 소녀',
	'cat girl': '고양이 소녀',
	elf: '엘프',
	angel: '천사',
	halo: '헤일로',
	'demon girl': '악마 소녀',
	'monster girl': '몬스터 걸',
	horns: '뿔',
	wings: '날개',
	tail: '꼬리',
	tentacles: '촉수',
	futanari: '후타나리',
	'full-packaged futanari': '완전 후타나리',
	shemale: '쉬메일',
	'dickgirl on dickgirl': '후타×후타',
	'dickgirl on female': '후타×여',
	'dickgirl on male': '후타×남',
	'male on dickgirl': '남×후타',
	yuri: '백합',
	yaoi: '야오이',
	crossdressing: '여장',
	tomgirl: '오토코노코',
	'josou seme': '여장 공',
	feminization: '여성화',
	'gender change': '성전환',
	'body swap': '몸 바뀜',
	mesuiki: '메스이키',
	'chastity belt': '정조대',
	'orgasm denial': '사정 관리',
	cosplaying: '코스프레',
	stockings: '스타킹',
	pantyhose: '팬티스타킹',
	kneehighs: '니삭스',
	'thigh high boots': '사이하이 부츠',
	'garter belt': '가터벨트',
	lingerie: '란제리',
	swimsuit: '수영복',
	bikini: '비키니',
	'bunny girl': '바니걸',
	maid: '메이드',
	nurse: '간호사',
	nun: '수녀',
	witch: '마녀',
	'office lady': 'OL',
	'business suit': '정장',
	kimono: '기모노',
	'chinese dress': '차이나 드레스',
	apron: '앞치마',
	gloves: '장갑',
	yandere: '얀데레',
	tsundere: '츤데레',
	sweating: '땀',
};

// localStorage 원문이 그대로면 파싱 결과 재사용 (목록 로딩 중 매 프레임 JSON.parse 방지)
// ※ 반환값은 공유 객체 → 수정이 필요하면 복사해서 쓸 것
const jsonMemo = new Map(); // key -> { raw, value }
function readRaw(key) {
	return localStorage.getItem(key);
}
function readJSON(key, fallback) {
	const raw = readRaw(key);
	const hit = jsonMemo.get(key);
	if (hit && hit.raw === raw) return hit.value ?? fallback;
	let value = null;
	try {
		value = JSON.parse(raw);
	} catch {}
	jsonMemo.set(key, { raw, value });
	return value ?? fallback;
}

let tagKoMemo = { auto: undefined, manual: undefined, value: null };
let tagKoVersion = 0; // 사전 내용이 바뀔 때마다 증가
function getTagKo() {
	const auto = readRaw(TAG_KO_AUTO_KEY);
	const manual = readRaw(TAG_KO_STORAGE_KEY);
	if (tagKoMemo.value && tagKoMemo.auto === auto && tagKoMemo.manual === manual) {
		return tagKoMemo.value;
	}
	const value = {
		...BUILTIN_TAG_KO,
		...readJSON(TAG_KO_AUTO_KEY, {}),
		...readJSON(TAG_KO_STORAGE_KEY, {}),
	};
	tagKoMemo = { auto, manual, value };
	tagKoVersion++;
	return value;
}

// 사용자가 직접 넣은 사전만 (Cmd+X 미번역 추출 기준)
function getManualTagKo() {
	return { ...BUILTIN_TAG_KO, ...readJSON(TAG_KO_STORAGE_KEY, {}) };
}

const cleanTag = (t) =>
	(t || '')
		.replace(/[♀♂]/, '')
		.trim()
		.toLowerCase();

// === 미번역 태그 자동 번역 (Google 번역, 결과는 localStorage 캐시) ===
const autoPending = new Set();
const autoFailed = new Set();
let autoRunning = false;

function gmGet(url) {
	return new Promise((resolve, reject) => {
		if (typeof GM_xmlhttpRequest !== 'function') {
			fetch(url).then((r) => r.json()).then(resolve, reject);
			return;
		}
		GM_xmlhttpRequest({
			method: 'GET',
			url,
			responseType: 'json',
			timeout: 10000,
			onload: (r) =>
				r.status === 200
					? resolve(r.response ?? JSON.parse(r.responseText))
					: reject(new Error(String(r.status))),
			onerror: reject,
			ontimeout: reject,
		});
	});
}

async function translateBatch(tags) {
	const q = encodeURIComponent(tags.join('\n'));
	const data = await gmGet(
		`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${q}`
	);
	const lines = (data?.[0] || [])
		.map((seg) => seg?.[0] || '')
		.join('')
		.split('\n')
		.map((s) => s.trim());
	if (lines.length !== tags.length) throw new Error('line mismatch');
	return Object.fromEntries(tags.map((t, i) => [t, lines[i]]));
}

function queueAutoTranslate(tags) {
	tags.forEach((t) => {
		if (!autoFailed.has(t) && !MINOR_TAG_RE.test(t)) autoPending.add(t);
	});
	if (!autoRunning && autoPending.size) runAutoTranslate();
}

async function runAutoTranslate() {
	autoRunning = true;
	const BATCH = 40;
	try {
		while (autoPending.size) {
			const batch = [...autoPending].slice(0, BATCH);
			batch.forEach((t) => autoPending.delete(t));
			try {
				const result = await translateBatch(batch);
				const cache = { ...readJSON(TAG_KO_AUTO_KEY, {}) };
				Object.assign(cache, result);
				localStorage.setItem(TAG_KO_AUTO_KEY, JSON.stringify(cache));
				hijackTagLinks();
			} catch (err) {
				batch.forEach((t) => autoFailed.add(t)); // 이번 세션 재시도 안 함
				console.warn('[Hitomi] 자동 번역 실패', err);
			}
		}
	} finally {
		autoRunning = false;
	}
}

function mergeTagKo(obj) {
	const stored = { ...readJSON(TAG_KO_STORAGE_KEY, {}) };
	Object.assign(stored, obj);
	localStorage.setItem(TAG_KO_STORAGE_KEY, JSON.stringify(stored));
}

// === 태그 규칙 관리 (localStorage) ===
// filter: index-korean 목록에서만 숨김
// block: 검색 포함 모든 목록에서 숨김
// highlight: 카드 타이틀 초록 글자
const TAG_STORAGE_KEY = 'hitomi_filter_tags';
const BLOCK_STORAGE_KEY = 'hitomi_block_tags';
const HL_STORAGE_KEY = 'hitomi_highlight_tags';
// 제목 키워드: 제목에 포함되면 모든 목록에서 숨김 (대소문자 무시)
const TITLE_BLOCK_KEY = 'hitomi_block_titles';
// 제목 완전 일치: 타이틀 클릭 메뉴로 추가 (공백 정리 + 대소문자 무시 후 비교)
const TITLE_EXACT_KEY = 'hitomi_block_titles_exact';
const TITLE_SELECTOR = '.gallery-content h1.lillie a';

// === 작품 즐겨찾기 (별표) ===
// [{ id, title, url, thumb, addedAt }] — 최근 추가가 앞
const FAV_GALLERY_KEY = 'hitomi_fav_galleries';
const galleryUrl = (id) => `https://hitomi.la/reader/${id}.html#1-`;

function getFavGalleries() {
	const v = readJSON(FAV_GALLERY_KEY, []);
	return Array.isArray(v) ? v : [];
}
function isFavGallery(id) {
	return getFavGalleries().some((g) => g.id === id);
}
// 반환값: 토글 후 즐겨찾기 여부
function toggleFavGallery(item) {
	const list = getFavGalleries();
	const exists = list.some((g) => g.id === item.id);
	const next = exists
		? list.filter((g) => g.id !== item.id)
		: [{ ...item, addedAt: Date.now() }, ...list];
	localStorage.setItem(FAV_GALLERY_KEY, JSON.stringify(next));
	syncStars();
	document.dispatchEvent(new CustomEvent('hh-rules-changed'));
	document.dispatchEvent(new CustomEvent('hh-favs-updated'));
	return !exists;
}

// 카드에서 갤러리 ID / 썸네일 추출
function cardGalleryId(card) {
	for (const a of card.querySelectorAll('a[href]')) {
		const m = (a.getAttribute('href') || '').match(/(?:reader\/|-)(\d+)\.html/);
		if (m) return m[1];
	}
	return null;
}
function cardArtists(card) {
	return [...card.querySelectorAll('.artist-list a')]
		.map((a) => a.textContent.replace(/\s+/g, ' ').trim())
		.filter(Boolean);
}
// 썸네일 URL 정규화: srcset 이면 첫 URL, // → https:, data:/빈값/플레이스홀더 제외
function pickThumbUrl(v) {
	if (!v) return null;
	let u = v.split(',')[0].trim().split(/\s+/)[0];
	if (u.startsWith('//')) u = 'https:' + u;
	if (!/^https?:\/\//.test(u)) return null;
	if (/loading|blank|spacer|placeholder/i.test(u)) return null;
	return u;
}
// 카드 썸네일: <picture><source srcset> / img 의 lazy 속성까지 순서대로 확인
function cardThumb(card) {
	const nodes = [...card.querySelectorAll('picture source, .dj-img1 img, img')];
	for (const n of nodes) {
		const cands = [
			n.currentSrc,
			n.getAttribute('data-srcset'),
			n.getAttribute('srcset'),
			n.getAttribute('data-src'),
			n.getAttribute('src'),
		];
		for (const c of cands) {
			const u = pickThumbUrl(c);
			if (u) return u;
		}
	}
	return null;
}
// 썸네일이 없거나 깨진 경우: 목록 페이지가 쓰는 갤러리 블록 HTML 에서 다시 추출
function fetchGalleryThumb(id) {
	return gmText(`https://ltn.gold-usergeneratedcontent.net/galleryblock/${id}.html`).then((html) => {
		const re = /(?:data-srcset|srcset|data-src|src)="([^"]+)"/g;
		let m;
		while ((m = re.exec(html))) {
			const u = pickThumbUrl(m[1]);
			if (u && /\.(?:webp|avif|jpe?g|png)(?:$|\?)/i.test(u)) return u;
		}
		return null;
	});
}
// 즐겨찾기 항목 일부 필드 갱신 (최신 목록 기준으로 병합)
function patchFavGallery(id, patch) {
	const next = getFavGalleries().map((g) => (g.id === id ? { ...g, ...patch } : g));
	localStorage.setItem(FAV_GALLERY_KEY, JSON.stringify(next));
	document.dispatchEvent(new CustomEvent('hh-favs-updated', { detail: { meta: true } }));
}
// 이미지가 실제로 뜨는지 확인 (깨진 주소 저장 방지)
function canLoadImage(url, ms = 8000) {
	return new Promise((resolve) => {
		const img = new Image();
		const timer = setTimeout(() => {
			img.src = '';
			resolve(false);
		}, ms);
		img.onload = () => {
			clearTimeout(timer);
			resolve(img.naturalWidth > 0);
		};
		img.onerror = () => {
			clearTimeout(timer);
			resolve(false);
		};
		img.src = url;
	});
}
// 썸네일 자동 찾기: 후보를 순서대로 실제 로드해 보고 뜨는 첫 주소를 사용
//  1) 목록용 갤러리 블록(galleryblock)의 썸네일
//  2) 작품 첫 장의 큰 썸네일 (tn 서버, webp → avif)
async function findThumb(id) {
	const cands = [];
	try {
		const u = await fetchGalleryThumb(id);
		if (u) cands.push(u);
	} catch {}
	try {
		const text = await gmText(`https://ltn.gold-usergeneratedcontent.net/galleries/${id}.js`);
		const g = JSON.parse(text.replace(/^[^{]*/, '').replace(/;?\s*$/, ''));
		const h = g.files?.[0]?.hash;
		if (h) {
			const path = `${h.slice(-1)}/${h.slice(-3, -1)}/${h}`;
			cands.push(
				`https://tn.gold-usergeneratedcontent.net/webpbigtn/${path}.webp`,
				`https://tn.gold-usergeneratedcontent.net/avifbigtn/${path}.avif`
			);
		}
	} catch {}
	for (const u of cands) if (await canLoadImage(u)) return u;
	return null;
}
// 썸네일 없음/깨짐 → 자동으로 찾아서 저장 (세션당 ID 별 1번)
const thumbRetried = new Set();
function refreshFavThumb(id) {
	if (!id || thumbRetried.has(id)) return;
	thumbRetried.add(id);
	findThumb(id)
		.then((u) => patchFavGallery(id, u ? { thumb: u, thumbTried: 1, thumbBroken: 0 } : { thumbTried: 1, thumbBroken: 1 }))
		.catch(() => patchFavGallery(id, { thumbBroken: 1 }));
}

// 리더에 표시 중인 이미지(1페이지 우선)를 썸네일로 사용
function readerImageUrl() {
	const imgs = [...document.querySelectorAll('#comicImages img, #comicImages picture img')];
	for (const img of imgs) {
		if (!img.complete || !img.naturalWidth) continue; // 실제 로드된 이미지만
		const u = pickThumbUrl(img.currentSrc || img.src);
		if (u) return u;
	}
	return null;
}
const isReaderFirstPage = () => /^#1(?:-|$)/.test(location.hash) || !location.hash;

const STAR_SVG =
	'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.13l-5.62 2.97 1.07-6.27L2.9 9.4l6.3-.9z"/></svg>';

// 타이틀 앞에 별표 삽입 (이미 있으면 상태만 갱신)
function decorateStars() {
	const favs = getFavGalleries();
	const favIds = new Set(favs.map((g) => g.id));
	const needArtists = new Map(favs.filter((g) => !g.artists?.length || !g.thumb).map((g) => [g.id, g]));
	let backfilled = false;
	document.querySelectorAll('.gallery-content > div h1.lillie').forEach((h1) => {
		let star = h1.querySelector(':scope > .hh-star');
		if (!star) {
			const card = h1.closest('.gallery-content > div');
			const id = card && cardGalleryId(card);
			if (!id) return;
			star = document.createElement('i');
			star.className = 'hh-star';
			star.dataset.id = id;
			star.title = '즐겨찾기';
			star.innerHTML = STAR_SVG;
			h1.prepend(star);
		}
		const on = favIds.has(star.dataset.id);
		// 클래스만 토글 (바뀔 때만 → MutationObserver 루프 방지)
		if (star.classList.contains('on') !== on) star.classList.toggle('on', on);
		// 예전에 저장된 즐겨찾기(작가 정보 없음)는 카드가 보일 때 작가를 채워 넣음
		const old = needArtists.get(star.dataset.id);
		if (old) {
			needArtists.delete(star.dataset.id);
			const card = h1.closest('.gallery-content > div');
			// 비어 있으면 쓰지 않음 (매 프레임 저장 루프 방지)
			if (!old.artists?.length) {
				const names = cardArtists(card);
				if (names.length) {
					old.artists = names;
					backfilled = true;
				}
			}
			if (!old.thumb) {
				const t = cardThumb(card);
				if (t) {
					old.thumb = t;
					backfilled = true;
				}
			}
		}
	});
	if (backfilled) {
		localStorage.setItem(FAV_GALLERY_KEY, JSON.stringify(favs.map((g) => ({ ...g }))));
		document.dispatchEvent(new CustomEvent('hh-favs-updated'));
	}
}
const syncStars = () => decorateStars();

// 목록 카드 중 "즐겨찾기한 시리즈의 다른 편"(아직 즐겨찾기 안 함)에 '시리즈 n편' 표시
// 클릭하면 ☆ 와 동일하게 즐겨찾기 추가 → 사이드바 시리즈에 합류
function markSeriesCandidates() {
	const favs = getFavGalleries();
	// 페이지 수(총집편 판정)가 나중에 채워져도 다시 계산되도록 합계 포함
	const ver =
		String(favs.length) + ':' + (favs[0]?.id || '') + ':' + localStorage.getItem(SERIES_LINK_KEY) + ':' +
		localStorage.getItem(SERIES_SPLIT_KEY) + ':' + favs.reduce((sum, g) => sum + pagesOf(g), 0);
	const favIds = new Set(favs.map((g) => g.id));
	const byArtist = new Map();
	favs.forEach((g) =>
		(g.artists || []).forEach((a) => {
			const k = a.toLowerCase();
			if (!byArtist.has(k)) byArtist.set(k, []);
			byArtist.get(k).push(g);
		})
	);
	document.querySelectorAll('.gallery-content > div h1.lillie').forEach((h1) => {
		const card = h1.closest('.gallery-content > div');
		const titleA = h1.querySelector('a');
		if (!card || !titleA || card.dataset.hhSeriesV === ver) return;
		card.dataset.hhSeriesV = ver;
		h1.querySelector(':scope > .hh-series-hint')?.remove();
		card.classList.remove('hh-omni-fav-dup');
		const id = cardGalleryId(card);
		if (!id || favIds.has(id)) return;
		const artists = cardArtists(card);
		const item = { id, title: origTitle(titleA).replace(/\s+/g, ' ').trim(), artists };
		for (const a of artists) {
			const pool = byArtist.get(a.toLowerCase());
			if (!pool) continue;
			const group = groupSeries([...pool, item]).find((arr) => arr.some((x) => x.id === id));
			if (!group || group.length < 2) continue;
			// 즐겨찾기한 같은 시리즈에 총집편이 있으면 이 편은 볼 필요 없음 → 숨김
			const omnibus = group.find((x) => x.id !== id && pagesOf(x) >= OMNIBUS_PAGES);
			if (omnibus && pagesOf(item) < OMNIBUS_PAGES) {
				card.classList.add('hh-omni-fav-dup'); // 작가 페이지 포함
				break;
			}
			const n = chapterNo(item);
			const hint = document.createElement('i');
			hint.className = 'hh-series-hint';
			hint.textContent = n && n < PART_END ? `시리즈 ${n}편` : '시리즈';
			hint.title = `즐겨찾기한 "${seriesTitle(group.filter((x) => x.id !== id))}" 시리즈의 편으로 보임\n클릭: 즐겨찾기에 추가`;
			hint.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				toggleFavGallery({
					id,
					title: item.title,
					url: titleA.href || galleryUrl(id),
					thumb: cardThumb(card),
					artists,
				});
			});
			h1.append(hint);
			break;
		}
	});
}

const normalizeTag = (tag) => (tag || '').trim().toLowerCase();

function getTagList(key) {
	const v = readJSON(key, []);
	return Array.isArray(v) ? v : [];
}

function getFilterTags() {
	return getTagList(TAG_STORAGE_KEY);
}

// === 즐겨찾기 작가 ===
const FAV_ARTIST_KEY = 'hitomi_fav_artists';
const ARTIST_SELECTOR = 'a[href*="/artist/"]';

// 사이트 UI 링크 제외: 페이지네이션(?page=N), 언어 드롭다운(/artist/xxx-english.html) 등도
// /artist/, /tag/ 를 포함하므로 작가·태그 처리(색칠/클릭 메뉴/한글화)에서 빼야 함
// → 목록 페이지에선 카드(.gallery-content)와 설정 패널 안의 링크만 대상으로 삼음
const IS_LIST_PAGE =
	location.pathname === '/' ||
	/^\/(index|search|popular|artist|tag|series|character|group|type)\b/.test(location.pathname);
function isUiLink(a) {
	if (a.closest('.page-container')) return true;
	return IS_LIST_PAGE && !a.closest('.gallery-content, #hh-panel');
}

function getFavArtists() {
	return getTagList(FAV_ARTIST_KEY);
}

// === 숨길 작가: 이 작가가 참여한 작품은 모든 목록에서 숨김 (작가 페이지 제외) ===
const HIDE_ARTIST_KEY = 'hitomi_hide_artists';
function getHideArtists() {
	return getTagList(HIDE_ARTIST_KEY);
}

// 링크 텍스트 대신 href에서 이름 추출 (표시 텍스트가 바뀌어도 안정적)
function artistName(a) {
	const m = (a.getAttribute('href') || '').match(/\/artist\/(.+?)-[a-z]+\.html/);
	if (m) {
		try {
			return normalizeTag(decodeURIComponent(m[1]));
		} catch {}
	}
	return normalizeTag(a.textContent);
}

function getBlockTags() {
	return getTagList(BLOCK_STORAGE_KEY);
}

function getHighlightTags() {
	return getTagList(HL_STORAGE_KEY);
}

function getTitleBlocks() {
	return getTagList(TITLE_BLOCK_KEY);
}

function getTitleExacts() {
	return getTagList(TITLE_EXACT_KEY);
}

const normalizeTitle = (t) => (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
// 원제목 (한글 제목 축약 전 원문 기준 → 기존 '완전 일치' 규칙과 호환)
const origTitle = (a) => (a ? a.dataset.hhOrig || a.textContent : '');
const cardTitle = (card) => normalizeTitle(origTitle(card.querySelector('h1.lillie a, h1 a')));

// === 한글 제목 축약: 한글이 있으면 앞쪽 영문 부분 제거 ===
// 예) "Shuugakuryokou 99 Nichime - School Excursion 99th Day! | 수학여행 99일째" → "수학여행 99일째"
const HANGUL_RE = /[\uAC00-\uD7A3\u3131-\u318E]/;
function koreanTitle(text) {
	const t = (text || '').replace(/\s+/g, ' ').trim();
	const i = t.search(HANGUL_RE);
	if (i <= 0) return t;
	// 한글 바로 앞의 숫자/괄호/따옴표/공백은 제목 일부로 보고 포함 (| 나 영문을 만나면 중단)
	let start = i;
	while (start > 0 && /[0-9\s\[\](){}「」『』【】"'“”‘’~!?.,·&+#]/.test(t[start - 1])) start--;
	const out = t.slice(start).replace(/^[\s\-–—|:/~·,.]+/, '').trim();
	return out || t;
}
function applyKoreanTitles() {
	document.querySelectorAll('.gallery-content h1.lillie a').forEach((a) => {
		if (!a.dataset.hhOrig) {
			const orig = a.textContent.replace(/\s+/g, ' ').trim();
			if (!HANGUL_RE.test(orig)) return;
			a.dataset.hhOrig = orig;
			a.title = orig; // 호버 시 원제목
		}
		const next = koreanTitle(a.dataset.hhOrig);
		if (a.textContent !== next) a.textContent = next; // 바뀔 때만 (MutationObserver 루프 방지)
	});
}

// =====================================================================
// === 시리즈 묶기 (즐겨찾기) ===
// 같은 작가 + "회차 표기를 뺀 제목"이 같으면 한 시리즈로 봄
//  - 제목의 '|' 앞뒤(영문/국문) 각각, 원제(일본어 japanese_title)까지 키로 사용
//  - 같은 작품의 언어별 버전(languages galleryid)도 같은 시리즈로 연결
// =====================================================================
const CHAPTER_RES = [
	/#\s*\d+/g,
	/\b(?:ch(?:apter)?|ep(?:isode)?|vol(?:ume)?|part|pt|act|phase|stage|story|case|lesson|lv|no)\s*\.?\s*\d+(?:\s*[-~+&,]\s*\d+)*/gi,
	/第?\s*\d+\s*(?:話|话|화|부|권|편|章|巻|卷|回|夜|幕|번째|일째|日目|日)(?:\s*[-~]\s*\d+\s*(?:話|화|편)?)?/g,
	/(?:前|中|後|后|上|下|完結|総集|番外|続|전|중|후|상|하|완결|속)\s*(?:編|篇|편|권|부)/g,
	/\b\d+(?:st|nd|rd|th)\b/gi,
	/\b(?:after|extra|omake|epilogue|prologue|sequel|final|kouhen|zenpen|chuuhen|kanketsuhen|soushuuhen|bangaihen|zoku)\b/gi,
	/(?:후일담|외전|번외편?|프롤로그|에필로그|총집편|おまけ|後日談|総集編)/g,
];
const SINGLE_PART_RE = /(?:^|\s)(?:상|하|전|후|上|下|前|後)\s*$/;
const TRAILING_NUM_RE = /[\s\-–—:~.,]*\d+(?:\s*[-~+]\s*\d+)*\s*$/;
const TRAILING_ROMAN_RE = /\s+(?:i{1,3}|iv|vi{0,3}|ix|x)\s*$/i;

function stripChapter(text) {
	let t = (text || '').normalize('NFKC');
	CHAPTER_RES.forEach((re) => (t = t.replace(re, ' ')));
	for (let k = 0; k < 3; k++) {
		const before = t;
		t = t.replace(/[\s\-–—:~|·,.!?]+$/, '').replace(TRAILING_NUM_RE, '').replace(TRAILING_ROMAN_RE, '').replace(SINGLE_PART_RE, '');
		if (t === before) break;
	}
	return t.replace(/\s+/g, ' ').replace(/^[\s\-–—|:/~·,.]+/, '').trim();
}

function seriesKeysOf(g) {
	const keys = new Set();
	// 세그먼트: '|' 로 나눈 각 부분 + 구분자 없이 "영문 + 한글" 이 붙은 경우 영문부/한글부 각각
	const segs = [];
	[g.title, g.ot, g.jt].forEach((full) =>
		(full || '').split('|').forEach((seg) => {
			segs.push(seg);
			const i = seg.search(HANGUL_RE);
			if (i > 0 && /[A-Za-z]/.test(seg.slice(0, i))) {
				segs.push(seg.slice(0, i), koreanTitle(seg));
			}
		})
	);
	segs.forEach((seg) => {
		{
			const base = stripChapter(
				seg.normalize('NFKC').replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|【[^】]*】/g, ' ')
			).toLowerCase();
			const key = base.replace(/[^\p{L}\p{N}]+/gu, '');
			const cjk = /[぀-ヿ㐀-鿿가-힣]/.test(key);
			if (key.length >= (cjk ? 2 : 4)) keys.add(key);
		}
	});
	return keys;
}

// 회차 번호 추정 (정렬용). 못 찾으면 null
//  - 前/上/전/상=1, 中/중=2, 後/下/후/하=PART_END(마지막, 빠진 편 검사 제외)
//  - Ch.N / 第N話 / N화 / #N / Part N
//  - 본제목(부제 구분자 앞) 끝의 숫자: "…학생회장 03~엄마 사유리편" → 3
const PART_END = 1000;
function chapterNo(g) {
	const segs = [];
	[g.title, g.ot, g.jt].forEach((full) => (full || '').split('|').forEach((x) => x.trim() && segs.push(x.normalize('NFKC').trim())));
	for (const t of segs) {
		if (/(?:前|上|전|상)\s*(?:編|篇|편|권)?\s*$|\bzenpen\b/i.test(t)) return 1;
		if (/(?:中|중)\s*(?:編|篇|편)\s*$|\bchuuhen\b/i.test(t)) return 2;
		if (/(?:後|下|후|하)\s*(?:編|篇|편|권)?\s*$|\bkouhen\b/i.test(t)) return PART_END;
		const m =
			t.match(/(?:\bch(?:apter)?|\bep(?:isode)?|\bvol(?:ume)?|\bpart|\bpt|#|第)\s*\.?\s*(\d+)/i) ||
			t.match(/(\d+)\s*(?:話|话|화|편|권|巻|回|章)/);
		if (m) return +m[1];
		// 부제 구분자 앞부분(본제목)에서 단어에 붙지 않은 첫 숫자
		// "Elf 3 Saishuuwa" → 3, "학생회장 03~부제" → 3, "수학여행 99일째" → 99
		const cut = t.slice(2).search(/\s*(?:[~〜「『【:]|\s[-–—]\s?|[-–—]\s)/);
		const head = (cut >= 0 ? t.slice(0, cut + 2) : t).replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');
		const num = head.match(/(?:^|[^\p{L}\d])(\d{1,4})(?!\d)/u);
		if (num) return +num[1];
	}
	return null;
}

// 본제목: 부제 구분자(~ - : 「 등) 앞부분 + 회차 제거
// 예) "귀축교사에게 타락하는 나의 학생회장 03~엄마 사유리편" → "귀축교사에게 타락하는 나의 학생회장"
function mainTitle(text) {
	const t = (text || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
	const m = t.slice(2).search(/\s*(?:[~〜「『【:]|\s[-–—]\s?|[-–—]\s)/);
	const head = m >= 0 ? t.slice(0, m + 2) : t;
	return stripChapter(head) || stripChapter(t) || t;
}

// 비교용 이름 목록: 제목 '|' 세그먼트, "영문 한글" 혼합 시 각 부분, 원제(jt), 각각의 본제목
function seriesNamesOf(g) {
	const raw = [];
	[g.title, g.ot, g.jt].forEach((full) =>
		(full || '').split('|').forEach((seg) => {
			const i = seg.search(HANGUL_RE);
			if (i > 0 && /[A-Za-z]/.test(seg.slice(0, i))) raw.push(seg.slice(0, i), koreanTitle(seg));
			else raw.push(seg);
		})
	);
	const out = [];
	raw.forEach((r) => out.push(r, mainTitle(r)));
	return out.map(seriesTokens).filter((t) => t.length);
}
// 토큰화: 괄호 내용 제거, 구두점/부제 구분자 → 공백, 숫자·로마숫자·회차 단어 토큰 제거
const NOISE_TOKEN_RE = /^(?:\d+(?:st|nd|rd|th)?|[ivx]{1,4}|ch|chapter|vol|volume|part|pt|ep|episode|no|화|편|권|話|第)$/i;
function seriesTokens(text) {
	return (text || '')
		.normalize('NFKC')
		.toLowerCase()
		.replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|【[^】]*】/g, ' ')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.split(' ')
		.map((t) => t.replace(/^(\d+)(화|편|권|話)$/, '$1'))
		.filter((t) => t && !NOISE_TOKEN_RE.test(t));
}
const isCjk = (t) => /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3]/.test(t);
function bigrams(str) {
	const s = str.replace(/\s+/g, '');
	const m = new Map();
	for (let i = 0; i < s.length - 1; i++) {
		const b = s.slice(i, i + 2);
		m.set(b, (m.get(b) || 0) + 1);
	}
	return { m, n: Math.max(0, s.length - 1) };
}
function dice(a, b) {
	const A = bigrams(a);
	const B = bigrams(b);
	if (!A.n || !B.n) return 0;
	let hit = 0;
	A.m.forEach((c, k) => (hit += Math.min(c, B.m.get(k) || 0)));
	return (2 * hit) / (A.n + B.n);
}
// 두 이름(토큰 배열)이 같은 시리즈로 보이는지
//  R1 앞부분 공통 토큰: 3개 이상 & 8자 이상 (예: "Tenkousei JK Elf 2 -…" / "Tenkousei JK Elf 3 …")
//  R2 한쪽이 다른 쪽의 앞부분(2토큰 이상, CJK 4자/라틴 8자 이상) (예: "여름이 끝날 때까지" / "… 애널편")
//  R3 첫 단어가 같고(3자 이상) 글자 유사도 0.5 이상 (예: "귀축교사에게 함락당한 나의…" / "귀축교사에게 타락하는 나의…")
//     ※ 이름 목록에 '본제목'(부제 제거)도 들어가므로 긴 부제가 붙어도 비교됨
function sameSeriesName(a, b) {
	let lcp = 0;
	while (lcp < a.length && lcp < b.length && a[lcp] === b[lcp]) lcp++;
	const lcpText = a.slice(0, lcp).join('');
	const cjk = isCjk(lcpText);
	if (lcp >= 3 && lcpText.length >= 8) return true;
	if (lcp >= 2 && lcp === Math.min(a.length, b.length) && lcpText.length >= (cjk ? 4 : 8)) return true;
	if (lcp >= 1 && a[0].length >= 3 && dice(a.join(' '), b.join(' ')) >= 0.5) return true;
	// R4 첫 단어가 같고(3자 이상) 그 외 공통 단어가 2개 이상 (예: "…에게 함락당한 나의 학생회장" / "…에게 타락하는 나의 학생회장 03~부제")
	if (lcp >= 1 && a[0].length >= 3) {
		const setB = new Set(b.slice(1));
		const common = new Set(a.slice(1).filter((t) => setB.has(t)));
		if (common.size >= 2) return true;
	}
	return false;
}

// 수동 보정: 드래그로 묶은 쌍 / Alt+클릭으로 자동 묶음에서 뺀 ID
const SERIES_LINK_KEY = 'hitomi_series_links'; // [[idA, idB], ...]
const SERIES_SPLIT_KEY = 'hitomi_series_split'; // [id, ...]
const getSeriesLinks = () => {
	const v = readJSON(SERIES_LINK_KEY, []);
	return Array.isArray(v) ? v : [];
};
const getSeriesSplit = () => {
	const v = readJSON(SERIES_SPLIT_KEY, []);
	return new Set(Array.isArray(v) ? v : []);
};
function linkSeries(idA, idB) {
	if (idA === idB) return;
	const links = getSeriesLinks().filter(([a, b]) => !((a === idA && b === idB) || (a === idB && b === idA)));
	localStorage.setItem(SERIES_LINK_KEY, JSON.stringify([...links, [idA, idB]]));
	const split = getSeriesSplit();
	split.delete(idA);
	split.delete(idB);
	localStorage.setItem(SERIES_SPLIT_KEY, JSON.stringify([...split]));
}
function splitSeries(ids) {
	const set = new Set(ids);
	localStorage.setItem(
		SERIES_LINK_KEY,
		JSON.stringify(getSeriesLinks().filter(([a, b]) => !set.has(a) && !set.has(b)))
	);
	localStorage.setItem(SERIES_SPLIT_KEY, JSON.stringify([...new Set([...getSeriesSplit(), ...ids])]));
}

// items(같은 작가 그룹) → [[g, g, ...], ...]  (union-find)
function groupSeries(items) {
	const parent = items.map((_, i) => i);
	const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
	const union = (a, b) => (parent[find(a)] = find(b));
	const byKey = new Map();
	const byId = new Map(items.map((g, i) => [g.id, i]));
	const split = getSeriesSplit(); // 자동 판정 제외 대상
	items.forEach((g, i) => {
		if (split.has(g.id)) return;
		seriesKeysOf(g).forEach((k) => (byKey.has(k) ? union(i, byKey.get(k)) : byKey.set(k, i)));
		(g.langs || []).forEach((id) => byId.has(id) && !split.has(id) && union(i, byId.get(id)));
	});
	// 이름 유사도 (같은 작가 그룹 안에서만 호출되므로 O(n²) 허용)
	const names = items.map(seriesNamesOf);
	for (let i = 0; i < items.length; i++) {
		if (split.has(items[i].id)) continue;
		for (let j = i + 1; j < items.length; j++) {
			if (split.has(items[j].id) || find(i) === find(j)) continue;
			if (names[i].some((a) => names[j].some((b) => sameSeriesName(a, b)))) union(i, j);
		}
	}
	// 수동으로 묶은 쌍은 항상 우선
	getSeriesLinks().forEach(([a, b]) => byId.has(a) && byId.has(b) && union(byId.get(a), byId.get(b)));
	const groups = new Map();
	items.forEach((g, i) => {
		const r = find(i);
		if (!groups.has(r)) groups.set(r, []);
		groups.get(r).push(g);
	});
	return [...groups.values()].map((arr) => arr.sort(seriesOrder));
}

// 시리즈 내 순서: 회차 번호(없으면 1편 취급) → 갤러리 ID(≈ 등록 순)
//  ※ 비교 함수가 일관되도록 null 을 섞어 비교하지 않음
function seriesOrder(a, b) {
	const ca = chapterNo(a) ?? 1;
	const cb = chapterNo(b) ?? 1;
	if (ca !== cb) return ca - cb;
	// 회차가 같으면 본편(다른 편 제목의 앞부분인 쪽)을 먼저: "여름이 끝날 때까지" → "… 집에서편"
	const ta = normalizeTitle(koreanTitle(a.title));
	const tb = normalizeTitle(koreanTitle(b.title));
	if (ta && tb && ta !== tb) {
		if (tb.startsWith(ta)) return -1;
		if (ta.startsWith(tb)) return 1;
	}
	return (+a.id || 0) - (+b.id || 0);
}

// 시리즈 중간에 빠진 회차: 번호가 있는 편들의 최소~최대 사이에서 비는 번호
// (번호 없는 본편 = 1편, 後編 등 마지막 표기는 제외, 범위가 30 넘으면 일차/연도 등으로 보고 검사 안 함)
function missingChapters(arr) {
	const nums = [...new Set(arr.map((g) => chapterNo(g) ?? 1).filter((n) => n < PART_END))].sort((a, b) => a - b);
	if (nums.length < 2) return [];
	const min = nums[0];
	const max = nums[nums.length - 1];
	if (max - min > 30) return [];
	const have = new Set(nums);
	const out = [];
	for (let n = min; n <= max; n++) if (!have.has(n)) out.push(n);
	return out;
}

// 빠진 편 검색어: 원제의 로마자/영문 본제목(회차·부제 제거) 단어들
// hitomi 검색은 공백으로 나눈 단어가 모두 제목에 있는 작품을 찾음 → 언어/작가명 표기와 무관
function seriesSearchQuery(arr) {
	// 편마다 표기가 다를 수 있으므로(Ochita / Ochiru …) 모든 편에 공통인 단어만 사용
	const lists = [];
	for (const g of arr) {
		for (const full of [g.ot, g.title]) {
			const latin = (full || '').split('|').map((x) => x.trim()).find((x) => /[a-z]/i.test(x) && !HANGUL_RE.test(x));
			if (!latin) continue;
			const words = seriesTokens(mainTitle(latin)).filter((w) => /^[a-z0-9]+$/.test(w) && w.length >= 2);
			if (words.length) {
				lists.push(words);
				break;
			}
		}
	}
	if (!lists.length) return '';
	const common = lists[0].filter((w) => lists.every((l) => l.includes(w)));
	const words = common.length >= 2 ? common : lists[0];
	return [...new Set(words)].slice(0, 6).join(' ');
}

// 전체 즐겨찾기를 "열기 단위"로 묶음: 시리즈 = 1단위, 단독 작품 = 1단위
// (시리즈 판정은 작가별로 하고, 공동 작가 작품처럼 여러 작가 그룹에 걸친 경우 ID 기준으로 합침)
function favUnits() {
	const favs = getFavGalleries();
	const byArtist = new Map();
	favs.forEach((g) =>
		(g.artists?.length ? g.artists : ['']).forEach((a) => {
			if (!byArtist.has(a)) byArtist.set(a, []);
			byArtist.get(a).push(g);
		})
	);
	const parent = new Map(favs.map((g) => [g.id, g.id]));
	const find = (id) => (parent.get(id) === id ? id : (parent.set(id, find(parent.get(id))), parent.get(id)));
	byArtist.forEach((items) =>
		groupSeries(items).forEach((arr) => arr.forEach((g) => parent.set(find(g.id), find(arr[0].id))))
	);
	const units = new Map();
	favs.forEach((g) => {
		const r = find(g.id);
		if (!units.has(r)) units.set(r, []);
		units.get(r).push(g);
	});
	return [...units.values()].map((arr) => arr.sort(seriesOrder));
}

// 랜덤 n단위 열기 (시리즈는 전 편을 열되 1개로 침)
// 새로고침 전까지는 이미 뽑은 단위를 제외하고 뽑음. 전부 뽑으면 처음부터 다시
const randomPicked = new Set(); // 단위 키 = 정렬된 ID 목록
const unitKey = (arr) => arr.map((g) => g.id).sort().join(',');
function openRandomFavs(n = 5) {
	const all = favUnits();
	let pool = all.filter((arr) => !randomPicked.has(unitKey(arr)));
	let reset = false;
	if (!pool.length) {
		randomPicked.clear(); // 한 바퀴 다 돌았으면 초기화
		pool = all;
		reset = true;
	}
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	const picked = pool.slice(0, n);
	picked.forEach((arr) => randomPicked.add(unitKey(arr)));
	openUrlsInBackground(picked.flatMap((arr) => arr.map((g) => g.url || galleryUrl(g.id))));
	const tabs = picked.reduce((sum, arr) => sum + arr.length, 0);
	const left = all.filter((arr) => !randomPicked.has(unitKey(arr))).length;
	console.log(`[Hitomi] 랜덤 ${picked.length}개 (탭 ${tabs}개) 열림 · 남은 ${left}개${reset ? ' (한 바퀴 완료 → 초기화)' : ''}`, picked.map((a) => seriesTitle(a)));
	return { units: picked.length, tabs, left, reset };
}

// 시리즈 대표 제목: 한글 제목이 있는 편을 우선, 회차 표기 제거
function seriesTitle(arr) {
	const ko = arr.filter((g) => HANGUL_RE.test(g.title || ''));
	const pool = (ko.length ? ko : arr).map((g) => (koreanTitle(g.title) || g.id).replace(/\s+/g, ' ').trim());
	if (arr.length === 1) return pool[0];
	// 표시용: 공통 앞부분 단어(2개 이상)가 있으면 그것, 없으면 가장 짧은 제목에서 회차 제거
	const words = pool.map((t) => t.split(' '));
	let n = 0;
	while (words.every((w) => w[n] !== undefined && w[n] === words[0][n])) n++;
	const common = words[0].slice(0, n).join(' ').replace(/[\s\-–—:~|·,.]+$/, '');
	if (n >= 2 && common) return stripChapter(common) || common;
	// 공통부가 짧으면(유사도로 묶인 경우) 첫 편의 본제목(부제·회차 제거)을 그대로 표시
	return mainTitle(pool[0]);
}

// === 즐겨찾기 메타(원제/언어별 버전/작가) 백그라운드 보강 ===
// 1회만 조회해 저장 (meta: 1). 실패한 ID 는 이번 세션 재시도 안 함
const metaFailed = new Set();
// 메타 버전: 2 = 원제(ot)까지 저장, 3 = 페이지 수(pages). 낮은 버전은 다시 조회해 보강
const META_VERSION = 3;
let metaRunning = false;
function fetchGalleryMeta(id) {
	return gmText(`https://ltn.gold-usergeneratedcontent.net/galleries/${id}.js`).then((text) =>
		normalizeGalleryInfo(JSON.parse(text.replace(/^[^{]*/, '').replace(/;?\s*$/, '')))
	);
}
async function syncFavMeta() {
	if (metaRunning) return;
	metaRunning = true;
	try {
		for (let n = 0; n < 60; n++) {
			const target = getFavGalleries().find(
				(g) => ((g.meta || 0) < META_VERSION || (!g.thumb && !g.thumbTried)) && !metaFailed.has(g.id)
			);
			if (!target) break;
			try {
				// 썸네일 없음(리더에서 추가 등) → 갤러리 블록에서 추출
				if (!target.thumb && !target.thumbTried) {
					const thumb = await findThumb(target.id).catch(() => null);
					patchFavGallery(target.id, { thumb: thumb || null, thumbTried: 1 });
					if ((target.meta || 0) >= META_VERSION) continue;
				}
				const info = await fetchGalleryMeta(target.id);
				rememberPages(target.id, info.pages);
				const next = getFavGalleries().map((g) =>
					g.id !== target.id
						? g
						: {
								...g,
								ot: info.title || '', // hitomi 원제 (보통 로마자 + 한글/영문)
								jt: info.jtitle || '',
								langs: info.langs || [],
								pages: info.pages || g.pages || 0,
								artists: g.artists?.length ? g.artists : info.artists.map((a) => a.name).filter(Boolean),
								meta: META_VERSION,
							}
				);
				localStorage.setItem(FAV_GALLERY_KEY, JSON.stringify(next));
				document.dispatchEvent(new CustomEvent('hh-favs-updated', { detail: { meta: true } }));
			} catch (err) {
				metaFailed.add(target.id);
				console.warn('[Hitomi] 즐겨찾기 정보 조회 실패', target.id, err);
			}
			await new Promise((r) => setTimeout(r, 300));
		}
	} finally {
		metaRunning = false;
	}
}

// =====================================================================
// === 페이지 수 (목록 카드 배지 + 즐겨찾기) ===
// galleries/{id}.js 의 files 길이. 작품 페이지 수는 바뀌지 않으므로 localStorage 캐시
// =====================================================================
const PAGE_COUNT_KEY = 'hitomi_page_counts'; // { [id]: n } (백업 대상 아님 — 언제든 재조회 가능)
const PAGE_COUNT_MAX = 5000; // 넘으면 ID 작은(오래된) 작품부터 정리
const PAGE_CONCURRENCY = 4;
const OMNIBUS_PAGES = 100; // 이 페이지 수 이상이면 총집편으로 보고 제목 앞에 [총집편]
let pageCounts = null;
let pageSaveTimer = null;
function getPageCounts() {
	if (!pageCounts) {
		const v = readJSON(PAGE_COUNT_KEY, {});
		pageCounts = v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : {};
	}
	return pageCounts;
}
function rememberPages(id, n) {
	if (!id || !(n > 0)) return;
	const map = getPageCounts();
	if (map[id] === n) return;
	map[id] = n;
	clearTimeout(pageSaveTimer);
	pageSaveTimer = setTimeout(() => {
		// 다른 탭에서 저장한 것과 합침
		const merged = { ...readJSON(PAGE_COUNT_KEY, {}), ...map };
		const keys = Object.keys(merged); // 정수 키 → 오름차순(ID 순)
		if (keys.length > PAGE_COUNT_MAX) keys.slice(0, keys.length - PAGE_COUNT_MAX).forEach((k) => delete merged[k]);
		pageCounts = merged;
		try {
			localStorage.setItem(PAGE_COUNT_KEY, JSON.stringify(merged));
		} catch {}
	}, 500);
}
const pagesOf = (g) => g.pages || getPageCounts()[g.id] || 0;

const pageQueue = [];
const pageQueued = new Set();
const pageFailed = new Set(); // 이번 세션 재시도 안 함
let pageActive = 0;
function queuePageCount(id) {
	if (pageQueued.has(id) || pageFailed.has(id) || getPageCounts()[id]) return;
	pageQueued.add(id);
	pageQueue.push(id);
	pumpPageQueue();
}
function pumpPageQueue() {
	while (pageActive < PAGE_CONCURRENCY && pageQueue.length) {
		const id = pageQueue.shift();
		pageActive++;
		fetchGalleryMeta(id)
			.then((info) => {
				rememberPages(id, info.pages);
				decoratePageCounts();
			})
			.catch(() => pageFailed.add(id))
			.finally(() => {
				pageActive--;
				pageQueued.delete(id);
				pumpPageQueue();
			});
	}
}
// 목록 카드 제목 옆에 "24p" 배지 (숨김 카드는 조회 생략)
function decoratePageCounts() {
	const map = getPageCounts();
	document.querySelectorAll('.gallery-content > div h1.lillie').forEach((h1) => {
		const card = h1.closest('.gallery-content > div');
		if (!card || card.classList.contains('hh-filtered') || card.classList.contains('hh-dup')) return;
		const id = cardGalleryId(card);
		if (!id) return;
		const n = map[id];
		if (!n) return queuePageCount(id);

		// [총집편] 표시 (제목 링크 바로 앞, 링크 텍스트는 건드리지 않음 → 한글 제목/규칙 비교 영향 없음)
		const isOmnibus = n >= OMNIBUS_PAGES;
		const tag = h1.querySelector(':scope > .hh-omnibus');
		if (isOmnibus && !tag) {
			const titleA = h1.querySelector(':scope > a');
			const el = document.createElement('i');
			el.className = 'hh-omnibus';
			el.textContent = '[총집편]';
			el.title = `${OMNIBUS_PAGES}p 이상`;
			titleA ? titleA.before(el) : h1.append(el);
		} else if (!isOmnibus && tag) tag.remove();

		const text = `${n}p`;
		let badge = h1.querySelector(':scope > .hh-pages');
		if (badge?.textContent === text) return; // 바뀔 때만 (MutationObserver 루프 방지)
		if (!badge) {
			badge = document.createElement('i');
			badge.className = 'hh-pages';
			badge.title = '페이지 수';
			h1.append(badge);
		}
		badge.textContent = text;
	});
	arrangeOmnibus();
}

// 총집편 정리 (목록 페이지)
// 1) 총집편 카드를 목록 맨 위로 (총집편끼리는 원래 순서 유지)
// 2) 같은 목록에서 총집편과 같은 시리즈로 보이는 편(같은 작가 + 시리즈 판정)은 숨김
//    - 시리즈 판정은 즐겨찾기 사이드바와 같은 groupSeries (수동 묶기/해제도 반영)
//    - 같은 작품의 다른 판이므로 작가 페이지에서도 숨김
let omnibusSig = '';
function arrangeOmnibus() {
	const box = document.querySelector('.gallery-content');
	if (!box) return;
	const map = getPageCounts();
	const cards = [...box.children].filter((c) => c.tagName === 'DIV');
	const info = cards.map((card) => {
		const id = cardGalleryId(card);
		const a = card.querySelector('h1.lillie a');
		return {
			card,
			id,
			n: (id && map[id]) || 0,
			title: a ? origTitle(a).replace(/\s+/g, ' ').trim() : '',
			artists: cardArtists(card),
		};
	});
	const omni = info.filter((x) => x.id && x.n >= OMNIBUS_PAGES);

	// 1) 맨 위로 (순서가 다를 때만 이동 → MutationObserver 루프 방지)
	if (omni.length && omni.some((x, i) => cards[i] !== x.card)) box.prepend(...omni.map((x) => x.card));

	// 2) 포함 편 숨김 — 카드 구성/페이지 수/수동 묶기가 같으면 재계산 생략
	const sig =
		location.pathname + '|' + readRaw(SERIES_LINK_KEY) + '|' + readRaw(SERIES_SPLIT_KEY) + '|' +
		info.map((x) => `${x.id}:${x.n}:${x.title}:${x.artists.join('/')}`).join('\u0001');
	if (sig === omnibusSig) return;
	omnibusSig = sig;

	const hide = new Set();
	const counts = new Map(); // 총집편 id -> 숨긴 편 수
	if (omni.length) {
		const lower = (arr) => arr.map((a) => a.toLowerCase());
		omni.forEach((o) => {
			const oa = new Set(lower(o.artists));
			// 같은 작가끼리만 비교. 작가 정보가 없는 카드는 제목 판정만으로 비교
			const cands = info.filter(
				(x) =>
					x !== o &&
					x.id &&
					x.n < OMNIBUS_PAGES &&
					(!oa.size || !x.artists.length || lower(x.artists).some((a) => oa.has(a)))
			);
			if (!cands.length) return;
			const group = groupSeries([o, ...cands].map(({ id, title, artists }) => ({ id, title, artists }))).find(
				(g) => g.some((x) => x.id === o.id)
			);
			const parts = (group || []).filter((x) => x.id !== o.id);
			parts.forEach((x) => hide.add(x.id));
			if (parts.length) counts.set(o.id, parts.length);
		});
	}
	info.forEach((x) => {
		const on = hide.has(x.id);
		if (x.card.classList.contains('hh-omni-dup') !== on) x.card.classList.toggle('hh-omni-dup', on);
	});
	omni.forEach((o) => {
		const label = o.card.querySelector('h1.lillie > .hh-omnibus');
		if (!label) return;
		const c = counts.get(o.id);
		const next = `${OMNIBUS_PAGES}p 이상` + (c ? ` · 이 목록에서 포함된 편 ${c}개 숨김` : '');
		if (label.title !== next) label.title = next;
	});
}

// 있으면 제거, 없으면 추가. 반환값: 토글 후 포함 여부
function toggleTag(key, tag) {
	const normalized = normalizeTag(tag);
	if (!normalized) return false;
	const tags = [...getTagList(key)];
	const idx = tags.indexOf(normalized);
	if (idx >= 0) tags.splice(idx, 1);
	else tags.push(normalized);
	localStorage.setItem(key, JSON.stringify(tags));
	return idx < 0;
}

// === index-korean 페이지 여부 ===
function isIndexKoreanPage() {
	if (window.location.pathname !== '/index-korean.html') return false;
	const params = new URLSearchParams(window.location.search);
	for (const key of params.keys()) {
		if (key !== 'page') return false;
	}
	return true;
}

// === 태그 규칙 적용 (숨김 + 초록 타이틀) ===
// class 토글 방식 → 규칙 해제 시 즉시 원복 가능
// 규칙이 안 바뀌었으면 이미 처리한 카드/링크는 건너뜀 (목록 로딩 중 매 프레임 전체 재계산 방지)
let rulesVersion = 0;
let rulesSig = null;
function applyTagRules() {
	const sig = [TAG_STORAGE_KEY, BLOCK_STORAGE_KEY, HL_STORAGE_KEY, FAV_ARTIST_KEY, HIDE_ARTIST_KEY, TITLE_BLOCK_KEY, TITLE_EXACT_KEY]
		.map(readRaw)
		.join('\u0000');
	if (sig !== rulesSig) {
		rulesSig = sig;
		rulesVersion++;
	}
	const v = String(rulesVersion);

	const filter = new Set(getFilterTags());
	const block = new Set(getBlockTags());
	const highlight = new Set(getHighlightTags());
	const favArtists = new Set(getFavArtists());
	const hideArtists = new Set(getHideArtists());
	const titleBlocks = getTitleBlocks();
	const titleExacts = new Set(getTitleExacts());
	const canFilter = isIndexKoreanPage();
	// 작가 페이지에선 주황, 태그 페이지에선 연두 표시 제외 (전부 해당되니 의미 없음)
	const isArtistPage = location.pathname.startsWith('/artist/');
	const isTagPage = location.pathname.startsWith('/tag/');

	document.querySelectorAll('.gallery-content > div').forEach((card) => {
		if (card.dataset.hhV === v) return;
		card.dataset.hhV = v;

		let isFiltered = false;
		let isBlocked = false;
		let isHl = false;
		card.querySelectorAll('a[href*="/tag/"]').forEach((a) => {
			const t = normalizeTag(a.getAttribute('data-tag') || a.textContent);
			if (filter.has(t)) isFiltered = true;
			if (block.has(t)) isBlocked = true;
			if (highlight.has(t)) isHl = true;
		});

		const title = titleBlocks.length || titleExacts.size ? cardTitle(card) : '';
		const isTitleBlocked =
			!!title && (titleExacts.has(title) || titleBlocks.some((w) => title.includes(w)));

		const names = [...card.querySelectorAll(`.artist-list ${ARTIST_SELECTOR}`)].map(artistName);
		const isArtistHidden = hideArtists.size > 0 && names.some((n) => hideArtists.has(n));

		// 작가 페이지에서도 숨김 규칙 적용. 단 '숨길 작가'는 작가 페이지에선 제외
		// (숨긴 작가의 페이지에 직접 들어가면 목록이 통째로 비는 것 방지)
		card.classList.toggle(
			'hh-filtered',
			isBlocked || isTitleBlocked || (!isArtistPage && isArtistHidden) || (canFilter && isFiltered)
		);
		card.classList.toggle('hh-hl', isHl && !isTagPage);

		const isFav = names.some((n) => favArtists.has(n));
		card.classList.toggle('hh-fav', isFav && !isArtistPage);
	});

	// 작가 링크 자체에도 표시
	document.querySelectorAll(ARTIST_SELECTOR).forEach((a) => {
		if (isUiLink(a)) return;
		if (a.dataset.hhV === v) return;
		a.dataset.hhV = v;
		const n = artistName(a);
		a.classList.toggle('hh-artist-fav', favArtists.has(n));
		a.classList.toggle('hh-artist-hide', hideArtists.has(n));
	});

	// 태그 자체에도 상태 표시 (data-tag 세팅 전 링크는 다음 기회에)
	document.querySelectorAll('ul a[href*="/tag/"][data-tag]').forEach((a) => {
		if (isUiLink(a)) return;
		if (a.dataset.hhV === v) return;
		a.dataset.hhV = v;
		const t = normalizeTag(a.getAttribute('data-tag'));
		a.classList.toggle('hh-tag-hl', highlight.has(t));
		a.classList.toggle('hh-tag-block', block.has(t));
		a.classList.toggle('hh-tag-filter', !block.has(t) && filter.has(t));
	});
}

// === 태그 클릭 메뉴 ===
function closeTagMenu() {
	document.getElementById('hh-tag-menu')?.remove();
}

// 공통 팝업 메뉴
function openMenu(anchor, titleText, items) {
	closeTagMenu();

	const menu = document.createElement('div');
	menu.id = 'hh-tag-menu';

	const title = document.createElement('div');
	title.className = 'hh-title';
	title.textContent = titleText;
	menu.appendChild(title);

	// 토글 항목: 오른쪽에 ✓ / 이동 항목(link): 구분선 아래 ↗
	let sepAdded = false;
	items.forEach(({ label, on, run, link }) => {
		if (link && !sepAdded) {
			sepAdded = true;
			menu.appendChild(Object.assign(document.createElement('div'), { className: 'hh-sep' }));
		}
		const btn = document.createElement('button');
		btn.type = 'button';
		const text = document.createElement('span');
		text.textContent = label;
		const mark = document.createElement('span');
		mark.className = 'mk';
		mark.textContent = link ? '↗' : on ? '✓' : '';
		btn.append(text, mark);
		if (on) btn.classList.add('on');
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			run();
			closeTagMenu();
			applyTagRules();
			document.dispatchEvent(new CustomEvent('hh-rules-changed'));
		});
		menu.appendChild(btn);
	});

	document.body.appendChild(menu);

	// 화면 밖으로 나가지 않게 위치 보정
	const r = anchor.getBoundingClientRect();
	const mr = menu.getBoundingClientRect(); // UI 배율(scale) 적용된 실제 크기
	const mw = mr.width;
	const mh = mr.height;
	const left = Math.min(r.left, window.innerWidth - mw - 8);
	const top =
		r.bottom + 4 + mh > window.innerHeight ? r.top - mh - 4 : r.bottom + 4;
	menu.style.left = `${Math.max(8, left)}px`;
	menu.style.top = `${Math.max(8, top)}px`;
}

function openTagMenu(anchor) {
	const tag = anchor.getAttribute('data-tag');
	if (!tag) return;

	const norm = normalizeTag(tag);
	const isFiltered = getFilterTags().includes(norm);
	const isBlocked = getBlockTags().includes(norm);
	const isHl = getHighlightTags().includes(norm);
	const ko = anchor.getAttribute('data-ko');

	openMenu(anchor, ko ? `${ko} · ${tag}` : tag, [
		{ label: '연두 타이틀', on: isHl, run: () => toggleTag(HL_STORAGE_KEY, tag) },
		{ label: '메인에서 숨기기', on: isFiltered, run: () => toggleTag(TAG_STORAGE_KEY, tag) },
		{ label: '항상 숨기기', on: isBlocked, run: () => toggleTag(BLOCK_STORAGE_KEY, tag) },
		{ label: '태그 페이지', link: true, run: () => (location.href = anchor.href) },
	]);
}

// === 작가 호버 팝오버: 즐겨찾기 / 숨기기 ===
// 작가 이름에 마우스를 올리면 바로 아래에 버튼 2개. 클릭은 원래 링크대로 작가 페이지 이동
// (즐겨찾기 ↔ 숨기기는 서로 배타: 한쪽에 넣으면 다른 쪽에서 빠짐)
function setupArtistHover() {
	const SHOW_DELAY = 120; // 목록 위를 지나가기만 할 때 깜빡임 방지
	const HIDE_DELAY = 220; // 링크 → 팝오버로 마우스 옮기는 시간
	let pop = null;
	let favBtn = null;
	let hideBtn = null;
	let anchor = null;
	let name = '';
	let showTimer = null;
	let hideTimer = null;

	function ensure() {
		if (pop) return;
		pop = document.createElement('div');
		pop.id = 'hh-artist-pop';
		favBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'fav' });
		hideBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'hide' });
		favBtn.addEventListener('click', (e) => toggle(e, FAV_ARTIST_KEY, HIDE_ARTIST_KEY));
		hideBtn.addEventListener('click', (e) => toggle(e, HIDE_ARTIST_KEY, FAV_ARTIST_KEY));
		pop.append(favBtn, hideBtn);
		pop.addEventListener('mousedown', (e) => e.stopPropagation()); // 메뉴/패널 닫기 핸들러로 새지 않게
		pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
		pop.addEventListener('mouseleave', scheduleHide);
		document.body.appendChild(pop);
	}

	function sync() {
		const fav = getFavArtists().includes(name);
		const hidden = getHideArtists().includes(name);
		favBtn.textContent = fav ? '★ 즐겨찾기됨' : '☆ 즐겨찾기';
		hideBtn.textContent = hidden ? '⊘ 숨김됨' : '⊘ 숨기기';
		favBtn.classList.toggle('on', fav);
		hideBtn.classList.toggle('on', hidden);
	}

	function toggle(e, key, otherKey) {
		e.preventDefault();
		e.stopPropagation();
		if (!name) return;
		if (toggleTag(key, name)) {
			localStorage.setItem(otherKey, JSON.stringify(getTagList(otherKey).filter((x) => x !== name)));
		}
		applyTagRules();
		document.dispatchEvent(new CustomEvent('hh-rules-changed'));
		// 숨겨서 카드가 사라졌거나 패널이 다시 그려져 링크가 없어지면 닫기
		if (!anchor?.isConnected || anchor.offsetParent === null) return hide();
		sync();
	}

	function show(a) {
		const n = artistName(a);
		if (!n) return;
		ensure();
		closeTagMenu();
		anchor = a;
		name = n;
		sync();
		pop.classList.add('open');
		const r = a.getBoundingClientRect();
		const pr = pop.getBoundingClientRect(); // 배율(scale) 적용된 실제 크기
		const left = Math.min(r.left, window.innerWidth - pr.width - 8);
		const top = r.bottom + 2 + pr.height > window.innerHeight ? r.top - pr.height - 2 : r.bottom + 2;
		pop.style.left = `${Math.max(8, left)}px`;
		pop.style.top = `${Math.max(8, top)}px`;
	}

	function hide() {
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
		pop?.classList.remove('open');
		anchor = null;
		name = '';
	}
	function scheduleHide() {
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
		hideTimer = setTimeout(hide, HIDE_DELAY);
	}

	$(document)
		.on('mouseenter', ARTIST_SELECTOR, function () {
			if (isUiLink(this)) return;
			clearTimeout(hideTimer);
			clearTimeout(showTimer);
			const a = this;
			if (anchor === a && pop?.classList.contains('open')) return;
			showTimer = setTimeout(() => show(a), anchor ? 0 : SHOW_DELAY); // 이미 떠 있으면 즉시 옮김
		})
		.on('mouseleave', ARTIST_SELECTOR, scheduleHide);
	window.addEventListener('scroll', hide, { passive: true });
	document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
}
setupArtistHover();

function openTitleMenu(anchor) {
	const raw = origTitle(anchor).replace(/\s+/g, ' ').trim();
	const norm = normalizeTitle(raw);
	if (!norm) return;
	const isExcluded = getTitleExacts().includes(norm);

	openMenu(anchor, raw, [
		{ label: '이 제목 숨기기', on: isExcluded, run: () => toggleTag(TITLE_EXACT_KEY, norm) },
		{ label: '열기', link: true, run: () => (location.href = anchor.href) },
	]);
}

// 메뉴 바깥 클릭 / Esc / 스크롤 시 닫기
document.addEventListener('mousedown', (e) => {
	if (!e.target.closest?.('#hh-tag-menu')) closeTagMenu();
});
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') closeTagMenu();
});
window.addEventListener('scroll', closeTagMenu, { passive: true });

// === 태그 이벤트 (위임: 한 번만 등록) ===
$(document)
	.on('click', 'ul a[href*="/tag/"]', function (e) {
		if (isUiLink(this)) return; // 페이지 이동은 기본 동작 유지
		e.preventDefault();
		e.stopPropagation();
		openTagMenu(this);
	})
	.on('click', '.hh-star', function (e) {
		e.preventDefault();
		e.stopPropagation();
		const card = this.closest('.gallery-content > div');
		const titleA = card?.querySelector('h1.lillie a');
		toggleFavGallery({
			id: this.dataset.id,
			// 화면엔 한글로 축약돼 보이므로 원제목(영문 | 한글 전체)을 저장 → 시리즈 비교에 필요
			title: origTitle(titleA).replace(/\s+/g, ' ').trim(),
			url: titleA?.href || galleryUrl(this.dataset.id),
			thumb: card ? cardThumb(card) : null,
			artists: card ? cardArtists(card) : [],
		});
	})
	.on('click', TITLE_SELECTOR, function (e) {
		if (e.metaKey || e.ctrlKey || e.shiftKey) return; // 새 탭 열기는 기본 동작 유지
		// 드래그로 글자를 선택한 경우: 메뉴 대신 제목 제외 입력창(setupDragTitlePrompt)이 뜨므로 무시
		if (window.getSelection()?.toString().trim()) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		openTitleMenu(this);
	})
	.on('mouseenter', 'ul a[href*="/tag/"]', function () {
		const tag = $(this).attr('data-tag');
		if (tag) $(this).text(tag);
	})
	.on('mouseleave', 'ul a[href*="/tag/"]', function () {
		const next = $(this).attr('data-ko') || cleanTag($(this).attr('data-tag'));
		if (next) $(this).text(next);
	});

// === 태그 한글화 + 성별 배경색 ===
// force: 사전 갱신 시 이미 번역된 태그도 다시 적용
// ※ 텍스트는 바뀔 때만 쓴다 (MutationObserver 무한 루프 방지)
function hijackTagLinks(force = false) {
	const dict = getTagKo();
	const kv = String(tagKoVersion);
	const missing = new Set();

	document.querySelectorAll('ul a[href*="/tag/"]').forEach((a) => {
		if (isUiLink(a)) return;
		// 최초 1회: 원문 보관 + 성별 배경색
		if (!a.hasAttribute('data-tag')) {
			const original = a.textContent.trim();
			const suffix = original.match(/[♀♂]$/)?.[0] || '';
			a.setAttribute('data-tag', original);
			if (suffix === '♀') a.style.background = '#ff7eb3';
			if (suffix === '♂') a.style.background = '#7ec8e3';
		}

		// 같은 사전 버전으로 이미 처리했으면 건너뜀 (미번역 태그 매 프레임 재처리 방지)
		if (!force && a.dataset.hhKo === kv) return;
		a.dataset.hhKo = kv;

		const clean = cleanTag(a.getAttribute('data-tag'));
		const ko = dict[clean];
		const next = ko || clean;

		if (ko) a.setAttribute('data-ko', ko);
		else {
			a.removeAttribute('data-ko');
			missing.add(clean);
		}
		// 호버 중(원문 표시)이 아니면 텍스트 갱신. 바뀔 때만 써서 MutationObserver 루프 방지
		if (!a.matches(':hover') && a.textContent !== next) a.textContent = next;
	});

	if (missing.size) queueAutoTranslate(missing);
}

// === 태그 정렬: 연두(즐겨찾기) 태그 먼저 → 각 묶음 안에서 남자 ♂ → 여자 ♀ → 기타 ===
// 같은 순위끼리는 사이트 원래 순서 유지 (안정 정렬)
function tagGenderRank(original, href = '') {
	const t = (original || '').trim();
	if (/♂$/.test(t)) return 0;
	if (/♀$/.test(t)) return 1;
	let path = href;
	try {
		path = decodeURIComponent(href);
	} catch {}
	if (/\/tag\/male:/i.test(path)) return 0;
	if (/\/tag\/female:/i.test(path)) return 1;
	return 2;
}
function tagSortRank(original, href, hl) {
	return (hl.has(normalizeTag(original)) ? 0 : 3) + tagGenderRank(original, href);
}

// 목록 카드(+ 설정 패널 현재 작품)의 태그 ul 정렬. 순서가 바뀔 때만 DOM 이동 (MutationObserver 루프 방지)
function sortTagLists(root = document) {
	const hl = new Set(getHighlightTags());
	const sig = readRaw(HL_STORAGE_KEY) || '';
	root.querySelectorAll('.gallery-content ul, #hh-panel ul.hh-gtags').forEach((ul) => {
		const items = [...ul.children];
		if (!items.some((li) => li.querySelector?.('a[href*="/tag/"]'))) return;
		const key = sig + '|' + items.length + '|' + items.map((li) => li.textContent.length).join(',');
		if (ul.dataset.hhSort === key) return;
		const ranked = items.map((li, i) => {
			const a = li.querySelector('a[href*="/tag/"]');
			// 태그가 아닌 항목(… 더보기 등)은 맨 뒤
			const rank = a ? tagSortRank(a.getAttribute('data-tag') || a.textContent, a.getAttribute('href') || '', hl) : 99;
			return { li, i, rank };
		});
		ranked.sort((a, b) => a.rank - b.rank || a.i - b.i);
		if (ranked.some((r, i) => r.li !== items[i])) ul.append(...ranked.map((r) => r.li));
		ul.dataset.hhSort = key;
	});
}

// === 페이지 네비게이션 ===
const isSearchPage = /^\/search\.html/.test(window.location.pathname);

// search.html: hash 기반 (#2, #3, ...)
function handleSearchNavigation(key) {
	if (!['a', 'd', 's', 'ㅁ', 'ㅇ', 'ㄴ'].includes(key)) return false;

	// S: 탭 닫기
	if (key === 's' || key === 'ㄴ') {
		try {
			hhCloseTab();
		} catch {}
		return true;
	}

	let cur = parseInt(location.hash.replace('#', ''), 10);

	if (isNaN(cur)) {
		cur = 2;
		location.hash = '#2';
		return true;
	}

	if (key === 'a' || key === 'ㅁ') {
		if (cur > 2) {
			location.hash = '#' + (cur - 1);
		} else {
			location.hash = '';
		}
	} else if (key === 'd' || key === 'ㅇ') {
		location.hash = '#' + (cur + 1);
	}

	return true;
}

// 일반 페이지: query param 기반 (?page=N)
function handleQueryParamNavigation(key) {
	if (!['a', 'd', 'ㅁ', 'ㅇ'].includes(key)) return false;

	const url = new URL(window.location.href);
	let page = parseInt(url.searchParams.get('page') || '1', 10);

	if (['a', 'ㅁ'].includes(key)) {
		if (page <= 1) return true;
		page--;
	} else {
		page++;
	}

	if (page === 1) {
		url.search = '';
	} else {
		url.searchParams.set('page', page);
	}

	window.location.href = url.toString();
	return true;
}

// === 좌측 하단 단축키 안내 ===
function setupKeyHints() {
	if (document.getElementById('hh-keys')) return;
	const keys = isReader
		? [
				['A', '다음'], ['D', '이전'], ['S', '닫기'], ['F', '즐겨찾기'], ['[', '자동 넘김'], [']', '정지'],
				['- +', '속도'], ['⌘A', '작품 정보'], [',', '설정'],
			]
		: [
				['A', '이전'], ['D', '다음'], ['S', '닫기'], [']', '즐겨찾기'], ['W', '전부 열기'], ['E', '연두 열기'], ['R', '랜덤 5'],
				['⌘A', '미방문 열기'], ['⌘클릭', '새 탭'], ['Space', '제목 제외'], ['⌘K', '검색'], [',', '설정'],
			];
	const box = document.createElement('div');
	box.id = 'hh-keys';
	keys.forEach(([k, label]) => {
		const span = document.createElement('span');
		const kbd = document.createElement('kbd');
		kbd.textContent = k;
		span.append(kbd, label);
		box.append(span);
	});
	document.body.appendChild(box);
}

// === 제목 제외 키워드 입력창 (스페이스바) ===
function openTitlePrompt() {
	if (document.getElementById('hh-title-prompt')) return;
	closeTagMenu();

	const box = document.createElement('div');
	box.id = 'hh-title-prompt';
	const title = document.createElement('div');
	title.className = 'hh-title';
	title.textContent = '제목 제외 키워드';
	const input = document.createElement('input');
	input.placeholder = '이 단어가 포함된 제목은 숨김';
	input.value = (window.getSelection()?.toString() || '').trim(); // 드래그한 텍스트 프리필
	const hint = document.createElement('div');
	hint.className = 'hh-hint';
	hint.textContent = 'Enter 추가 · Esc 닫기 · 설정(⚙) > 제목 제외에서 관리 (목록에서 글자 드래그 / Space 로 열기)';
	box.append(title, input, hint);
	document.body.appendChild(box);

	const close = () => box.remove();
	input.addEventListener('keydown', (e) => {
		e.stopPropagation(); // 목록 단축키(A/D/S 등)로 새지 않게
		if (e.key === 'Escape') return close();
		if (e.key !== 'Enter' || e.isComposing) return; // 한글 조합 중 Enter 무시
		const v = normalizeTag(input.value);
		if (!v) return close();
		const cur = getTitleBlocks();
		if (!cur.includes(v)) localStorage.setItem(TITLE_BLOCK_KEY, JSON.stringify([...cur, v]));
		applyTagRules();
		document.dispatchEvent(new CustomEvent('hh-rules-changed'));
		const hidden = document.querySelectorAll('.gallery-content > .hh-filtered').length;
		console.log(`[Hitomi] 제목 제외 "${v}" 추가 (현재 숨김 ${hidden}개)`);
		close();
	});
	input.addEventListener('blur', close);
	input.focus();
	input.select();
}

// === 목록에서 글자를 드래그(선택)하면 바로 제목 제외 입력창 (선택한 글자 프리필) ===
function setupDragTitlePrompt() {
	const MAX_LEN = 80; // 너무 긴 선택(여러 카드 통째 등)은 무시
	document.addEventListener('mouseup', (e) => {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
		// 스크립트 UI·입력창 안에서의 선택은 제외
		if (e.target.closest?.('input, textarea, [contenteditable], #hh-panel, #hh-favbar, #hh-tag-menu, #hh-title-prompt, #hh-artist-pop, .navbar')) return;
		// 선택이 확정된 뒤 확인
		setTimeout(() => {
			const sel = window.getSelection();
			if (!sel || sel.isCollapsed || !sel.rangeCount) return;
			const text = sel.toString().replace(/\s+/g, ' ').trim();
			if (!text || text.length > MAX_LEN) return;
			const node = sel.getRangeAt(0).commonAncestorContainer;
			const el = node.nodeType === 1 ? node : node.parentElement;
			if (!el?.closest?.('.gallery-content')) return; // 목록 카드 안의 글자만
			openTitlePrompt();
		}, 0);
	});
}

// 백그라운드 탭 열기: GM_openInTab 우선, 없으면 window.open (브라우저 설정에 따라 포커스 이동 가능)
// 여러 개를 순서대로 열기: GM_openInTab(insert) 는 매번 "현재 탭 바로 뒤"에 끼워 넣어
// 순서가 뒤집히므로 역순으로 호출 → 탭 바에는 1, 2, 3… 순서로 놓임
// 리더 탭 미리 받기 순번용: 여러 개를 열 때 "볼 순서(탭 바 순서)"를 갤러리 ID 별로 기록
// (실제 탭 생성은 역순이라 생성 시각으로는 순서를 알 수 없음) — 하루 지난 기록은 정리
const OPEN_ORDER_KEY = 'hitomi_open_order'; // 백업 대상 아님
function rememberOpenOrder(urls) {
	const base = Date.now();
	let map = {};
	try {
		map = JSON.parse(localStorage.getItem(OPEN_ORDER_KEY) || '{}') || {};
	} catch {}
	for (const k of Object.keys(map)) if (!(map[k] > base - 86400000)) delete map[k];
	urls.forEach((u, i) => {
		const id = (String(u).match(/\/reader\/(\d+)\.html/) || [])[1];
		if (id) map[id] = base + i / 1000; // 같은 배치 안에서는 인덱스 순, 생성 시각(ms)과도 비교 가능
	});
	try {
		localStorage.setItem(OPEN_ORDER_KEY, JSON.stringify(map));
	} catch {}
}

function openUrlsInBackground(urls) {
	rememberOpenOrder(urls);
	if (typeof GM_openInTab === 'function') {
		[...urls].reverse().forEach((u) => GM_openInTab(u, { active: false, insert: true, setParent: true }));
	} else {
		urls.forEach((u) => window.open(u, '_blank', 'noopener')); // 브라우저 기본 배치(열린 순서 유지)
	}
}

function openInBackground(url) {
	rememberOpenOrder([url]);
	if (typeof GM_openInTab === 'function') {
		GM_openInTab(url, { active: false, insert: true, setParent: true });
	} else {
		window.open(url, '_blank', 'noopener');
	}
}

// 현재 목록에서 화면에 보이는 카드(숨김/중복 숨김 제외)를 백그라운드 탭으로 열기
// onlyHighlighted: 연두 타이틀 카드만 / false 면 방문 여부·색 상관없이 전부
function openCardsInBackground({ onlyHighlighted = false } = {}) {
	const visited = JSON.parse(localStorage.getItem('hitomi') || '[]');
	const seen = new Set();
	const targets = [];
	const sel = onlyHighlighted ? '.gallery-content > .hh-hl:not(.hh-filtered)' : '.gallery-content > div:not(.hh-filtered)';
	document.querySelectorAll(sel).forEach((card) => {
		if (card.offsetParent === null) return; // display:none (중복 숨김 등)
		const url = card.querySelector('h1.lillie a')?.href;
		if (!url || seen.has(url)) return;
		seen.add(url);
		targets.push({ url, card });
	});
	const label = onlyHighlighted ? '연두 타이틀' : '현재 목록';
	if (!targets.length) return console.log(`[Hitomi] ${label} 작품 없음`);

	openUrlsInBackground(targets.map((t) => t.url)); // 화면 순서대로
	targets.forEach(({ url, card }) => {
		if (!visited.includes(url)) visited.push(url);
		card.style.opacity = '0.6'; // Cmd+A 와 동일하게 방문 표시
	});
	localStorage.setItem('hitomi', JSON.stringify(visited));
	console.log(`[Hitomi] ${label} ${targets.length}개 백그라운드로 열림`);
}

// === 단축키 ===
document.addEventListener('keydown', async (e) => {
	// reader 페이지는 아래 Reader 블록이 처리
	if (isReader) return;

	const isInput = ['INPUT', 'TEXTAREA'].includes(
		document.activeElement.tagName
	);
	if (document.activeElement.isContentEditable) return;
	if (isInput) return;

	// Cmd/Ctrl 조합키는 metaKey 체크 후 처리
	if (e.metaKey || e.ctrlKey) {
		// Cmd+A: 미방문 만화 새 탭으로 열기
		if (e.key === 'a') {
			e.preventDefault();
			const visited = JSON.parse(localStorage.getItem('hitomi') || '[]');
			const seen = new Set();
			const unopened = [];
			$(
				'.gallery-content > div:visible a[href^="https://hitomi.la/reader/"]'
			).each(function () {
				const url = $(this).attr('href');
				if (!visited.includes(url) && !seen.has(url)) {
					seen.add(url);
					unopened.push(url);
				}
			});
			unopened.forEach((url) => {
				window.open(url, '_blank');
				visited.push(url);
			});
			if (unopened.length) {
				localStorage.setItem('hitomi', JSON.stringify(visited));
				unopened.forEach((url) => {
					$(`.gallery-content a[href="${url}"]`)
						.closest('div')
						.css('opacity', '0.6');
				});
				console.log(`[Hitomi] 미방문 ${unopened.length}개 열림`);
			} else {
				console.log('[Hitomi] 미방문 항목 없음');
			}
			return;
		}

		// Cmd+X: 번역 안 된 태그 배열 복사
		if (e.key === 'x') {
			e.preventDefault();
			const dict = getManualTagKo(); // 자동번역분은 미번역으로 취급 → 다듬어서 덮어쓰기 가능
			const untranslated = [];
			$('ul a[href*="/tag/"]').each(function () {
				const original = ($(this).attr('data-tag') || '').trim();
				const clean = original
					.replace(/[♀♂]/, '')
					.trim()
					.toLowerCase();
				if (!dict[clean] && clean && !untranslated.includes(clean)) {
					untranslated.push(clean);
				}
			});
			if (untranslated.length) {
				await navigator.clipboard.writeText(
					JSON.stringify(untranslated, null, 2)
				);
				console.log(
					`[Hitomi] 번역 안 된 태그 ${untranslated.length}개 복사됨`,
					untranslated
				);
			} else {
				console.log('[Hitomi] 모든 태그 번역 완료');
			}
			return;
		}

		// 그 외 Cmd 조합은 브라우저 기본 동작 유지
		return;
	}

	// W: 현재 목록의 모든 작품 백그라운드로 열기 (방문/색 상관없이)
	if (e.key === 'w' || e.key === 'W' || e.key === 'ㅈ') {
		e.preventDefault();
		if (e.repeat) return;
		openCardsInBackground();
		return;
	}

	// E: 타이틀이 연두색(하이라이트 태그)인 작품 전부 백그라운드 새 탭으로 열기
	if (e.key === 'e' || e.key === 'E' || e.key === 'ㄷ') {
		e.preventDefault();
		if (e.repeat) return;
		openCardsInBackground({ onlyHighlighted: true });
		return;
	}

	// R: 즐겨찾기에서 랜덤 5개 열기 (사이드바 '랜덤 5' 버튼과 동일 — 버튼이 있으면 결과도 버튼에 표시)
	if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') {
		e.preventDefault();
		if (e.repeat) return;
		const btn = document.querySelector('#hh-favbar .fb-random');
		if (btn) btn.click();
		else openRandomFavs(5);
		return;
	}

	// 스페이스바: 클립보드에 번역 객체(JSON)가 있으면 사전 저장, 아니면 제목 제외 입력창
	// ※ await 이후엔 preventDefault 가 안 먹으므로 먼저 막음 (스페이스 스크롤 비활성)
	if (e.key === ' ') {
		e.preventDefault();
		if (e.repeat) return;
		let obj = null;
		try {
			obj = JSON.parse(await navigator.clipboard.readText());
		} catch {
			// JSON 아니거나 권한 없으면 무시
		}
		if (obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0) {
			const count = Object.keys(obj).length;
			mergeTagKo(obj);
			hijackTagLinks(true);
			console.log(`[Hitomi] 사전 ${count}개 추가됨`, obj);
		} else {
			openTitlePrompt();
		}
		return;
	}

	// A/D/S 네비게이션: search.html이면 hash 방식, 아니면 query param 방식
	const key = e.key.toLowerCase();
	if (isSearchPage) {
		if (handleSearchNavigation(key)) e.preventDefault();
	} else {
		if (handleQueryParamNavigation(key)) e.preventDefault();
	}
});

// === 링크 변환 + loli 제거 ===
// root 범위로 한정 (기존: 매 mutation마다 문서 전체 a 스캔)
function replaceLinks(root = document) {
	const $root = $(root);
	$root
		.find('a[href^="/"][href$=".html"]')
		.each(function () {
			const href = this.getAttribute('href') || '';
			const m = href.match(/-(\d+)\.html(?:$|[?#])/);
			if (m) this.href = `https://hitomi.la/reader/${m[1]}.html#1-`;
		});

	// 미성년 관련 태그 항목 제거 (번역 후에도 걸리도록 원문 data-tag 기준)
	$root
		.find('a')
		.filter(function () {
			const t = (this.getAttribute('data-tag') || this.textContent).toLowerCase();
			return MINOR_TAG_RE.test(t);
		})
		.each(function () {
			$(this).closest('div.dj, div.imageset, div.manga, div.acg').remove();
		});
}

const MINOR_TAG_RE = /loli/;

// === 중복 숨김 ===
// 화면에 보이는 제목(한글 축약 후, 띄어쓰기·문장부호 무시)이 같으면 하나만 남김
// 예) "Set | 셋" / "Setto | 셋" → 둘 다 "셋" 으로 보이므로 두 번째 숨김
// (decensored) 표기는 빼고 비교하고, 같은 제목이면 decensored 판을 남김 (없으면 먼저 나온 것)
// 예) "제목" / "제목 (decensored)" → "제목" 숨김
const DECENSORED_STRIP_RE = /[\[(（【]\s*decensored\s*[\])）】]|\bdecensored\b/gi;
const DECENSORED_TEST_RE = /\bdecensored\b/i;
function hideDjOnDuplicate() {
	const pages = getPageCounts();
	const norm = (t) => t.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
	const entries = [];
	const groups = new Map();
	document.querySelectorAll('.lillie a').forEach((a) => {
		const raw = origTitle(a);
		const clean = raw.replace(DECENSORED_STRIP_RE, ' ');
		// 띄어쓰기·문장부호 차이는 무시 ("좋을걸" = "좋을 걸")
		const key = norm(koreanTitle(clean));
		if (!key) return;
		const card = a.closest('.gallery-content > div') || a.closest('div');
		if (!card) return;
		// 로마자/영문 원제 (번역판끼리 같은 경우가 많음)
		const latinSeg = clean.split('|').map((x) => x.trim()).find((x) => /[a-z]/i.test(x) && !HANGUL_RE.test(x)) || '';
		const e = {
			card,
			key,
			dec: DECENSORED_TEST_RE.test(raw),
			id: cardGalleryId(card),
			latin: norm(latinSeg.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')),
			artists: new Set(cardArtists(card).map((x) => x.toLowerCase())),
			ch: chapterNo({ title: clean }),
		};
		entries.push(e);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(e);
	});

	const hide = new Set();
	// 1) 화면 제목이 같은 것: 하나만 남김 (decensored 우선, 없으면 먼저 나온 것). 작가 페이지 포함
	groups.forEach((list) => {
		const keep = list.find((x) => x.dec) || list[0];
		list.forEach((e) => e !== keep && hide.add(e));
	});

	// 2) decensored 판이 있으면 같은 작품의 다른 번역/판도 숨김
	//    같은 작가 + 같은 회차 + (원제 동일 | 제목 유사도: 페이지 수 ±3 이면 0.5↑, 페이지 수 모르면 0.75↑)
	//    예) "다음은, 더 기분 좋을걸 (Decensored)" 가 있으면 "다음에는, 더 기분 좋을거야", "다음은, 좀더 기분 좋을걸" 숨김
	const decs = entries.filter((e) => e.dec && !hide.has(e));
	if (decs.length) {
		entries.forEach((e) => {
			if (e.dec || hide.has(e)) return;
			const same = decs.some((d) => {
				if (![...d.artists].some((x) => e.artists.has(x))) return false;
				if ((d.ch ?? 1) !== (e.ch ?? 1)) return false;
				if (d.latin && d.latin.length >= 6 && d.latin === e.latin) return true;
				const sim = dice(d.key, e.key);
				const pd = d.id && pages[d.id];
				const pe = e.id && pages[e.id];
				return pd && pe ? Math.abs(pd - pe) <= 3 && sim >= 0.5 : sim >= 0.75;
			});
			if (same) hide.add(e);
		});
	}

	// 적용: 클래스 토글 (바뀔 때만 → Observer 루프 방지)
	// ※ inline style.display='none' 은 사이트 보정 CSS '.dj, .manga { display: flow-root !important }' 에 져서 안 숨겨졌음
	entries.forEach((e) => {
		const on = hide.has(e);
		if (e.card.classList.contains('hh-dup') !== on) e.card.classList.toggle('hh-dup', on);
	});
}


// =====================================================================
// === 플로팅 설정 패널 (우측 하단, 마우스가 가까이 오면 버튼 표시) ===
// =====================================================================
// === 현재 작품 정보 ===
// 리더/갤러리 상세 URL 끝의 숫자 = 갤러리 ID
const CURRENT_GALLERY_ID = location.pathname.match(/(\d+)\.html$/)?.[1] || null;
let galleryInfoPromise = null;

function gmText(url) {
	return new Promise((resolve, reject) => {
		if (typeof GM_xmlhttpRequest !== 'function') {
			fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(r.status))).then(resolve, reject);
			return;
		}
		GM_xmlhttpRequest({
			method: 'GET',
			url,
			timeout: 10000,
			onload: (r) => (r.status === 200 ? resolve(r.responseText) : reject(r.status)),
			onerror: reject,
			ontimeout: reject,
		});
	});
}

function normalizeGalleryInfo(g) {
	return {
		title: g.title,
		tags: (g.tags || []).map((t) => ({
			tag: t.tag,
			gender: String(t.female) === '1' ? '♀' : String(t.male) === '1' ? '♂' : '',
			url: t.url,
		})),
		artists: (g.artists || []).map((a) => ({ name: a.artist, url: a.url })),
		jtitle: g.japanese_title || '',
		langs: (g.languages || []).map((l) => String(l.galleryid)).filter(Boolean),
		pages: Array.isArray(g.files) ? g.files.length : 0,
	};
}

// 1) 리더: 페이지 컨텍스트가 넘겨준 data-hh-gallery
// 2) 없으면(상세 페이지/주입 실패) galleries/{id}.js 를 직접 받아 파싱
function getGalleryInfo() {
	try {
		const attr = document.documentElement.getAttribute('data-hh-gallery');
		if (attr) return Promise.resolve(JSON.parse(attr));
	} catch {}
	if (!CURRENT_GALLERY_ID) return Promise.resolve(null);
	if (!galleryInfoPromise) {
		galleryInfoPromise = gmText(`https://ltn.gold-usergeneratedcontent.net/galleries/${CURRENT_GALLERY_ID}.js`)
			.then((text) => normalizeGalleryInfo(JSON.parse(text.replace(/^[^{]*/, '').replace(/;?\s*$/, ''))))
			.catch((err) => {
				galleryInfoPromise = null; // 다음에 재시도
				console.warn('[Hitomi] 작품 정보 로드 실패', err);
				return null;
			});
	}
	return galleryInfoPromise;
}

// 우측 하단 플로팅 설정 (목록/상세/리더 공통)
function setupSettingsPanel({ corner = 'bottom' } = {}) {
	const isTop = corner === 'top';
	const TAB_KEY = 'hitomi_panel_tab'; // 마지막으로 본 탭 (백업 대상 아님)

	const LISTS = [
		{ id: 'hl', group: 'tag', key: HL_STORAGE_KEY, label: '연두 태그', desc: '이 태그가 있는 항목 타이틀을 연두색으로', tag: true },
		{ id: 'filter', group: 'tag', key: TAG_STORAGE_KEY, label: '숨김(메인)', desc: 'index-korean 목록에서만 숨김', tag: true },
		{ id: 'block', group: 'tag', key: BLOCK_STORAGE_KEY, label: '항상 숨김', desc: '검색 포함 모든 목록에서 숨김', tag: true },
		{ id: 'artist', group: 'work', key: FAV_ARTIST_KEY, label: '즐겨찾기 작가', desc: '이 작가 이름을 주황색으로', tag: false },
		{
			id: 'hideArtist', group: 'work', key: HIDE_ARTIST_KEY, label: '숨길 작가', desc: '이 작가의 작품을 모든 목록에서 숨김 (작가 페이지 제외)', tag: false,
			empty: '비어 있음 — 목록에서 작가 이름을 클릭해 추가할 수도 있어요',
		},
		{
			id: 'title', group: 'title', key: TITLE_BLOCK_KEY, label: '키워드', desc: '제목에 이 단어가 포함되면 모든 목록에서 숨김 (대소문자 무시)', tag: false,
			placeholder: '제외할 단어 (예: english, 総集編)',
			empty: '비어 있음 — 목록에서 스페이스바를 눌러 추가할 수도 있어요',
		},
		{
			id: 'titleExact', group: 'title', key: TITLE_EXACT_KEY, label: '완전 일치', desc: '제목이 완전히 일치하면 모든 목록에서 숨김 (공백·대소문자 무시)', tag: false,
			placeholder: '제외할 제목 전체',
			empty: '비어 있음 — 목록에서 제목을 클릭해 추가할 수도 있어요',
			normalize: normalizeTitle,
		},
	];
	const ALL_KEYS = [
		HL_STORAGE_KEY, TAG_STORAGE_KEY, BLOCK_STORAGE_KEY, FAV_ARTIST_KEY, HIDE_ARTIST_KEY, TITLE_BLOCK_KEY, TITLE_EXACT_KEY, FAV_GALLERY_KEY, SERIES_LINK_KEY, SERIES_SPLIT_KEY,
		TAG_KO_STORAGE_KEY, TAG_KO_AUTO_KEY, 'hitomi',
	];

	const hasGallery = !!CURRENT_GALLERY_ID;
	const savedTab = (() => {
		try {
			return localStorage.getItem(TAB_KEY);
		} catch {
			return null;
		}
	})();
	let activeTab = hasGallery ? 'gallery' : savedTab || 'favs';

	const el = (tag, props = {}, children = []) => {
		const node = Object.assign(document.createElement(tag), props);
		children.forEach((c) => node.append(c));
		return node;
	};

	const fab = el('button', { id: 'hh-fab', type: 'button', title: 'Hitomi Helper 설정 ( , )', textContent: '⚙' });
	const panel = el('div', { id: 'hh-panel' });
	const head = el('div', { className: 'hh-head' }, [
		el('b', { textContent: 'Hitomi Helper' }),
		el('span', { className: 'kbd' }, [el('kbd', { textContent: ',' }), ' 열기/닫기 · ', el('kbd', { textContent: 'Esc' }), ' 닫기']),
		el('button', { type: 'button', className: 'hh-x', textContent: '✕', title: '닫기', onclick: () => toggle(false) }),
	]);
	const tabs = el('div', { className: 'hh-tabs' });
	const body = el('div', { className: 'hh-body' });
	const toast = el('div', { className: 'hh-toast' });
	toast.dataset.hint = '목록에서: 태그·제목 클릭 = 규칙 메뉴 · 작가 호버 = 즐겨찾기/숨기기 · ☆ = 즐겨찾기 · 글자 드래그/Space = 제목 키워드 제외 · E = 연두 작품 열기';
	panel.append(head, el('div', { className: 'hh-main' }, [tabs, body]), toast);
	if (isTop) {
		fab.classList.add('hh-top');
		panel.classList.add('hh-top');
	}
	document.body.append(fab, panel);

	// 태그/작가 메뉴에서 규칙이 바뀌면 패널 갱신 (입력 중이던 값은 유지)
	document.addEventListener('hh-rules-changed', () => isOpen() && render());

	// 외부에서 특정 탭으로 열기
	document.addEventListener('hh-open-panel', (e) => {
		if (e.detail?.tab) setTab(e.detail.tab, false);
		toggle(true);
	});

	// 패널 내부 클릭은 메뉴 닫기 등 전역 핸들러로 새지 않게
	panel.addEventListener('mousedown', (e) => e.stopPropagation());

	// 토스트 (+ 되돌리기)
	let toastTimer;
	function notify(msg, undo) {
		toast.replaceChildren(msg);
		if (undo) {
			toast.append(el('button', {
				type: 'button',
				textContent: '되돌리기',
				onclick: () => {
					undo();
					refreshPage(true);
					render();
					notify('되돌림');
				},
			}));
		}
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toast.replaceChildren(), undo ? 5000 : 2000);
	}

	// 변경 전 원문을 저장해 두고 되돌리기 제공
	function snapshot(...keys) {
		const before = keys.map((k) => [k, localStorage.getItem(k)]);
		return () =>
			before.forEach(([k, raw]) => (raw == null ? localStorage.removeItem(k) : localStorage.setItem(k, raw)));
	}

	function saveList(key, list) {
		localStorage.setItem(key, JSON.stringify(list));
	}

	function refreshPage(dictChanged = false) {
		if (dictChanged) hijackTagLinks(true);
		applyTagRules();
		decorateStars();
	}

	const isOpen = () => panel.classList.contains('open');
	function toggle(open = !isOpen()) {
		panel.classList.toggle('open', open);
		fab.classList.toggle('active', open);
		if (open) {
			closeTagMenu();
			render();
		}
	}
	function setTab(id, rerender = true) {
		activeTab = id;
		try {
			if (id !== 'gallery') localStorage.setItem(TAB_KEY, id);
		} catch {}
		if (rerender) render();
	}
	fab.addEventListener('click', () => toggle());

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isOpen()) return toggle(false);
		// , : 패널 열기/닫기 (입력 중이 아닐 때)
		const t = e.target;
		const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
		if (e.key === ',' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
			e.preventDefault();
			toggle();
		}
	});
	document.addEventListener('mousedown', (e) => {
		if (isOpen() && !e.target.closest?.('#hh-panel, #hh-fab, #hh-tag-menu, #hh-artist-pop')) toggle(false);
	});

	// --- 렌더 ---
	const GROUPS = [
		{ id: 'work', label: '작품' },
		{ id: 'tag', label: '태그 규칙' },
		{ id: 'title', label: '제목 제외' },
		{ id: 'etc', label: '기타' },
	];
	function navItems() {
		return [
			{ id: 'favs', group: 'work', label: '★ 즐겨찾기', count: getFavGalleries().length },
			...(hasGallery ? [{ id: 'gallery', group: 'work', label: '현재 작품' }] : []),
			...LISTS.map((l) => ({ id: l.id, group: l.group, label: l.label, count: getTagList(l.key).length })),
			{ id: 'display', group: 'etc', label: '화면 배율' },
			{ id: 'dict', group: 'etc', label: '번역 사전' },
			{ id: 'backup', group: 'etc', label: '백업' },
		];
	}

	function render() {
		const items = navItems();
		if (!items.some((i) => i.id === activeTab)) activeTab = 'favs';

		tabs.replaceChildren(
			...GROUPS.flatMap((g) => {
				const inGroup = items.filter((i) => i.group === g.id);
				if (!inGroup.length) return [];
				return [
					el('div', { className: 'hh-group', textContent: g.label }),
					...inGroup.map((i) =>
						el('button', {
							type: 'button',
							className: 'hh-tab' + (activeTab === i.id ? ' active' : ''),
							onclick: () => setTab(i.id),
						}, [i.label, ...(i.count != null ? [el('span', { className: 'cnt', textContent: i.count })] : [])])
					),
				];
			})
		);

		const list = LISTS.find((l) => l.id === activeTab);
		if (list) renderList(list);
		else if (activeTab === 'gallery') renderGallery();
		else if (activeTab === 'favs') renderFavs();
		else if (activeTab === 'dict') renderDict();
		else if (activeTab === 'display') renderDisplay();
		else renderBackup();
	}

	const titleRow = (title, sub) =>
		el('div', { className: 'hh-title-row' }, [
			el('h3', { textContent: title }),
			...(sub != null ? [el('span', { className: 'hh-desc', style: 'margin:0', textContent: sub })] : []),
		]);

	// 리더: 현재 작품의 태그/작가를 클릭해서 바로 규칙 지정 (목록과 같은 메뉴 사용)
	let galleryReqId = 0;
	async function renderGallery() {
		const reqId = ++galleryReqId;
		body.replaceChildren(el('div', { className: 'hh-empty', textContent: '작품 정보를 불러오는 중…' }));
		const info = await getGalleryInfo();
		if (reqId !== galleryReqId || activeTab !== 'gallery') return; // 탭 전환됨

		if (!info) {
			body.replaceChildren(
				el('div', { className: 'hh-empty', textContent: '작품 정보를 불러오지 못했어요.' }),
				el('button', { type: 'button', className: 'hh-btn', textContent: '다시 시도', onclick: () => render() })
			);
			return;
		}

		const artists = info.artists.filter((a) => a.name);
		const hlSet = new Set(getHighlightTags());
		const tags = info.tags
			.filter((t) => t.tag && !MINOR_TAG_RE.test(t.tag.toLowerCase()))
			.map((t, i) => ({ t, i, r: tagSortRank(t.gender ? `${t.tag} ${t.gender}` : t.tag, t.url || '', hlSet) }))
			.sort((a, b) => a.r - b.r || a.i - b.i)
			.map((x) => x.t);

		// 목록과 같은 마크업(ul a[href*="/tag/"], a[href*="/artist/"]) → 기존 위임 클릭 메뉴/상태 표시 재사용
		const artistUl = el('ul', { className: 'hh-gtags' }, artists.map((a) =>
			el('li', {}, [el('a', { href: a.url || `/artist/${encodeURIComponent(a.name)}-all.html`, textContent: a.name })])
		));
		const tagUl = el('ul', { className: 'hh-gtags' }, tags.map((t) => {
			const a = el('a', { href: t.url || '#/tag/' });
			const original = t.gender ? `${t.tag} ${t.gender}` : t.tag;
			a.setAttribute('data-tag', original);
			a.textContent = t.tag;
			if (t.gender === '♀') a.style.background = '#ff7eb3';
			if (t.gender === '♂') a.style.background = '#7ec8e3';
			return el('li', {}, [a]);
		}));

		const fav = isFavGallery(CURRENT_GALLERY_ID);
		body.replaceChildren(
			titleRow('현재 작품'),
			el('div', { className: 'hh-desc', textContent: info.title || '' }),
			el('div', { className: 'hh-row', style: 'margin:0 0 8px' }, [
				el('button', {
					type: 'button',
					className: 'hh-btn',
					textContent: fav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기',
					style: fav ? 'color:var(--hh-fav)' : '',
					onclick: () =>
						toggleFavGallery({
							id: CURRENT_GALLERY_ID,
							title: info.title || CURRENT_GALLERY_ID,
							url: galleryUrl(CURRENT_GALLERY_ID),
							thumb: null,
							artists: artists.map((a) => a.name),
						}),
				}),
			]),
			el('div', { className: 'hh-sec', textContent: `작가 (${artists.length}) — 클릭해서 즐겨찾기` }),
			artists.length ? artistUl : el('div', { className: 'hh-empty', textContent: '작가 정보 없음' }),
			el('div', { className: 'hh-sec', textContent: `태그 (${tags.length}) — 클릭해서 연두/숨김 지정` }),
			tags.length ? tagUl : el('div', { className: 'hh-empty', textContent: '태그 없음' })
		);

		hijackTagLinks(); // 한글 번역 (미번역은 자동 번역 큐)
		applyTagRules(); // 연두/숨김/즐겨찾기 상태 표시
	}

	function renderFavs() {
		const all = getFavGalleries();
		const q = el('input', { placeholder: '제목 검색' });
		const listEl = el('div', { className: 'hh-favs' });

		function draw() {
			const kw = q.value.trim().toLowerCase();
			const shown = all.filter((g) => !kw || (g.title || '').toLowerCase().includes(kw));
			if (!shown.length) {
				listEl.replaceChildren(el('div', {
					className: 'hh-empty',
					textContent: all.length ? '검색 결과 없음' : '비어 있음 — 목록에서 제목 앞 ☆를 눌러 추가하세요',
				}));
				return;
			}
			listEl.replaceChildren(...shown.map((g) => {
				const thumb = g.thumb
					? el('img', { src: g.thumb, loading: 'lazy' })
					: el('div', { className: 'ph' });
				if (g.thumb) {
					thumb.onerror = () => {
						thumb.replaceWith(el('div', { className: 'ph' }));
						refreshFavThumb(g.id);
					};
				} else refreshFavThumb(g.id);
				const date = g.addedAt ? new Date(g.addedAt).toLocaleDateString() : '';
				const pages = pagesOf(g);
				return el('div', { className: 'hh-fav-row' }, [
					thumb,
					el('div', {}, [
						el('a', { href: g.url || galleryUrl(g.id), textContent: koreanTitle(g.title) || g.id, title: g.title || '' }),
						el('div', { className: 'meta', textContent: `#${g.id}${pages ? ' · ' + pages + 'p' : ''}${date ? ' · ' + date : ''}` }),
					]),
					el('button', {
						type: 'button',
						className: 'hh-btn',
						textContent: '×',
						title: '즐겨찾기 해제',
						style: 'padding:2px 0',
						onclick: () => {
							const undo = snapshot(FAV_GALLERY_KEY);
							toggleFavGallery(g); // → hh-rules-changed 로 재렌더
							notify(`"${(koreanTitle(g.title) || g.id).slice(0, 24)}" 해제됨`, undo);
						},
					}),
				]);
			}));
		}
		q.addEventListener('input', draw);

		body.replaceChildren(
			titleRow('★ 즐겨찾기', `${all.length}개 · 최근 추가순`),
			el('div', { className: 'hh-add' }, [q]),
			listEl
		);
		draw();
		if (all.length) q.focus();
	}

	// 입력창 하나로 추가 + 검색: 타이핑하면 아래 목록이 바로 걸러짐, Enter 로 추가
	function renderList(l) {
		const items = getTagList(l.key);
		const dict = getTagKo();
		const norm = l.normalize || normalizeTag;

		const input = el('input', {
			placeholder: (l.placeholder || (l.tag ? '태그 (예: big breasts ♀, full color)' : '작가 이름')) + ' — Enter 추가 / 입력 시 검색',
		});
		const add = () => {
			const v = norm(input.value);
			if (!v) return;
			if (MINOR_TAG_RE.test(v)) return notify('추가할 수 없는 항목입니다');
			const cur = getTagList(l.key);
			if (cur.includes(v)) return notify('이미 있는 항목입니다');
			saveList(l.key, [...cur, v]);
			refreshPage();
			render();
			notify(`"${v}" 추가됨`);
		};
		input.addEventListener('keydown', (e) => e.key === 'Enter' && !e.isComposing && add());

		const chipEls = items.map((t) => {
			const ko = l.tag ? dict[cleanTag(t)] : null;
			const chip = el('span', { className: 'hh-chip' }, [
				el('span', { textContent: t }),
				...(ko ? [el('span', { className: 'ko', textContent: ko })] : []),
				el('button', {
					type: 'button',
					title: '삭제',
					textContent: '×',
					onclick: () => {
						const undo = snapshot(l.key);
						saveList(l.key, getTagList(l.key).filter((x) => x !== t));
						refreshPage();
						render();
						notify(`"${t}" 삭제됨`, undo);
					},
				}),
			]);
			chip.dataset.q = `${t} ${ko || ''}`.toLowerCase();
			return chip;
		});
		const noMatch = el('div', { className: 'hh-empty', textContent: '일치하는 항목 없음 — Enter 로 추가', style: 'display:none' });
		input.addEventListener('input', () => {
			const q = input.value.trim().toLowerCase();
			let visible = 0;
			chipEls.forEach((c) => {
				const hit = !q || c.dataset.q.includes(q);
				c.classList.toggle('hide', !hit);
				if (hit) visible++;
			});
			noMatch.style.display = items.length && !visible ? '' : 'none';
		});

		body.replaceChildren(
			titleRow(l.label, `${items.length}개`),
			el('div', { className: 'hh-desc', textContent: l.desc }),
			el('div', { className: 'hh-add' }, [input, el('button', { type: 'button', className: 'hh-btn', textContent: '추가', onclick: add })]),
			items.length
				? el('div', { className: 'hh-chips' }, chipEls)
				: el('div', { className: 'hh-empty', textContent: l.empty || '비어 있음 — 목록에서 태그/작가를 클릭해 추가할 수도 있어요' }),
			noMatch,
			...(items.length
				? [el('div', { className: 'hh-row', style: 'margin-top:14px' }, [
						el('button', {
							type: 'button',
							className: 'hh-btn danger',
							textContent: '전체 삭제',
							onclick: () => {
								const undo = snapshot(l.key);
								saveList(l.key, []);
								refreshPage();
								render();
								notify(`${l.label} ${items.length}개 삭제됨`, undo);
							},
						}),
					])]
				: [])
		);
		input.focus();
	}

	function renderDisplay() {
		const mode = getUiScaleMode();
		const zoom = applyUiScale();
		const opts = [
			['auto', '자동', `브라우저 확대율을 감지해 100% 크기로 표시 (현재 감지: ${Math.round(detectZoom() * 100)}%)`],
			['1.75', '175% 기준', '브라우저를 항상 175%로 쓴다면 가장 정확함'],
			['off', '보정 안 함', '브라우저 확대율에 따라 함께 커짐'],
		];
		body.replaceChildren(
			titleRow('화면 배율', `적용 중: ${Math.round(zoom * 100)}% → 100% 크기`),
			el('div', { className: 'hh-desc', textContent: '스크립트가 추가한 UI(설정·메뉴·즐겨찾기·단축키 안내 등) 크기 보정' }),
			el('div', { className: 'hh-favs' }, opts.map(([v, label, desc]) =>
				el('button', {
					type: 'button',
					className: 'hh-btn' + (mode === v ? ' sel' : ''),
					style: 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left',
					onclick: () => {
						try {
							localStorage.setItem(UI_SCALE_KEY, v);
						} catch {}
						applyUiScale();
						renderDisplay();
					},
				}, [
					el('span', { textContent: (mode === v ? '● ' : '○ ') + label }),
					el('span', { className: 'hh-desc', style: 'margin:0;font-size:11px', textContent: desc }),
				])
			))
		);
	}

	function renderDict() {
		const manual = readJSON(TAG_KO_STORAGE_KEY, {});
		const auto = readJSON(TAG_KO_AUTO_KEY, {});
		const enInput = el('input', { placeholder: '원문 (예: netorare)' });
		const koInput = el('input', { placeholder: '번역' });
		const filterInput = el('input', { placeholder: '검색 (원문/번역)' });
		const grid = el('div', { className: 'hh-dict' });

		const add = () => {
			const en = cleanTag(enInput.value);
			const ko = koInput.value.trim();
			if (!en || !ko) return;
			mergeTagKo({ [en]: ko });
			refreshPage(true);
			renderDict();
			notify(`"${en}" → "${ko}" 저장`);
		};
		koInput.addEventListener('keydown', (e) => e.key === 'Enter' && add());

		// 직접 등록 + 자동 번역 합쳐서 표시 (직접 등록 우선)
		const rows = Object.entries({ ...auto, ...manual }).sort(([a], [b]) => a.localeCompare(b));
		function drawRows() {
			const q = filterInput.value.trim().toLowerCase();
			const shown = rows.filter(([en, ko]) => !q || en.includes(q) || ko.includes(q)).slice(0, 300);
			grid.replaceChildren(
				...shown.flatMap(([en, ko]) => {
					const koEdit = el('input', { value: ko, title: manual[en] ? '직접 등록' : '자동 번역' });
					if (!manual[en]) koEdit.classList.add('auto');
					koEdit.addEventListener('change', () => {
						mergeTagKo({ [en]: koEdit.value.trim() });
						koEdit.classList.remove('auto');
						refreshPage(true);
						notify('저장됨');
					});
					return [
						el('span', { textContent: en, title: en }),
						koEdit,
						el('button', {
							type: 'button',
							className: 'hh-btn',
							textContent: '×',
							title: '삭제 (기본 사전/재번역으로 대체)',
							style: 'padding:2px 0',
							onclick: () => {
								const m = { ...readJSON(TAG_KO_STORAGE_KEY, {}) };
								const a = { ...readJSON(TAG_KO_AUTO_KEY, {}) };
								delete m[en];
								delete a[en];
								localStorage.setItem(TAG_KO_STORAGE_KEY, JSON.stringify(m));
								localStorage.setItem(TAG_KO_AUTO_KEY, JSON.stringify(a));
								refreshPage(true);
								renderDict();
							},
						}),
					];
				})
			);
		}
		filterInput.addEventListener('input', drawRows);

		body.replaceChildren(
			titleRow('번역 사전'),
			el('div', {
				className: 'hh-desc',
				textContent: `직접 ${Object.keys(manual).length}개 · 자동 ${Object.keys(auto).length}개 · 기본 ${Object.keys(BUILTIN_TAG_KO).length}개 (회색 = 자동 번역, 수정하면 직접 등록으로 저장)`,
			}),
			el('div', { className: 'hh-add' }, [enInput, koInput, el('button', { type: 'button', className: 'hh-btn', textContent: '추가', onclick: add })]),
			el('div', { className: 'hh-add' }, [filterInput]),
			grid,
			el('div', { className: 'hh-row' }, [
				el('button', {
					type: 'button',
					className: 'hh-btn danger',
					textContent: '자동 번역 캐시 초기화',
					onclick: () => {
						if (!confirm('자동 번역 결과를 지우고 다시 번역할까요?')) return;
						localStorage.removeItem(TAG_KO_AUTO_KEY);
						autoFailed.clear();
						refreshPage(true);
						renderDict();
					},
				}),
			])
		);
		drawRows();
	}

	function renderBackup() {
		const ta = el('textarea', { placeholder: '내보내기 결과 / 가져올 JSON 붙여넣기' });
		const visitedCount = readJSON('hitomi', []).length;

		body.replaceChildren(
			titleRow('백업'),
			el('div', { className: 'hh-desc', textContent: '태그 규칙·즐겨찾기·번역 사전·방문 기록을 JSON으로 백업/복원' }),
			ta,
			el('div', { className: 'hh-row' }, [
				el('button', {
					type: 'button',
					className: 'hh-btn',
					textContent: '내보내기',
					onclick: async () => {
						const data = Object.fromEntries(ALL_KEYS.map((k) => [k, readJSON(k, null)]));
						ta.value = JSON.stringify(data, null, 2);
						try {
							await navigator.clipboard.writeText(ta.value);
							notify('클립보드에 복사됨');
						} catch {
							notify('아래 내용을 복사하세요');
						}
					},
				}),
				el('button', {
					type: 'button',
					className: 'hh-btn',
					textContent: '가져오기',
					onclick: () => {
						let data;
						try {
							data = JSON.parse(ta.value);
						} catch {
							return notify('JSON 형식이 아닙니다');
						}
						if (!confirm('현재 설정을 덮어쓸까요?')) return;
						ALL_KEYS.forEach((k) => {
							if (data?.[k] != null) localStorage.setItem(k, JSON.stringify(data[k]));
						});
						refreshPage(true);
						render();
						notify('가져오기 완료');
					},
				}),
				el('button', {
					type: 'button',
					className: 'hh-btn danger',
					textContent: `방문 기록 초기화 (${visitedCount})`,
					onclick: () => {
						if (!confirm(`방문 기록 ${visitedCount}개를 지울까요? (새로고침 후 반영)`)) return;
						localStorage.removeItem('hitomi');
						renderBackup();
					},
				}),
			])
		);
	}
}

// === 목록 우측 플로팅 즐겨찾기 (작가별 분류) ===
const FAVBAR_STATE_KEY = 'hitomi_favbar_state'; // { open, width, closed: [접은 작가명] } (백업 대상 아님)
function setupFavSidebar() {
	if (document.getElementById('hh-favbar')) return;
	let state = { open: false, width: 460, closed: [] };
	try {
		state = { ...state, ...JSON.parse(localStorage.getItem(FAVBAR_STATE_KEY) || '{}') };
	} catch {}
	const saveState = () => {
		try {
			localStorage.setItem(FAVBAR_STATE_KEY, JSON.stringify(state));
		} catch {}
	};
	const closed = new Set(state.closed);
	const UNKNOWN = '작가 미상';

	const h = (tag, props = {}, children = []) => {
		const n = Object.assign(document.createElement(tag), props);
		children.forEach((c) => n.append(c));
		return n;
	};

	const bar = h('div', { id: 'hh-favbar' });
	const title = h('b', { textContent: 'FAVORITES' });
	const count = h('span');
	const closeBtn = h('button', { type: 'button', className: 'fb-close', textContent: '✕', title: '닫기 ( ] )' });
	// 랜덤 진행 표시: "랜덤 5 · 본 개수/전체" (단위 = 시리즈 1개 또는 단독 작품 1개)
	// 본 기록(randomPicked)은 메모리에만 있어서 새로고침하면 0부터 다시
	const randomLabel = () => {
		const all = favUnits();
		const seen = all.filter((arr) => randomPicked.has(unitKey(arr))).length;
		return `랜덤 5 · ${seen}/${all.length}`;
	};
	const randomBtn = h('button', {
		type: 'button',
		className: 'fb-random',
		textContent: '랜덤 5',
		title: '즐겨찾기에서 무작위 5개 열기 ( R ) (시리즈는 전 편, 1개로 계산)\n본 개수/전체 · 새로고침 전까지 이미 연 것은 제외 · 다 보면 처음부터 · 새로고침하면 초기화',
		onclick: () => {
			openRandomFavs(5);
			randomBtn.textContent = randomLabel(); // 바로 카운팅 (다 보면 자동으로 처음부터)
		},
	});
	const head = h('div', { className: 'fb-head' }, [title, randomBtn, count, closeBtn]);
	const search = h('input', { placeholder: '검색' });
	const list = h('div', { className: 'fb-list' });
	bar.append(head, h('div', { className: 'fb-body' }, [search, list]));
	const toggleBtn = h('button', { id: 'hh-favbar-toggle', type: 'button', textContent: '★', title: '즐겨찾기 ( ] )' });
	document.body.append(toggleBtn, bar);

	// --- 폭 조절: 왼쪽 가장자리 드래그 (더블클릭 = 기본 폭), 저장 ---
	const MIN_W = 200;
	const MAX_W = 960;
	const DEFAULT_W = 460;
	const applyWidth = (w) => {
		const clamped = Math.round(Math.min(MAX_W, Math.max(MIN_W, w || DEFAULT_W)));
		document.documentElement.style.setProperty('--hh-favbar-w', clamped + 'px');
		return clamped;
	};
	if (!state.width || state.width < 420) state.width = DEFAULT_W; // 큰 카드 최소 2열 폭
	state.width = applyWidth(state.width);
	const resizer = h('div', { className: 'fb-resize', title: '드래그: 폭 조절 · 더블클릭: 기본 폭' });
	bar.prepend(resizer);
	resizer.addEventListener('mousedown', (e) => {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		const startX = e.clientX;
		const startW = state.width;
		// 사이드바는 scale 이 적용돼 있으므로 화면 이동량 ÷ 배율 = CSS 폭 변화량
		const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hh-ui-scale')) || 1;
		document.documentElement.classList.add('hh-favbar-resizing');
		const onMove = (ev) => {
			state.width = applyWidth(startW + (startX - ev.clientX) / scale);
		};
		const onUp = () => {
			document.documentElement.classList.remove('hh-favbar-resizing');
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			saveState();
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	});
	resizer.addEventListener('dblclick', () => {
		state.width = applyWidth(DEFAULT_W);
		saveState();
	});

	// --- 여닫기: ] 키 / 버튼, 상태 저장 ---
	const isOpen = () => document.documentElement.classList.contains('hh-favbar-open');
	function setOpen(open) {
		document.documentElement.classList.toggle('hh-favbar-open', open);
		state.open = open;
		saveState();
		if (open) render();
		else if (document.activeElement === search) search.blur();
	}
	toggleBtn.addEventListener('click', () => setOpen(true));
	closeBtn.addEventListener('click', () => setOpen(false));
	document.addEventListener('keydown', (e) => {
		if (e.key !== ']' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
		const t = e.target;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
		e.preventDefault();
		setOpen(!isOpen());
	});

	// 다른 전역 핸들러(메뉴/패널 닫기, 단축키)로 새지 않게
	bar.addEventListener('mousedown', (e) => e.stopPropagation());

	// 사이드바 위 휠: 목록만 스크롤하고 바깥(페이지) 스크롤은 막음
	// ※ overscroll-behavior 는 목록이 짧아 스크롤할 게 없거나 헤더/검색창 위에서는 효과가 없어 직접 처리
	bar.addEventListener(
		'wheel',
		(e) => {
			if (e.ctrlKey) return; // 핀치/Ctrl+휠 확대는 브라우저 기본 동작 유지
			e.preventDefault();
			const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? list.clientHeight : 1;
			list.scrollTop += e.deltaY * unit;
		},
		{ passive: false }
	);
	search.addEventListener('keydown', (e) => {
		e.stopPropagation();
		if (e.key === 'Escape') search.blur();
	});
	search.addEventListener('input', () => render());

	function render() {
		const favs = getFavGalleries();
		count.textContent = favs.length;
		randomBtn.textContent = randomLabel();
		if (!isOpen()) return; // 닫힌 상태면 목록은 열릴 때 그림

		const q = search.value.trim().toLowerCase();
		// 작가별 그룹 (공동 작가 작품은 각 작가 그룹에 모두 표시)
		const groups = new Map();
		favs.forEach((g) => {
			const names = g.artists?.length ? g.artists : [UNKNOWN];
			names.forEach((name) => {
				if (q && !`${g.title || ''} ${g.ot || ''} ${g.jt || ''}`.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) return;
				if (!groups.has(name)) groups.set(name, []);
				groups.get(name).push(g);
			});
		});

		if (!groups.size) {
			list.replaceChildren(h('div', {
				className: 'fb-empty',
				textContent: favs.length ? '검색 결과 없음' : '제목 앞 ☆ 로 추가',
			}));
			return;
		}

		const names = [...groups.keys()].sort((a, b) =>
			a === UNKNOWN ? 1 : b === UNKNOWN ? -1 : a.localeCompare(b)
		);
		list.replaceChildren(...names.map((name) => {
			const items = groups.get(name);
			const isClosed = !q && closed.has(name); // 검색 중엔 전부 펼침
			const group = h('div', { className: 'fb-group' + (isClosed ? ' closed' : '') });
			const header = h('div', { className: 'fb-artist', title: name }, [
				h('span', { className: 'arr', textContent: isClosed ? '▸' : '▾' }),
				h('span', { textContent: name }),
				h('span', { className: 'n', textContent: groupSeries(items).length }),
			]);
			header.addEventListener('click', () => {
				closed.has(name) ? closed.delete(name) : closed.add(name);
				state.closed = [...closed];
				saveState();
				render();
			});
			group.append(
				header,
				h('div', { className: 'fb-items' }, groupSeries(items).map((arr) => {
					const g = arr[0];
					const thumbSrc = (arr.find((x) => x.thumb) || {}).thumb;
					const th = thumbSrc
						? h('img', { className: 'th', src: thumbSrc, loading: 'lazy' })
						: h('span', { className: 'th' });
					if (thumbSrc) {
						const owner = arr.find((x) => x.thumb === thumbSrc) || g;
						th.onerror = () => {
							th.replaceWith(h('span', { className: 'th' }));
							refreshFavThumb(owner.id); // 깨진 주소 → 자동으로 다시 찾기
						};
					} else {
						refreshFavThumb(g.id); // 썸네일 없음 → 자동으로 찾기 (찾으면 저장 후 다시 그림)
					}
					const isSeries = arr.length > 1;
					// 페이지 수: 시리즈는 전 편 합계 (모든 편 조회가 끝났을 때만 표시)
					const pageList = arr.map(pagesOf);
					const totalPages = pageList.every((n) => n > 0) ? pageList.reduce((a, b) => a + b, 0) : 0;
					const row = h('a', {
						className: 'fb-item' + (isSeries ? ' series' : ''),
						href: g.url || galleryUrl(g.id),
						title:
							arr.map((x, i) => (isSeries ? `${i + 1}. ` : '') + (x.title || x.id) + (pagesOf(x) ? ` (${pagesOf(x)}p)` : '')).join('\n') +
							(isSeries ? '\n\n(Alt+클릭: 묶음 해제)' : '\n\n(다른 줄 위로 드래그: 같은 시리즈로 묶기)'),
					}, [
						th,
						...(!isSeries && totalPages >= OMNIBUS_PAGES ? [h('span', { className: 'omni', textContent: '[총집편]' })] : []),
						h('span', { className: 'tt', textContent: seriesTitle(arr) }),
						...(isSeries ? [h('span', { className: 'cnt', textContent: `${arr.length}편` })] : []),
						...(totalPages ? [h('span', { className: 'pg', textContent: `${totalPages}p` })] : []),
						...(() => {
							const miss = isSeries ? missingChapters(arr) : [];
							if (!miss.length) return [];
							const warn = h('span', {
								className: 'warn',
								textContent: '⚠️',
								title:
									`빠진 편: ${miss.join(', ')}편\n` +
									'클릭: 원제(로마자)로 전체 검색 — 다른 작가명/언어로 올라온 편도 찾음\n' +
									'Alt+클릭: 작가 페이지\n(찾은 편엔 "시리즈 n편" 표시)',
							});
							warn.addEventListener('click', (e) => {
								e.preventDefault();
								e.stopPropagation();
								const artist = name === UNKNOWN ? '' : name;
								const q = seriesSearchQuery(arr);
								const url =
									(e.altKey && artist) || !q
										? `https://hitomi.la/artist/${encodeURIComponent(artist)}-all.html`
										: searchUrl(q);
								if (typeof GM_openInTab === 'function') GM_openInTab(url, { active: true, insert: true });
								else window.open(url, '_blank');
							});
							return [warn];
						})(),
						h('button', {
							type: 'button',
							textContent: '×',
							title: isSeries ? `시리즈 ${arr.length}편 모두 해제` : '즐겨찾기 해제',
							onclick: (e) => {
								e.preventDefault();
								e.stopPropagation();
								if (isSeries && !confirm(`시리즈 ${arr.length}편을 모두 즐겨찾기 해제할까요?`)) return;
								const ids = new Set(arr.map((x) => x.id));
								localStorage.setItem(
									FAV_GALLERY_KEY,
									JSON.stringify(getFavGalleries().filter((x) => !ids.has(x.id)))
								);
								syncStars();
								document.dispatchEvent(new CustomEvent('hh-rules-changed'));
								document.dispatchEvent(new CustomEvent('hh-favs-updated', { detail: { meta: true } }));
							},
						}),
					]);
					// --- 수동 보정: 다른 줄 위로 드래그 = 같은 시리즈로 묶기 / 시리즈 줄 Alt+클릭 = 묶음 해제 ---
					row.draggable = true;
					row.addEventListener('dragstart', (e) => {
						e.dataTransfer.setData('text/hh-fav', g.id);
						e.dataTransfer.effectAllowed = 'link';
						row.classList.add('dragging');
					});
					row.addEventListener('dragend', () => row.classList.remove('dragging'));
					row.addEventListener('dragover', (e) => {
						if (!e.dataTransfer.types.includes('text/hh-fav')) return;
						e.preventDefault();
						e.dataTransfer.dropEffect = 'link';
						row.classList.add('drop');
					});
					row.addEventListener('dragleave', () => row.classList.remove('drop'));
					row.addEventListener('drop', (e) => {
						e.preventDefault();
						row.classList.remove('drop');
						const from = e.dataTransfer.getData('text/hh-fav');
						if (!from || arr.some((x) => x.id === from)) return;
						linkSeries(from, g.id);
						render();
					});
					if (isSeries) {
						row.addEventListener(
							'click',
							(e) => {
								if (!e.altKey) return;
								e.preventDefault();
								e.stopImmediatePropagation();
								if (!confirm(`"${seriesTitle(arr)}" ${arr.length}편 묶음을 해제할까요?`)) return;
								splitSeries(arr.map((x) => x.id));
								render();
							},
							true
						);
					}

					// 시리즈: 클릭 / Cmd·Ctrl+클릭 / 휠(가운데) 클릭 모두 전 편을 순서대로 백그라운드 탭으로 열기
					if (isSeries) {
						const openAll = (e) => {
							e.preventDefault();
							e.stopPropagation();
							openUrlsInBackground(arr.map((x) => x.url || galleryUrl(x.id))); // 1편부터 순서대로
						};
						row.addEventListener('click', openAll);
						row.addEventListener('auxclick', (e) => e.button === 1 && openAll(e)); // 가운데 클릭
						row.addEventListener('mousedown', (e) => e.button === 1 && e.preventDefault()); // 자동 스크롤 방지
					}
					return row;
				}))
			);
			return group;
		}));
	}

	document.addEventListener('hh-favs-updated', (e) => {
		render();
		if (!e.detail?.meta) syncFavMeta(); // 새로 추가된 즐겨찾기 메타 보강
	});
	// 다른 탭에서 바뀐 경우
	window.addEventListener('storage', (e) => {
		if (e.key === FAV_GALLERY_KEY) {
			render();
			decorateStars();
		}
	});
	setOpen(!!state.open); // 저장된 여닫기 상태 복원 (render 포함)
	syncFavMeta();
}

// === 검색창 오버레이 (Cmd/Ctrl+K) ===
// 상단 바는 CSS로 숨기고, 원래 위치의 .header-table 을 fixed 로 띄움 (DOM 이동 없음)
function setupSearchOverlay() {
	const root = document.documentElement;
	cleanSearchInput();
	window.addEventListener('load', cleanSearchInput, { once: true });
	const isOpen = () => root.classList.contains('hh-search-open');
	let dim = null;

	function open() {
		const input = document.getElementById('query-input');
		if (!input) return;
		if (!dim) {
			dim = document.createElement('div');
			dim.id = 'hh-search-dim';
			dim.addEventListener('mousedown', close);
			document.body.appendChild(dim);
		}
		closeTagMenu();
		cleanSearchInput();
		root.classList.add('hh-search-open');
		input.focus();
		input.select();
	}
	function close() {
		if (!isOpen()) return;
		root.classList.remove('hh-search-open');
		document.getElementById('query-input')?.blur();
	}

	// capture 단계: 입력창 포커스 상태에서도 동작 + 다른 단축키 핸들러보다 먼저
	document.addEventListener(
		'keydown',
		(e) => {
			if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K' || e.key === 'ㅏ')) {
				e.preventDefault();
				e.stopPropagation();
				isOpen() ? close() : open();
				return;
			}
			// Esc: 자동완성이 떠 있어도 오버레이 닫기 (사이트 핸들러보다 먼저 처리)
			if (e.key === 'Escape' && isOpen()) {
				e.preventDefault();
				close();
			}
		},
		true
	);
}

// === 리더: 우측 상단에 이 작품이 가진 연두(즐겨찾기) 태그 목록 ===
function setupReaderTags() {
	if (!CURRENT_GALLERY_ID || document.getElementById('hh-rtags')) return;
	const box = Object.assign(document.createElement('div'), { id: 'hh-rtags' });
	document.body.appendChild(box);
	let info = null;

	function render() {
		if (!info) return;
		const hl = new Set(getHighlightTags());
		const dict = getTagKo();
		const matched = (info.tags || []).filter((t) => {
			const original = t.gender ? `${t.tag} ${t.gender}` : t.tag;
			return t.tag && hl.has(normalizeTag(original));
		})
			.map((t, i) => ({ t, i, r: tagGenderRank(t.gender ? `${t.tag} ${t.gender}` : t.tag, t.url || '') }))
			.sort((a, b) => a.r - b.r || a.i - b.i)
			.map((x) => x.t);
		if (!matched.length) {
			box.replaceChildren();
			setWidthVar();
			return;
		}
		box.replaceChildren(
			Object.assign(document.createElement('div'), { className: 'hd', textContent: `연두 태그 ${matched.length}` }),
			...matched.map((t) => {
				const original = t.gender ? `${t.tag} ${t.gender}` : t.tag;
				const ko = dict[cleanTag(original)] || dict[cleanTag(t.tag)];
				const el = Object.assign(document.createElement('div'), { className: 'tg', title: original });
				el.append(ko || t.tag);
				if (t.gender) el.append(Object.assign(document.createElement('span'), { className: 'g', textContent: t.gender }));
				return el;
			})
		);
		setWidthVar();
	}

	// 즐겨찾기 버튼을 태그 목록 왼쪽에 두기 위한 폭 공유 (배율 적용 전 CSS 폭 → 같은 배율이라 그대로 사용)
	function setWidthVar() {
		const w = box.childElementCount ? box.offsetWidth : 0;
		document.documentElement.style.setProperty('--hh-rtags-w', w + 'px');
		document.documentElement.style.setProperty('--hh-rtags-gap', w ? '8px' : '0px');
	}

	getGalleryInfo().then((v) => {
		info = v;
		render();
	});
	// 연두 태그 목록이 바뀌면 갱신 (태그 메뉴·설정 패널·다른 탭 모두 → 원문 문자열 변화로 감지)
	let lastRaw = localStorage.getItem(HL_STORAGE_KEY);
	const check = () => {
		const raw = localStorage.getItem(HL_STORAGE_KEY);
		if (raw !== lastRaw) {
			lastRaw = raw;
			render();
		}
	};
	document.addEventListener('hh-rules-changed', check);
	window.addEventListener('storage', check);
	setInterval(check, 1000);
}

// === 리더: 우측 상단에 마우스를 대면 즐겨찾기 버튼 표시 ===
function setupReaderStar() {
	if (!CURRENT_GALLERY_ID || document.getElementById('hh-rstar-zone')) return;
	const zone = Object.assign(document.createElement('div'), { id: 'hh-rstar-zone' });
	const btn = Object.assign(document.createElement('button'), { id: 'hh-rstar', type: 'button' });
	const icon = Object.assign(document.createElement('i'), { className: 'hh-star', innerHTML: STAR_SVG });
	const label = document.createElement('span');
	btn.append(icon, label);
	zone.append(btn);
	document.body.appendChild(zone);
	zone.addEventListener('mousedown', (e) => e.stopPropagation());

	const sync = () => {
		const on = isFavGallery(CURRENT_GALLERY_ID);
		btn.classList.toggle('on', on);
		icon.classList.toggle('on', on);
		label.textContent = on ? '즐겨찾기됨' : '즐겨찾기';
	};
	let flashTimer;
	async function toggleCurrent() {
		const info = await getGalleryInfo(); // 제목/작가 (실패 시 문서 제목으로 대체)
		toggleFavGallery({
			id: CURRENT_GALLERY_ID,
			title: info?.title || document.title.replace(/\s*\|.*$/, '').trim() || CURRENT_GALLERY_ID,
			url: galleryUrl(CURRENT_GALLERY_ID),
			thumb: readerImageUrl(), // 리더 첫 이미지(#1-)를 썸네일로
			artists: (info?.artists || []).map((a) => a.name).filter(Boolean),
		});
		// 단축키로 토글해도 결과가 보이게 잠깐 표시
		btn.classList.add('flash');
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => btn.classList.remove('flash'), 1200);
	}
	btn.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		toggleCurrent();
	});
	// F: 즐겨찾기 on/off
	let busy = false;
	document.addEventListener('keydown', async (e) => {
		if (e.key !== 'f' && e.key !== 'F' && e.key !== 'ㄹ') return;
		if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || busy) return;
		const t = e.target;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
		e.preventDefault();
		busy = true; // 작품 정보 로딩 중 연타 방지
		try {
			await toggleCurrent();
		} finally {
			busy = false;
		}
	});
	document.addEventListener('hh-favs-updated', sync);
	window.addEventListener('storage', (e) => e.key === FAV_GALLERY_KEY && sync());
	sync();

	// 즐겨찾기인데 썸네일이 없거나 깨진 경우: 리더 이미지가 뜨면 채움 (1페이지면 즉시, 아니면 없을 때만)
	let tries = 0;
	const timer = setInterval(() => {
		if (++tries > 30) return clearInterval(timer); // 최대 15초
		const fav = getFavGalleries().find((g) => g.id === CURRENT_GALLERY_ID);
		if (!fav) return;
		if (fav.thumb && !fav.thumbBroken) return clearInterval(timer);
		if (!isReaderFirstPage() && fav.thumb) return;
		const u = readerImageUrl();
		if (!u) return;
		patchFavGallery(CURRENT_GALLERY_ID, { thumb: u, thumbTried: 1, thumbBroken: 0 });
		clearInterval(timer);
	}, 500);
}

// === 브라우저 배율 보정 ===
// 모드: 'auto' = 확대율 자동 감지(outerWidth/innerWidth) / 숫자(예: 1.75) = 해당 배율 기준 고정 / 'off' = 보정 안 함
const UI_SCALE_KEY = 'hitomi_ui_scale';
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
function getUiScaleMode() {
	try {
		return localStorage.getItem(UI_SCALE_KEY) || 'auto';
	} catch {
		return 'auto';
	}
}
// 확대율 감지
// 1) outerWidth / innerWidth: 보이는 탭에서는 정확하지만, 백그라운드로 열린 새 탭에서는
//    창 크기가 아직 잡히지 않아 1(=보정 없음)로 나옴 → UI 가 175% 그대로 크게 보이던 원인
// 2) 그래서 1)이 믿을 만할 때 "기본 devicePixelRatio(= dpr / 확대율)"를 저장해 두고,
//    1)을 못 믿는 상황에서는 dpr / 기본 dpr 로 계산 (dpr 은 백그라운드 탭에서도 확대율 반영됨)
const DPR_BASE_KEY = 'hitomi_dpr_base'; // 백업 대상 아님
const snapZoom = (raw) => {
	if (!isFinite(raw) || raw <= 0) return null;
	const near = ZOOM_STEPS.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a));
	return Math.abs(near - raw) < 0.08 ? near : null;
};
function zoomFromWindow() {
	if (document.visibilityState !== 'visible') return null;
	if (!window.innerWidth || !window.outerWidth) return null;
	// 표준 확대 단계에 스냅 (창 테두리/스크롤바 오차 흡수). 개발자도구 측면 도킹 등으로 크게 어긋나면 null
	return snapZoom(window.outerWidth / window.innerWidth);
}
function zoomFromDpr() {
	let base = 0;
	try {
		base = parseFloat(localStorage.getItem(DPR_BASE_KEY)) || 0;
	} catch {}
	return base ? snapZoom((window.devicePixelRatio || 1) / base) : null;
}
function detectZoom() {
	const z = zoomFromWindow();
	if (z) {
		// 기본 dpr 갱신 (모니터가 바뀌어도 보이는 탭에서 다시 맞춰짐)
		const base = Math.round(((window.devicePixelRatio || 1) / z) * 100) / 100;
		try {
			if (localStorage.getItem(DPR_BASE_KEY) !== String(base)) localStorage.setItem(DPR_BASE_KEY, String(base));
		} catch {}
		return z;
	}
	return zoomFromDpr() || 1;
}
function applyUiScale() {
	const mode = getUiScaleMode();
	const zoom = mode === 'off' ? 1 : mode === 'auto' ? detectZoom() : parseFloat(mode) || 1;
	const scale = Math.round((1 / zoom) * 1000) / 1000;
	const cur = document.documentElement.style.getPropertyValue('--hh-ui-scale');
	if (cur !== String(scale)) document.documentElement.style.setProperty('--hh-ui-scale', String(scale));
	return zoom;
}
applyUiScale();
// 다시 계산하는 시점: 확대/축소(resize), 백그라운드 탭이 앞으로 올 때(visibilitychange/focus), bfcache 복원(pageshow)
window.addEventListener('resize', () => applyUiScale(), { passive: true });
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && applyUiScale());
window.addEventListener('focus', () => applyUiScale());
window.addEventListener('pageshow', () => applyUiScale());
// dpr 변화(확대/축소, 모니터 이동) 감지: resize 가 안 오는 경우 대비
(function watchDpr() {
	try {
		matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener(
			'change',
			() => {
				applyUiScale();
				watchDpr();
			},
			{ once: true }
		);
	} catch {}
})();

// 우측 하단 플로팅 설정 (리더 포함 모든 페이지)
setupSettingsPanel({ corner: 'bottom' });
if (isReader) setupReaderStar();
if (isReader) setupReaderTags();
if (isReader || IS_LIST_PAGE) setupKeyHints();

// === 목록 페이지 전용 처리 (reader에서는 불필요한 DOM 스캔 생략) ===
if (!isReader) {
	// === 초기 실행 ===
	replaceLinks();
	hideDjOnDuplicate();
	applyKoreanTitles();
	hijackTagLinks(); // data-tag 세팅이 먼저
	applyTagRules();
	sortTagLists();
	decorateStars();
	markSeriesCandidates();
	decoratePageCounts();
	setupSearchOverlay();
	setupDragTitlePrompt();
	// 연두 태그 지정/해제 시 즉시 재정렬 (클래스 변경은 childList 감시에 안 걸림)
	document.addEventListener('hh-rules-changed', () => sortTagLists());
	if (IS_LIST_PAGE) setupFavSidebar();

	// === DOM 변경 감시 ===
	// 링크 변환은 즉시(클릭 전 반영), 전역 스캔은 프레임당 1회로 배치
	let scheduled = false;
	const flush = () => {
		scheduled = false;
		hideDjOnDuplicate();
		applyKoreanTitles();
		hijackTagLinks();
		applyTagRules();
		sortTagLists();
		decorateStars();
		markSeriesCandidates();
		decoratePageCounts();
	};
	new MutationObserver((mutations) => {
		for (const m of mutations) {
			m.addedNodes.forEach((node) => {
				if (node.nodeType === 1) replaceLinks(node);
			});
		}
		if (!scheduled) {
			scheduled = true;
			requestAnimationFrame(flush);
		}
	}).observe(document.body, { childList: true, subtree: true });

	// === -korean 리다이렉트 ===
	(function () {
		const url = window.location.href;
		if (url.endsWith('-all.html')) {
			window.location.replace(url.replace('-all.html', '-korean.html'));
		}
	})();

	// === 인덱스 리다이렉트 ===
	(function () {
		const currentUrl = window.location.href;
		const baseUrl = 'https://hitomi.la';
		if (currentUrl === baseUrl || currentUrl === baseUrl + '/') {
			window.location.href = baseUrl + '/index-korean.html';
		}
	})();

	// === 방문 기록 ===
	$(document).ready(function () {
		const STORAGE_KEY = 'hitomi';
		let visited = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

		function applyVisited() {
			$('.gallery-content a[href^="https://hitomi.la/reader/"]').each(
				function () {
					if (visited.includes($(this).attr('href'))) {
						$(this).closest('div').css('opacity', '0.6');
					}
				}
			);
		}

		applyVisited();

		const galleryEl = document.querySelector('.gallery-content');
		if (galleryEl) {
			new MutationObserver(() => applyVisited()).observe(galleryEl, {
				childList: true,
				subtree: true,
			});
		}

		$(document).on(
			'click',
			'.gallery-content a[href^="https://hitomi.la/reader/"]',
			function (e) {
				e.preventDefault();
				const url = $(this).attr('href');
				window.open(url, '_blank');
				if (!visited.includes(url)) {
					visited.push(url);
					localStorage.setItem(STORAGE_KEY, JSON.stringify(visited));
				}
				$(this).closest('div').css('opacity', '0.6');
			}
		);
	});
}

// === Reader 페이지 넘김 (구 [HITOMI 리더]) ===
(function () {
	if (!isReader) return;

	// 방문 기록 스택
	let historyStack = [];
	let lastHash = '';


	function getPagesFromHash() {
		const raw = location.hash.replace(/^#/, '');
		const nums = raw
			.split('-')
			.filter(Boolean)
			.map((n) => parseInt(n, 10))
			.filter((n) => !isNaN(n));
		if (nums.length === 0) return [1];
		if (nums.length === 1) return [nums[0]];
		return [nums[0], nums[0] + 1];
	}

	function setHash(pages) {
		const url = new URL(location.href);
		if (pages.length === 1 && pages[0] === 1) url.hash = '#1';
		else url.hash = '#' + pages.join('-');
		location.href = url.toString();
	}

	document.addEventListener('keydown', (e) => {
		const active = document.activeElement;
		if (
			active &&
			(active.tagName === 'INPUT' ||
				active.tagName === 'TEXTAREA' ||
				active.isContentEditable)
		)
			return;

		const key = e.key;
		const isCmd = e.metaKey || e.ctrlKey; // macOS cmd, Windows ctrl 공통 처리

		// cmd+a: 갤러리 페이지로
		if (isCmd && key === 'a') {
			e.preventDefault();
			const match = location.href.match(/\/reader\/(\d+)\.html/);
			if (match) {
				location.href = `https://hitomi.la/galleries/${match[1]}.html`;
			}
			return;
		}

		if (!['a', 'ㅁ', 'd', 'ㅇ', 's', 'ㄴ'].includes(key)) return;

		let pages = getPagesFromHash();

		if (key === 'a' || key === 'ㅁ') {
			if (pages.length === 1) pages = [pages[0] + 1, pages[0] + 2];
			else pages = [pages[0] + 2, pages[1] + 2];

			historyStack.push(getPagesFromHash());
			setHash(pages);
			return;
		}

		if (key === 'd' || key === 'ㅇ') {
			if (historyStack.length === 0) {
				if (pages.length === 2) {
					if (pages[0] === 2) pages = [1];
					else pages = [pages[0] - 2, pages[1] - 2];
				} else {
					if (pages[0] === 2) pages = [1];
					else if (pages[0] === 1) return;
					else pages = [pages[0] - 2, pages[0] - 1];
				}
			} else {
				pages = historyStack.pop();
			}

			setHash(pages);
			return;
		}

		if (key === 's' || key === 'ㄴ') {
			hhCloseTab();
		}
	});

	window.addEventListener('hashchange', () => {
		setTimeout(function () {
			if (lastHash == location.hash) {
				historyStack.pop();
			} else {
				lastHash = location.hash;
			}
		});
	});
})();

// === Reader 슬라이드 ===
(function () {
	if (!isReader) return;

	let timer = null;
	let interval = 7000;

	const status = document.createElement('div');
	status.id = 'hh-slide'; // 스타일은 공통 CSS (#hh-slide)
	status.textContent = '⏸';
	document.body.appendChild(status);

	function updateStatus() {
		status.textContent = timer ? `▶ ${interval / 1000}s` : '⏸';
		status.classList.toggle('on', !!timer);
	}

	function nextPage() {
		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true })
		);
	}

	function start() {
		if (timer) return;
		nextPage();
		timer = setInterval(nextPage, interval);
		updateStatus();
	}

	function stop() {
		if (!timer) return;
		clearInterval(timer);
		timer = null;
		updateStatus();
	}

	function restart() {
		if (!timer) return;
		clearInterval(timer);
		timer = setInterval(nextPage, interval);
		updateStatus();
	}

	document.addEventListener('keydown', (e) => {
		if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

		switch (e.key) {
			case '[':
				start();
				break;
			case ']':
				stop();
				break;
			case '-':
				interval = Math.max(interval - 500, 500);
				restart();
				break;
			case '+':
			case '=':
				interval = Math.min(interval + 500, 30000);
				restart();
				break;
		}
	});
})();
});