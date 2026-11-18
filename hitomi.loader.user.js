// ==UserScript==
// @name         [HITOMI] (자동 업데이트 로더)
// @namespace    https://github.com/yusoo-dev/userscripts
// @version      1.0.0
// @description  GitHub의 최신 [HITOMI] 본체를 받아 실행합니다. 푸시하면 다음 페이지부터 바로 반영 (업데이트 확인 불필요)
// @match        https://*.hitomi.la/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @run-at       document-start
// @inject-into  content
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        window.close
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @connect      translate.googleapis.com
// @connect      ltn.gold-usergeneratedcontent.net
// @noframes
// @updateURL    https://raw.githubusercontent.com/yusoo-dev/userscripts/main/hitomi.loader.user.js
// @downloadURL  https://raw.githubusercontent.com/yusoo-dev/userscripts/main/hitomi.loader.user.js
// @homepageURL  https://github.com/yusoo-dev/userscripts
// ==/UserScript==

/*
 * 동작 방식 (stale-while-revalidate)
 *  1) 페이지가 열리면: 이 브라우저에 저장해 둔 본체(GM 저장소)를 즉시 실행 → 지연 없음
 *  2) 동시에 GitHub main 의 최신 커밋 SHA 를 확인(캐시 없음)하고, 바뀌었으면
 *     커밋 고정 주소(raw/<SHA>/hitomi.user.js)로 받아 저장 → raw 5분 캐시를 우회해 푸시 즉시 반영
 *  3) 지금 페이지가 옛 버전으로 실행 중이면 상단 알림: 클릭하면 새로고침해서 바로 적용
 *     (다음에 여는 페이지/탭은 자동으로 새 버전)
 *  - GitHub API 는 비로그인 시 시간당 60회 → SHA 확인은 탭 전체 합쳐 SHA_CHECK_INTERVAL_MS 마다 1회
 *  - 저장된 본체가 없는 첫 실행만 받아오자마자 실행
 *  - 본체(hitomi.user.js)를 Violentmonkey 에 따로 설치해 두었다면 꺼 주세요 (본체에 중복 실행 방지 있음)
 *  - 상태 보기: 주소 끝에 #hhloader 를 붙여 열면 화면에 진단 표시
 */
