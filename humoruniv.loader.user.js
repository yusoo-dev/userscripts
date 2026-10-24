// ==UserScript==
// @name         웃대 (자동 업데이트 로더)
// @namespace    https://github.com/yusoo-dev/userscripts
// @version      1.0.0
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
 *  확인은 CHECK_INTERVAL_MS마다 최대 1회(매 페이지마다 받지 않음).
 */
(function () {
  'use strict';

  const SRC = 'https://raw.githubusercontent.com/yusoo-dev/userscripts/main/humoruniv.user.js';
  const KEY_CODE = 'uw-loader:code';
  const KEY_AT = 'uw-loader:checkedAt';
  const CHECK_INTERVAL_MS = 60 * 1000; // 1분

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  function run(code) {
    try { new Function(code)(); return true; }
    catch (e) { console.error('[웃대 로더] 실행 실패', e); return false; }
  }

  const cached = store.get(KEY_CODE);
  const ran = cached ? run(cached) : false;

  const last = Number(store.get(KEY_AT)) || 0;
  if (ran && Date.now() - last < CHECK_INTERVAL_MS) return;

  fetch(SRC, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((code) => {
      if (!/==UserScript==/.test(code)) throw new Error('잘못된 응답');
      store.set(KEY_CODE, code);
      store.set(KEY_AT, String(Date.now()));
      if (!ran) run(code); // 첫 실행: 받자마자 실행
    })
    .catch((e) => console.error('[웃대 로더] 업데이트 실패', e));
})();
