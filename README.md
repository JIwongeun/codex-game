# await CODEX: CONTEXT//OVERFLOW

Codex가 작업하는 동안 작은 정사각형 agent node를 움직여 개발·vibe coding의 골칫거리를 피하는 고난도 생존 웹 아케이드입니다. 한 번 맞으면 run이 끝나고 버틴 시간이 현재 Guest browser session의 기록이 되며, 4분을 버티면 task-crash ending에 도달합니다.

현재 상태는 **처음부터 결과·재시작까지 플레이 가능한 공개 링크 빌드**입니다. 계정, 서버, 랭킹 없이 정적 웹 빌드만으로 실행됩니다.

## 바로 플레이

- 개발 URL: [https://await-codex-context-overflow.jygjyg99.chatgpt.site](https://await-codex-context-overflow.jygjyg99.chatgpt.site)
- 링크를 아는 사람은 로그인 없이 접속할 수 있습니다. HTML robots meta로 검색 색인을 요청하지 않지만 URL 자체는 공개 접근입니다.
- 개발자 PC를 켜 두거나 외부에 로컬 서버를 노출할 필요가 없습니다.

## 플레이

- 이동: `WASD` 또는 방향키
- 시작·재시작·pause 해제: 클릭 또는 Space
- run 취소 후 대기화면 복귀: `Esc`
- 음소거: `M`
- 목표: tool call, approval gate, context compaction, retry, xhigh reasoning, parallel agents, review, usage limit와 `rm *` blackout을 피하며 오래 생존
- 한 판: 한 번 피격될 때까지. 4분 생존 시 숨겨진 task-crash ending
- pause: 다른 탭으로 이동하면 simulation과 타이머가 멈추고 held movement key가 초기화됩니다.

공격 문구는 개발과 Codex·vibe coding 경험을 바탕으로 한 고정 패러디입니다. 실제 workspace 파일이나 Codex session 상태를 읽지 않습니다.

## 시작하기

요구 환경:

- Node.js 22.12 이상
- pnpm 11 이상

```bash
pnpm install
pnpm dev
```

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
- [디자인 및 공격 계획](docs/DESIGN.md)
- [기술 아키텍처와 서버 결정](docs/TECHNICAL.md)
- [일정과 제출 체크리스트](docs/DELIVERY.md)
- [결정 기록](docs/DECISIONS.md)
- [작업 기록](docs/WORKLOG.md)

## 기술 구성

- TypeScript, Vite, Phaser 3
- Pretendard Variable 1.3.9 (OFL-1.1)
- Vitest, pnpm
- Cloudflare Workers-compatible static hosting

판정은 Phaser와 분리된 seed 기반 60 Hz simulation에서 처리합니다. 기본 tool-call 경로는 player 위치에 독립적이고, 특수 공격은 무해한 warning과 도달 가능한 안전 공간을 먼저 제공합니다. 서로 다른 major pattern은 최대 세 family만 겹치며 onset을 최소 360ms 분리합니다.

개발 서버에서 `?qaElapsedSeconds=84`를 붙이면 7개 공격이 모두 해금된 Stage 8 조합 난이도를 바로 확인할 수 있습니다. 이 옵션은 production build에서는 무시됩니다.
