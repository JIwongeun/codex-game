# await CODEX: CONTEXT//OVERFLOW

Codex가 작업하는 동안 `>_` task node를 움직여 개발·vibe coding의 골칫거리를 피하는 무한 생존 웹 아케이드입니다. 한 번 맞으면 run이 끝나고 버틴 시간이 브라우저 로컬 최고 기록이 됩니다.

현재 상태는 **처음부터 결과·재시작까지 플레이 가능한 owner-only 개발 빌드**입니다. 계정, 서버, 랭킹 없이 정적 웹 빌드만으로 실행됩니다.

## 바로 플레이

- 개발 URL: [https://await-codex-context-overflow.jygjyg99.chatgpt.site](https://await-codex-context-overflow.jygjyg99.chatgpt.site)
- 현재 Sites 소유자 1명만 접근할 수 있습니다. 제출 직전에 공개 접근으로 전환합니다.
- 개발자 PC를 켜 두거나 외부에 로컬 서버를 노출할 필요가 없습니다.

## 플레이

- 이동: `WASD` 또는 방향키
- 시작·재시작·pause 해제: 클릭 또는 Space
- 음소거: `M`
- 목표: 회전 task log, snapshot review, `CONTEXT MAX`, retry·fork·race·merge→`BUG!` 패턴을 피하며 오래 생존
- 한 판: 시간 제한 없이 한 번 피격될 때까지
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

판정은 Phaser와 분리된 seed 기반 60 Hz simulation에서 처리합니다. 기본 `log` 경로는 player 위치에 독립적이고, `review`는 생성 순간 위치만 snapshot합니다. projectile·hazard는 보이는 문자 block과 일치하는 rectangle hitbox를 사용합니다.

개발 서버에서 `?qaElapsedSeconds=84`를 붙이면 7개 공격이 모두 해금된 Stage 8 조합 난이도를 바로 확인할 수 있습니다. 이 옵션은 production build에서는 무시됩니다.
