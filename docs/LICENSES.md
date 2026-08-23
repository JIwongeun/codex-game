# 에셋과 의존성 출처

제출 빌드에 포함되거나 제작 과정에 사용한 폰트, 코드, 이미지, 음원의 출처를 기록한다.

## production 코드와 폰트

| 항목 | 버전 | 용도 | 라이선스·출처 |
| --- | --- | --- | --- |
| Phaser | 3.90.0 | Canvas 게임 runtime | MIT, Copyright 2024 Richard Davey, Phaser Studio Inc., `node_modules/phaser/LICENSE.md` |
| Pretendard | 1.3.9 | HUD와 Codex surface 서체 | SIL Open Font License 1.1, Kil Hyung-jin, [orioncactus/pretendard](https://github.com/orioncactus/pretendard) |

## development 도구

| 항목 | 버전 | 라이선스 |
| --- | --- | --- |
| Vite | 8.2.2 | MIT |
| TypeScript | 5.9.3 | Apache-2.0 |
| Vitest | 4.1.11 | MIT |
| Wrangler | 4.125.0 | MIT OR Apache-2.0 |
| Cloudflare Vite plugin | 1.53.1 | MIT |

## 이미지와 아이콘

- `public/og.png`: 2026-08-23에 OpenAI built-in image generation으로 제작한 제출용 16:9 preview다. 프로젝트의 original context-loop mark와 게임 안의 tool·context·usage 시각 문법만 사용하며 OpenAI knot, Codex 제품 logo, ChatGPT logo와 제3자 앱 logo를 포함하지 않는다.
- Start mark, favicon, player, projectile, hazard와 HUD는 repository의 HTML·CSS·Phaser Graphics 코드로 직접 그린 original 도형이다.
- 실제 앱 icon, stock image, 외부 sprite sheet와 texture asset은 사용하지 않는다.

## 오디오

- 외부 음원 파일은 없다. `src/game/services/SoundService.ts`가 Web Audio oscillator로 BGM, warning, burst, hit와 original system-notification motif를 runtime에 합성한다.
- Slack·Windows·macOS·ChatGPT 등 제3자 제품의 notification sample과 고유 melody를 포함하거나 복제하지 않는다. delivery·completion·error를 연상시키는 일반적인 짧은 contour만 프로젝트 고유 음정과 envelope로 작성했다.

## 공개 정보 점검

- 실제 사용자 파일, 앱 목록, Codex session과 repository 내용을 읽지 않는다.
- 공격 문구와 상태 표시는 고정 phrase bank에서 생성하는 fictional parody다.
- 2026-08-23 source와 production bundle에서 API key, bearer token, password와 개인 식별 정보를 검색했으며 비밀값을 발견하지 않았다.
