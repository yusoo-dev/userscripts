# userscripts

개인용 유저스크립트 모음.

## 웃대 (humoruniv.com)

| 파일 | 용도 |
|---|---|
| [humoruniv.user.js](https://raw.githubusercontent.com/yusoo-dev/userscripts/main/humoruniv.user.js) | 본체. Violentmonkey/Tampermonkey는 이 주소로 설치하면 `@version` 증가 시 자동 업데이트 |
| [humoruniv.loader.user.js](https://raw.githubusercontent.com/yusoo-dev/userscripts/main/humoruniv.loader.user.js) | 로더. 자동 업데이트를 지원하지 않는 앱(유니콘 Pro 등)용. 한 번 설치하면 GitHub 최신 본체를 받아 실행 |

> 로더와 본체를 동시에 설치하지 마세요(본체에 중복 실행 방지가 있지만 하나만 쓰는 것을 권장).

## Hitomi (hitomi.la)

| 파일 | 용도 |
|---|---|
| [hitomi.user.js](https://raw.githubusercontent.com/yusoo-dev/userscripts/main/hitomi.user.js) | 본체. Violentmonkey는 이 주소로 설치하면 `@version` 증가 시 자동 업데이트 |
| [hitomi.loader.user.js](https://raw.githubusercontent.com/yusoo-dev/userscripts/main/hitomi.loader.user.js) | 로더(권장). 페이지를 열 때마다 GitHub 최신 커밋을 확인해 본체를 받아 실행 → 푸시하면 업데이트 확인 없이 바로 반영 |

> 로더를 쓰면 Violentmonkey에 설치된 본체(hitomi.user.js)는 꺼 주세요. 둘 다 켜져 있으면 먼저 실행된 쪽만 동작합니다.
