// ==UserScript==
// @name         웃대 (자동 업데이트 로더)
// @namespace    https://github.com/yusoo-dev/userscripts
// @version      1.5.0
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
  const LOADER_VERSION = '1.5.0';
  const diag = [];
  const log = (m) => { diag.push(m); };
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

  async function fetchLatest() {
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