(function () {
	'use strict';

	const LOADER_VERSION = '1.0.0';
	const REPO = 'yusoo-dev/userscripts';
	const FILE = 'hitomi.user.js';
	const API_SHA = `https://api.github.com/repos/${REPO}/commits/main`;
	const RAW_AT = (sha) => `https://raw.githubusercontent.com/${REPO}/${sha}/${FILE}`;
	const SHA_CHECK_INTERVAL_MS = 30 * 1000;
	const KEY_CODE = 'code';
	const KEY_SHA = 'sha';
	const KEY_SHA_AT = 'shaCheckedAt';

	const DEBUG = location.hash === '#hhloader';
	const diag = [];
	const log = (m) => diag.push(m);

	const versionOf = (code) => (String(code || '').match(/@version\s+([\w.\-]+)/) || [])[1] || '?';

	// GM_xmlhttpRequest → Promise
	function request(url, headers = {}) {
		return new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				method: 'GET',
				url,
				headers: { 'Cache-Control': 'no-cache', ...headers },
				timeout: 15000,
				onload: (r) => resolve(r),
				onerror: () => reject(new Error('네트워크 오류')),
				ontimeout: () => reject(new Error('시간 초과')),
			});
		});
	}

	// 본체 실행: 로더 스코프의 GM API·jQuery 와 탭 닫기 함수(@grant window.close 권한)를 넘겨줌
	// ※ window 자체는 넘기지 않음 (샌드박스 프록시라 본체의 'window === top' 판정이 깨질 수 있음)
	const closeTab = () => window.close();
	function run(code) {
		try {
			// eslint-disable-next-line no-new-func
			const fn = new Function('GM_xmlhttpRequest', 'GM_openInTab', '$', 'jQuery', '__hhCloseTab', code);
			fn(GM_xmlhttpRequest, GM_openInTab, $, jQuery, closeTab);
			return true;
		} catch (e) {
			if (/중복 실행/.test(e && e.message)) {
				toast('[HITOMI] 로더: Violentmonkey 에 본체도 설치되어 있어요. 본체를 꺼 주세요.');
				return true;
			}
			console.error('[HITOMI 로더] 실행 오류', e);
			toast(`[HITOMI] 로더: 실행 오류 · ${e && e.message}`);
			return false;
		}
	}

	// 화면 위쪽 작은 알림
	let toastEl = null;
	function toast(msg, onClick) {
		const show = () => {
			if (!document.body) return;
			if (!toastEl) {
				toastEl = document.createElement('div');
				toastEl.style.cssText = [
					'position:fixed', 'left:50%', 'top:14px', 'transform:translateX(-50%)', 'z-index:2147483646',
					'max-width:92vw', 'padding:8px 14px', 'border-radius:8px', 'cursor:pointer',
					'background:rgba(31,31,31,.96)', 'color:#e8e8e8', 'border:1px solid #333',
					'font:13px/1.45 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif',
					'box-shadow:0 10px 30px rgba(0,0,0,.45)',
				].map((d) => d + ' !important').join(';');
				document.body.appendChild(toastEl);
			}
			toastEl.textContent = msg;
			toastEl.onclick = onClick || (() => (toastEl.remove(), (toastEl = null)));
			clearTimeout(toastEl._t);
			toastEl._t = setTimeout(() => {
				toastEl?.remove();
				toastEl = null;
			}, onClick ? 10000 : 5000);
		};
		if (document.body) show();
		else document.addEventListener('DOMContentLoaded', show, { once: true });
	}

	function showDiag(extra) {
		if (!DEBUG) return;
		if (extra) log(extra);
		const render = () => {
			let box = document.getElementById('hh-loader-diag');
			if (!box) {
				box = document.createElement('pre');
				box.id = 'hh-loader-diag';
				box.style.cssText = [
					'position:fixed', 'left:8px', 'right:8px', 'top:8px', 'z-index:2147483647', 'margin:0',
					'padding:10px', 'border-radius:8px', 'background:rgba(0,0,0,.92)', 'color:#7CFC9A',
					'font:11px/1.5 monospace', 'white-space:pre-wrap', 'word-break:break-all',
				].map((d) => d + ' !important').join(';');
				box.onclick = () => box.remove();
				document.body.appendChild(box);
			}
			box.textContent = diag.join('\n') + '\n(클릭하면 닫기)';
		};
		if (document.body) render();
		else document.addEventListener('DOMContentLoaded', render, { once: true });
	}

	// 최신 본체 받기. 변경 없음/확인 생략 → null
	async function fetchLatest() {
		const lastAt = Number(GM_getValue(KEY_SHA_AT, 0)) || 0;
		const hasCode = !!GM_getValue(KEY_CODE, '');
		if (hasCode && Date.now() - lastAt < SHA_CHECK_INTERVAL_MS) {
			log('[sha] 최근에 확인함 → 생략');
			return null;
		}
		GM_setValue(KEY_SHA_AT, Date.now());
		const r = await request(API_SHA, { Accept: 'application/vnd.github.sha' });
		const sha = String(r.responseText || '').trim();
		log(`[sha] HTTP ${r.status} · ${sha.slice(0, 7)}`);
		if (r.status !== 200 || !/^[0-9a-f]{40}$/.test(sha)) throw new Error(`커밋 확인 실패 (HTTP ${r.status})`);
		if (hasCode && sha === GM_getValue(KEY_SHA, '')) return null; // 변경 없음
		const r2 = await request(RAW_AT(sha));
		const code = String(r2.responseText || '');
		log(`[raw] HTTP ${r2.status} · v${versionOf(code)} · ${code.length}B`);
		if (r2.status !== 200 || !/==UserScript==/.test(code)) throw new Error(`본체 받기 실패 (HTTP ${r2.status})`);
		GM_setValue(KEY_SHA, sha);
		return code;
	}

	// 1) 저장된 본체 즉시 실행
	const cached = GM_getValue(KEY_CODE, '');
	const runningVer = cached ? versionOf(cached) : null;
	const ran = cached ? run(cached) : false;
	log(`로더 v${LOADER_VERSION} · 저장된 본체 v${runningVer || '없음'} · 실행 ${ran ? '성공' : '안 함/실패'}`);

	// 2) 최신 확인 → 저장 → (옛 버전 실행 중이면) 알림
	fetchLatest()
		.then((code) => {
			if (!code || code === cached) {
				showDiag('결과: 변경 없음');
				return;
			}
			GM_setValue(KEY_CODE, code);
			const latestVer = versionOf(code);
			showDiag(`결과: v${latestVer} 저장`);
			if (!ran) {
				run(code); // 첫 실행(또는 이전 실행 실패): 바로 실행
				return;
			}
			toast(`[HITOMI] 새 버전 v${latestVer} 받음 (현재 v${runningVer}) · 클릭하면 바로 적용`, () => location.reload());
		})
		.catch((e) => {
			showDiag(`결과: 실패 · ${e.message}`);
			if (!ran) toast(`[HITOMI] 로더: 본체를 받지 못했어요 · ${e.message}`);
			else console.warn('[HITOMI 로더] 업데이트 확인 실패', e);
		});
})();
