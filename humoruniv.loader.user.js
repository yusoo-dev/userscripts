// ==UserScript==
// @name         웃대 (자동 업데이트 로더)
// @namespace    https://github.com/yusoo-dev/userscripts
// @version      1.3.0
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
 *  - 매 페이지마다 확인. CDN 캐시를 피하려고 고유 쿼리(?t=)를 붙여 요청.
 *  - raw 주소가 실패하면 GitHub API로 한 번 더 시도.
 *  - 새 버전을 받으면 화면 아래에 알림(탭하면 즉시 새로고침 적용).
 *  - 평소엔 "새 버전 받음"과 "실패"만 알림. 매 페이지 상태까지 보려면
 *    웃대 페이지 콘솔에서 localStorage.setItem('uw-loader:debug','1') (끄기: removeItem).
 */
(function () {
  'use strict';

  const DEBUG = (() => { try { return localStorage.getItem('uw-loader:debug') === '1'; } catch { return false; } })();
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
          'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)',
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

  async function fetchLatest() {
    const errors = [];
    for (const [i, src] of SOURCES.entries()) {
      try {
        const opts = { cache: 'no-store' };
        if (i === 1) opts.headers = { Accept: 'application/vnd.github.raw' };
        const r = await fetch(src(), opts);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const code = await r.text();
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

  fetchLatest()
    .then((code) => {
      const latestVer = versionOf(code);
      if (code === cached) {
        if (DEBUG) toast(`로더: 최신 v${latestVer} 실행 중`);
        return;
      }
      const saved = store.set(KEY_CODE, code);
      if (!ran) { run(code); if (DEBUG) toast(`로더: v${latestVer} 받아서 실행`); return; }
      if (!saved) { toast(`로더: v${latestVer} 저장 실패(저장공간 접근 불가)`); return; }
      toast(`새 버전 v${latestVer} 받음 (현재 v${runningVer}) · 탭하면 바로 적용`, () => location.reload());
    })
    .catch((e) => toast(`로더: 업데이트 확인 실패 · ${e.message}`));
})();
