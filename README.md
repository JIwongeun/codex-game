# await CODEX: CONTEXT//OVERFLOW

Codex가 작업하는 동안 마우스 포인터로 브라우저 요청과 오류를 피하는 무한 생존 아케이드 게임입니다. 한 번 맞으면 run이 끝나고, 버틴 시간이 로컬 최고 기록이 됩니다.

현재 상태는 **처음부터 결과·재시작까지 플레이 가능한 개발 빌드**입니다. 게임 계정, 서버, 랭킹 없이 정적 웹 빌드만으로 실행되며 완성 전까지 호스팅 접근은 소유자에게만 열려 있습니다.

## 바로 플레이

- 개발 URL: [https://await-codex-context-overflow.jygjyg99.chatgpt.site](https://await-codex-context-overflow.jygjyg99.chatgpt.site)
- 현재 Sites 소유자 1명만 접근할 수 있습니다. 제출 직전에 공개 접근으로 전환합니다.
- 호스팅된 빌드이므로 개발자 PC를 켜 두거나 외부에 노출할 필요가 없습니다.

## 플레이

- 이동: 브라우저의 실제 마우스 포인터가 곧 플레이어이며 커서 좌표를 1:1로 사용
- 시작·재시작: 클릭 또는 Space
- 목표: 사방에서 날아오는 `TAB`과 `POP-UP`, 예고 후 발동하는 `MEMORY LEAK`과 `CONTEXT OVERFLOW`를 회피
- 한 판: 시간 제한 없이 한 번 피격될 때까지
- 결과: 생존 시간과 브라우저 로컬 최고 기록을 표시하고 즉시 재시작

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
- Pretendard Variable 1.3.9 (OFL-1.1)
- Vitest
- pnpm
- Cloudflare Workers-compatible static hosting

게임 판정은 Phaser와 분리된 seed 기반 60 Hz simulation에서 처리합니다. 입력, renderer, HUD, fixed-step runtime, local storage, 효과음은 각각 별도 모듈이며 `pnpm check`에서 typecheck, 31개 단위 테스트, production build를 함께 검증합니다.

개발 서버에서 `?qaElapsedSeconds=45`를 붙이면 `MEMORY LEAK`과 `CONTEXT OVERFLOW`가 해제된 후반 난이도를 바로 확인할 수 있습니다. 이 옵션은 production build에서는 무시됩니다.
