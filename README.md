# await CODEX: CONTEXT//OVERFLOW

Codex가 작업하는 짧은 대기 시간에 플레이하는 90초 브라우저 아케이드 게임입니다. 토큰을 모아 Context 꼬리를 키우고, 위험해지기 전에 `COMPACT`하여 점수를 확정합니다.

현재 상태는 **처음부터 결과·재시작까지 플레이 가능한 1차 MVP 기반**입니다. 로그인, 서버, 랭킹 없이 정적 웹 빌드만으로 실행됩니다.

## 바로 플레이

- 공개 URL: [https://await-codex-context-overflow.jygjyg99.chatgpt.site](https://await-codex-context-overflow.jygjyg99.chatgpt.site)
- 계정 생성, 로그인, 설치 없이 링크를 열고 클릭 또는 Space로 시작합니다.
- 제출용 게임은 공개 호스팅에서 실행되므로 개발자 PC를 켜 두거나 외부에 노출할 필요가 없습니다.

## 플레이

- 이동: 마우스 또는 WASD/방향키
- `COMPACT`: 클릭 또는 Space
- 목표: 토큰을 모아 Context와 배율을 키우고, Overflow나 충돌 전에 점수를 확정
- 한 판: 90초 또는 목숨 3개 소진까지
- 결과: 현재 점수와 브라우저 로컬 최고점을 표시하고 즉시 재시작

## 시작하기

요구 환경:

- Node.js 22.12 이상
- pnpm 11 이상

```bash
pnpm install
pnpm dev
```

개발 서버가 표시한 주소를 브라우저에서 엽니다.

## 명령어

```bash
pnpm dev        # 로컬 개발 서버
pnpm typecheck  # TypeScript 검사
pnpm test       # 단위 테스트
pnpm build      # production 빌드
pnpm preview    # production 빌드 미리보기
pnpm check      # typecheck + test + build
```

## 문서

- [제품 및 게임 규칙](docs/PROJECT.md)
- [기술 아키텍처와 서버 결정](docs/TECHNICAL.md)
- [일정과 제출 체크리스트](docs/DELIVERY.md)
- [결정 기록](docs/DECISIONS.md)
- [작업 기록](docs/WORKLOG.md)

## 현재 기술 구성

- TypeScript
- Vite
- Phaser 3
- Vitest
- pnpm
- Cloudflare Workers-compatible static hosting

게임 판정은 Phaser와 분리된 seed 기반 60 Hz simulation에서 처리합니다. 입력, renderer, HUD, fixed-step runtime, local storage, 효과음은 각각 별도 모듈이며 `pnpm check`에서 typecheck, 36개 단위 테스트, production build를 함께 검증합니다.

개발 서버에서 `?qaRunSeconds=5`를 붙이면 시간 종료 화면을 빠르게 확인할 수 있습니다. 이 옵션은 production build에서는 무시됩니다.
