# await CODEX: CONTEXT//OVERFLOW

Codex가 작업하는 짧은 대기 시간에 플레이하는 90초 브라우저 아케이드 게임입니다. 토큰을 모아 Context 꼬리를 키우고, 위험해지기 전에 `COMPACT`하여 점수를 확정합니다.

현재 상태는 **개발 환경과 프로젝트 문서가 준비된 초기 스캐폴드**입니다. 게임 핵심 루프는 다음 작업에서 구현합니다.

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

