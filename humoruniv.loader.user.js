// ==UserScript==
// @name         웃대 (자동 업데이트 로더)
// @namespace    https://github.com/yusoo-dev/userscripts
// @version      1.6.0
// @description  GitHub의 최신 웃대 스크립트를 받아 실행합니다. 한 번 설치하면 업데이트 확인이 필요 없습니다.
// @match        *://*.humoruniv.com/*
// @match        *://humoruniv.com/*
// @grant        none
// @run-at       document-start
// @homepageURL  https://github.com/yusoo-dev/userscripts
// ==/UserScript==

/*
 * 동작 방식(stale-while-revalidate)
 *  1) 페이지 열릴 때: 이 기기에 저장해 둔 코드(localStorage)를 즉시 실행 → 지연·깜빡임 없음
 *  2) 동시에 GitHub에서 최신 코드를 받아 저장 → 다음 페이지부터 새 버전 적용
 *  3) 저장된 코드가 없는 첫 실행만 받아오자마자 실행
 *  - GitHub 캐시 회피: raw.githubusercontent.com은 쿼리(?t=)를 무시하고 최대 5분 캐시함.
 *    → GitHub API로 main의 최신 커밋 SHA를 확인(캐시 없음)하고, 커밋 고정 주소(.../<SHA>/파일)로 받음.
 *      커밋 주소는 내용이 바뀌지 않으므로 캐시돼도 항상 그 버전 → 올리자마자 반영.
 *  - API는 비로그인 시 시간당 60회 제한 → SHA 확인은 SHA_CHECK_INTERVAL_MS마다 최대 1회.
 *    한도 초과·실패 시 예전 방식(raw main)으로 대체.
 *  - 새 버전을 받으면 'uw-loader:updated' 이벤트를 보냄 → 알림 UI는 본체가 표시(본체와 함께 자동 업데이트됨).
 *    본체가 이벤트를 처리하지 않으면(구버전) 로더가 화면 위쪽에 직접 알림.
 *  - 평소엔 "새 버전 받음"과 "실패"만 알림. 매 페이지 상태까지 보려면
 *    웃대 페이지 콘솔에서 localStorage.setItem('uw-loader:debug','1') (끄기: removeItem).
 */
(function () {
  'use strict';

  // 진단 모드: 주소 끝에 #uwloader 를 붙여 열면 상세 상태를 화면에 표시
  const DEBUG = location.hash === '#uwloader'
    || (() => { try { return localStorage.getItem('uw-loader:debug') === '1'; } catch { return false; } })();
  const LOADER_VERSION = '1.6.0';
  const diag = [];
  const log = (m) => { diag.push(m); };
  const API_SHA = 'https://api.github.com/repos/yusoo-dev/userscripts/commits/main';
  const RAW_AT = (sha) => `https://raw.githubusercontent.com/yusoo-dev/userscripts/${sha}/humoruniv.user.js`;
  const KEY_SHA = 'uw-loader:sha';
  const KEY_SHA_AT = 'uw-loader:shaCheckedAt';
  const SHA_CHECK_INTERVAL_MS = 20 * 1000;
  const SOURCES = [
    () => `https://raw.githubusercontent.com/yusoo-dev/userscripts/main/humoruniv.user.js?t=${Date.now()}`,
    () => `https://api.github.com/repos/yusoo-dev/userscripts/contents/humoruniv.user.js?ref=main&t=${Date.now()}`,
  ];
  const KEY_CODE = 'uw-loader:code';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  };

  const versionOf = (code) => (String(code || '').match(/@version\s+([\w.\-]+)/) || [])[1] || '?';

  function run(code) {
    try { new Function(code)(); return true; }
    catch (e) { toast(`로더: 실행 오류 ${e && e.message}`); return false; }
  }

  // ── 화면 아래 작은 알림 ──
  let toastEl = null;
  function toast(msg, onTap) {
    const show = () => {
      if (!document.body) return;
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.style.cssText = [
          'position:fixed', 'left:50%', 'top:52px', 'transform:translateX(-50%)',
          'z-index:2147483646', 'max-width:92vw', 'padding:8px 12px', 'border-radius:8px',
          'background:rgba(30,30,30,.95)', 'color:#eee', 'font:12px/1.4 sans-serif',
          'box-shadow:0 4px 16px rgba(0,0,0,.4)', 'word-break:break-all',
        ].map((d) => d + ' !important').join(';');
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.onclick = onTap || (() => toastEl.remove());
      clearTimeout(toastEl._t);
      toastEl._t = setTimeout(() => { toastEl?.remove(); toastEl = null; }, onTap ? 8000 : 4000);
    };
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show, { once: true });
  }

  // 최신 커밋 SHA로 받기. 변경 없으면 null(=받을 필요 없음), 확인 생략/실패 시 undefined(=대체 경로 사용)
  async function fetchBySha() {
    const lastAt = Number(store.get(KEY_SHA_AT)) || 0;
    if (Date.now() - lastAt < SHA_CHECK_INTERVAL_MS) { log('[sha] 최근에 확인함 → 생략'); return null; }
    store.set(KEY_SHA_AT, String(Date.now()));
    try {
      const r = await fetch(API_SHA, { cache: 'no-store', headers: { Accept: 'application/vnd.github.sha' } });
      const sha = (await r.text()).trim();
      log(`[sha] HTTP ${r.status} · ${sha.slice(0, 7)} · 남은 한도 ${r.headers.get('x-ratelimit-remaining')}`);
      if (!r.ok || !/^[0-9a-f]{40}$/.test(sha)) return undefined;
      if (sha === store.get(KEY_SHA) && store.get(KEY_CODE)) return null; // 변경 없음
      const r2 = await fetch(RAW_AT(sha), { cache: 'no-store' });
      const code = await r2.text();
      log(`[sha] 본체 HTTP ${r2.status} · v${versionOf(code)}`);
      if (!r2.ok || !/==UserScript==/.test(code)) return undefined;
      store.set(KEY_SHA, sha);
      return code;
    } catch (e) {
      log(`[sha] 실패 ${e && e.message}`);
      return undefined;
    }
  }

  async function fetchLatest() {
    const viaSha = await fetchBySha();
    if (viaSha === null) return store.get(KEY_CODE); // 최신 그대로
    if (viaSha) return viaSha;
    const errors = [];
    for (const [i, src] of SOURCES.entries()) {
      try {
        const opts = { cache: 'no-store' };
        if (i === 1) opts.headers = { Accept: 'application/vnd.github.raw' };
        const url = src();
        const r = await fetch(url, opts);
        const code = await r.text();
        log(`[${i === 0 ? 'raw' : 'api'}] HTTP ${r.status} · v${versionOf(code)} · age=${r.headers.get('age')} · cache=${r.headers.get('x-cache')} · ${code.length}B`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        if (!/==UserScript==/.test(code)) throw new Error('잘못된 응답');
        return code;
      } catch (e) {
        errors.push(`${i === 0 ? 'raw' : 'api'}: ${e && e.message}`);
      }
    }
    throw new Error(errors.join(' / '));
  }

  const cached = store.get(KEY_CODE);
  const runningVer = cached ? versionOf(cached) : null;
  const ran = cached ? run(cached) : false;
  log(`로더 v${LOADER_VERSION} · 저장된 본체 v${runningVer || '없음'} · 실행 ${ran ? '성공' : '안 함/실패'}`);

  // 진단 결과 표시(DEBUG일 때)
  function showDiag(extra) {
    if (!DEBUG) return;
    if (extra) log(extra);
    const render = () => {
      let box = document.getElementById('uw-loader-diag');
      if (!box) {
        box = document.createElement('pre');
        box.id = 'uw-loader-diag';
        box.style.cssText = ['position:fixed', 'left:8px', 'right:8px', 'top:52px', 'z-index:2147483647',
          'margin:0', 'padding:10px', 'border-radius:8px', 'background:rgba(0,0,0,.92)', 'color:#7CFC9A',
          'font:11px/1.5 monospace', 'white-space:pre-wrap', 'word-break:break-all']
          .map((d) => d + ' !important').join(';');
        box.onclick = () => box.remove();
        document.body.appendChild(box);
      }
      box.textContent = diag.join('\n') + '\n(탭하면 닫기)';
    };
    if (document.body) render(); else document.addEventListener('DOMContentLoaded', render, { once: true });
  }

  fetchLatest()
    .then((code) => {
      const latestVer = versionOf(code);
      if (code === cached) { showDiag(`결과: 최신(v${latestVer})과 같음 → 변경 없음`); return; }
      const saved = store.set(KEY_CODE, code);
      const verify = versionOf(store.get(KEY_CODE));
      showDiag(`결과: v${latestVer} 저장 ${saved ? '성공' : '실패'} (다시 읽은 버전 v${verify})`);
      if (!ran) { run(code); return; }
      if (!saved) { toast(`로더: v${latestVer} 저장 실패(저장공간 접근 불가)`); return; }
      // 본체가 알림을 띄우면 detail.handled = true
      const ev = new CustomEvent('uw-loader:updated', { detail: { version: latestVer, current: runningVer, handled: false } });
      window.dispatchEvent(ev);
      if (!ev.detail.handled) toast(`새 버전 v${latestVer} 받음 (현재 v${runningVer}) · 탭하면 바로 적용`, () => location.reload());
    })
    .catch((e) => { showDiag(`결과: 실패 · ${e.message}`); toast(`로더: 업데이트 확인 실패 · ${e.message}`); });
})();
