# 결정 기록

이 문서는 제품이나 기술 방향이 바뀌어도 이전 판단의 이유를 잃지 않기 위한 기록이다. 새 결정은 기존 항목을 지우지 않고 상태를 `대체됨`으로 표시한 뒤 새 항목을 추가한다.

## D-035 — 정적 asset도 Worker를 거쳐 release 보안 header를 적용한다

- 날짜: 2026-08-24
- 상태: 확정
- 배경: source의 `_headers`와 Worker `X-Robots-Tag`는 있었지만 Sites production의 정적 asset이 Worker를 우회해 실제 root와 hashed asset 응답에는 CSP, `nosniff`, referrer, permissions와 robots header가 없었다. 현재 게임은 사용자 입력·API가 없어 즉시 악용 가능한 경로는 없지만 의도한 방어 계층과 production 동작이 달랐다.
- 결정: Cloudflare asset 설정에 `run_worker_first: true`를 사용하고 Worker 경로에는 self-only script/font/image/connect CSP, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `nosniff`, no-referrer, 제한된 Permissions Policy와 `X-Robots-Tag`를 추가한다. Sites 정적 dispatch가 이 header를 노출하지 않는 경우에도 document가 CSP·no-referrer·robots policy를 직접 적용하도록 동일한 HTML meta fallback을 둔다. runtime style attribute와 local Vite의 style element injection은 허용하고, 대회 iframe 호환성이 불명확하므로 `frame-ancestors`와 `X-Frame-Options`는 보류한다.
- 결과: 게임 로직·사용자 데이터·API를 Worker에 추가하지 않고 Worker header와 document meta 두 계층을 사용한다. Cloudflare Vite plugin과 Wrangler를 각각 1.53.1·4.125.0으로 함께 갱신해 dev toolchain을 포함한 `pnpm audit` advisory를 0건으로 만든다.

## D-034 — 최고 난이도는 유지하되 읽을 수 없는 동시 발동을 제거한다

- 날짜: 2026-08-24
- 상태: 확정
- 배경: Stage 10 seed sweep에서 서로 다른 major warning이 같은 tick에 최대 세 종류, 500ms 안에 여섯 종류까지 시작했고 `rm *`은 warning 없이 즉시 탄막을 가렸다. approval gap도 player 위치와 무관해 viewport edge에서는 warning 안에 물리적으로 도달할 수 없는 seed가 있었다. 이는 높은 난이도가 아니라 입력으로 해결할 수 없는 사망이었다.
- 결정: 기본 tool stream을 제외한 major onset을 최소 360ms 분리하고 active major family를 최대 세 개로 제한한다. due pattern은 round-robin으로 선택해 후반 pattern starvation을 막는다. approval gap은 1.05초 warning 동안 player가 도달 가능한 축 범위 안에서 선택한다. `rm *`은 720ms outline warning 뒤에만 projectile blackout이 되며 같은 family 안에서 Stage 10 최대 4개까지 겹친다. approval·retry·reasoning·area hazard geometry는 blackout 위에 계속 표시한다. 가림막을 빠져나온 projectile은 180ms 동안 반투명 reveal과 충돌 유예를 받는다. 작은 viewport는 속도 대신 spawn interval을 1.22배 늘린다. 공정성 guard로 완주 가능성이 올라가는 만큼 ending은 180초에서 240초로 연장해 Stage 10 최고 압력을 132초 버텨야 도달하도록 한다.
- 결과: 어려움은 공격 수를 삭제하는 대신 읽고 선택할 수 있는 순서와 세 family 조합에서 나온다. ending은 이론적으로 가능하지만 일반 플레이에서는 거의 도달하기 어렵고, blackout은 warning 이후 선택한 시야 위험으로 남되 보이지 않던 탄의 출구 즉사는 막는다.

## D-033 — Guest 기록은 최고점 하나만 유지하고 Esc로 run을 취소한다

- 날짜: 2026-08-24
- 상태: 확정
- 배경: Start 우측의 점수·달성 시각 이력은 단일 플레이어의 짧은 Guest session에 비해 정보와 구현량이 많고, 실제 화면에서도 핵심 시작 정보보다 우선할 이유가 없다. 플레이 중 즉시 대기화면으로 나가는 명시적 입력도 필요하다.
- 결정: 우측 Guest 기록 목록과 timestamp 이력을 제거하고 `sessionStorage`에는 최고 생존 밀리초 하나만 저장한다. `Esc`는 현재 run을 취소해 새 `ready` state로 돌아가며 취소한 시간은 기록하지 않는다.
- 결과: 기록 정렬·최대 개수·timestamp format·목록 DOM·전용 CSS를 제거한다. 기존 `await-codex.guest-session-records.v1` payload는 읽거나 이관하지 않고 단일 `await-codex.guest-session-best.v1` 값을 사용한다. 로그인·서버·IP·global ranking 제외 결정은 유지한다.

## D-032 — 현재 릴리스는 browser session 한정 Guest 기록만 사용한다

- 날짜: 2026-08-24
- 상태: 일부 대체됨 — D-033이 기록 이력을 단일 session best로 축소
- 배경: 로그인 없이 즉시 시작하는 경험을 유지하면서 Start 우측에 개인 기록을 보여주고 싶지만, IP 식별은 공유망·동적 주소·개인정보 문제를 만들고 Google 인증·글로벌 랭킹·실제 Codex 작업 연동은 제출 직전 범위를 크게 늘린다.
- 결정: 현재 릴리스는 사용자 ID가 없는 Guest로 즉시 시작한다. 최고 기록을 갱신했을 때 생존 밀리초와 로컬 달성 시각을 `sessionStorage`에 최대 8개 저장하고, 넓은 Start 화면 우측에 높은 점수부터 표시한다. 새로고침에서는 유지하되 browser page session이 끝나면 초기화한다. 계정, 서버, IP, 글로벌 랭킹과 실제 Codex·ChatGPT 작업 모니터링은 구현하지 않는다.
- 결과: 기존 영구 `localStorage` 최고점은 읽거나 마이그레이션하지 않는다. storage 접근이 차단돼도 현재 메모리의 기록과 플레이는 유지한다. 향후 인증·동기화 기능을 시작할 때는 별도 제품·권한 결정을 추가한다.

## D-031 — 공격 수가 아니라 서로 다른 회피 판단을 Stage마다 추가한다

- 날짜: 2026-08-24
- 상태: 확정, approval gate·compaction token burst·retry chain·xhigh safe-sector wave 적용 완료
- 배경: 여덟 공격의 이름과 문구는 달랐지만 실제 조작은 대부분 속도·조준 여부가 다른 직선 text projectile이었고, review와 usage는 둘 다 수렴 후 원형 발산이었다. Stage가 올라도 새 공격을 학습하는 대신 같은 탄을 더 많이 피하는 체감이 강했다.
- 결정: 각 패턴은 흐름 피하기, 틈 선택, 영역 이탈 뒤 파편 회피, 박자 통과, safe sector 유지, 이동 corridor 추적, cell 전환, 경계 출구 추적 중 하나의 고유한 회피 행동을 소유한다. 문구를 제거해도 실루엣과 안전 공간이 같은 패턴은 합치거나 다시 설계한다. Stage 1–8은 새 문법을 하나씩 소개하고 Stage 9–10은 읽을 수 있는 예고 순서로 최대 세 고강도 문법을 조합한다.
- 첫 적용: `CONTEXT COMPACTION` frame을 가로·세로 1.5배로 확대하고 전체 보라색 active 장판과 상단 progress bar를 제거한다. context row와 frame이 중심으로 압축된 뒤 `COMPACTION FAILED`와 함께 12–20개 `context-token`이 서로 다른 속도로 튀며, 수평 감속과 중력을 받아 아래로 쏟아진다. 큰 frame 자체가 아니라 이 ballistic token 파편이 실제 피격을 만든다.
- 결과: context는 공간을 미리 비운 다음 ballistic 파편을 다시 읽는 2단 회피가 된다. 나머지 패턴도 gate, attempt chain, safe-sector wave, 교차 corridor와 밀도가 다른 두 convergence burst로 구분해 현재 Stage 1–10 구현에 적용했다.

## D-030 — 실제 제품 알림음 대신 original system-notification motif를 사용한다

- 날짜: 2026-08-24
- 상태: 확정, gain과 음정 간격은 플레이 테스트로 조정 가능
- 배경: 개발자는 error popup, push/webhook delivery와 agent 작업 완료 알림에 즉시 반응하므로 이 청각 경험을 게임의 농담과 stage 보상으로 사용할 수 있다. 하지만 Slack·Windows·macOS·ChatGPT의 실제 sample이나 고유 melody를 복제하면 권리와 브랜드 혼동 위험이 생긴다.
- 결정: BGM lead·bass gain을 기존보다 약 2배 올리고, 짝수 stage에는 original delivery 2음, 홀수 stage에는 E minor completion 3음, Stage 10에는 4음을 한 번만 재생한다. compaction·review에는 error popup형 하강 contour, parallel agents에는 delivery contour를 별도 oscillator 조합으로 사용한다.
- 결과: 외부 audio asset과 새 dependency 없이 익숙한 notification 리듬을 전달한다. 모든 motif는 repository의 MIDI interval·oscillator·envelope 조합으로 직접 만들며 특정 제품 음원으로 표현하거나 홍보하지 않는다.

## D-029 — 저작권 독립적인 procedural BGM을 gameplay에 사용한다

- 날짜: 2026-08-24
- 상태: 확정, 음량과 음형은 플레이 테스트로 조정 가능
- 배경: warning·burst·hit 효과음만으로는 반복 플레이를 이끄는 일정한 박자와 긴장감이 부족했다. 외부 음원을 추가하면 저작권 기록, 파일 용량과 loop 편집 부담이 생긴다.
- 결정: 첫 사용자 action 이후 Web Audio oscillator가 32-step E minor arpeggio·bass·pulse를 실시간 합성한다. Stage 1은 132 BPM으로 시작해 stage마다 4 BPM씩 가속하고 Stage 10의 168 BPM에 고정한다. BGM은 `playing`에서만 elapsed time에 맞춰 진행하며 game over·blur·hidden pause에서 끊고 `M` mute에 효과음과 함께 반응한다.
- 결과: 새 production dependency와 audio asset 없이 original loop를 제공한다. BGM gain은 warning·pattern burst·hit tone보다 낮게 두고 같은 music step에서 중복 음이 생성되지 않도록 한다. 기본 `TOOL CALL STREAM`은 조용하게 유지하고 Stage 2–8 특수 패턴에는 의미가 다른 짧은 cue를 배정한다.

## D-001 — 실시간 멀티플레이를 만들지 않는다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: `.io` 같은 즉시성과 글로벌 경쟁을 원하지만 개발 기간은 3일이다.
- 결정: 플레이는 싱글플레이로 완결하고 다른 플레이어와는 비동기 글로벌 랭킹으로만 경쟁한다.
- 결과: WebSocket, authoritative game server, 매치메이킹이 필요 없다. 게임은 정적 웹 빌드로 배포할 수 있다.

## D-002 — 핵심 게임은 Context 기반 Snake 아케이드다

- 날짜: 2026-08-23
- 상태: 대체됨 — D-011 참고
- 배경: 개발자와 Codex 사용자가 바로 이해하면서 구현량이 작은 규칙이 필요하다.
- 결정: 토큰을 먹어 꼬리와 미확정 점수를 키우고 `COMPACT`로 점수를 확정하는 90초 게임을 만든다.
- 결과: 땅따먹기 flood fill과 복잡한 공격 조준을 구현하지 않는다.

## D-003 — 게임 런타임은 Phaser 3.90을 사용한다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: 입력, Canvas/WebGL, 오디오, Scene 수명주기가 필요하지만 자체 엔진을 만들 시간은 없다. Phaser 4보다 축적된 사례와 API 안정성을 우선한다.
- 결정: TypeScript + Vite + Phaser 3.90을 사용하고 React는 사용하지 않는다.
- 결과: UI는 Phaser와 최소 DOM으로 구현한다. 새 프레임워크를 추가하지 않는다.

## D-004 — 서버는 랭킹 경계에만 둔다

- 날짜: 2026-08-23
- 상태: 확정, 구현은 최후순위
- 배경: 글로벌 점수는 중앙 저장소가 필요하지만 게임 플레이까지 서버에 의존하면 장애와 일정 위험이 커진다.
- 결정: 클라이언트에서 게임을 완전히 실행하고, 랭킹 등록·조회만 serverless HTTP API와 DB로 처리한다.
- 결과: 랭킹 장애 시 로컬 최고점을 보여주며 플레이는 계속된다. 핵심 게임, 공개 배포, QA, 제출 필수 자료가 끝나기 전에는 공급자 선택이나 서버 구현을 시작하지 않는다.

## D-005 — 런타임 OpenAI API를 핵심 기능으로 사용하지 않는다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: API 키, 비용, 지연, 네트워크 장애는 짧은 웹 게임의 핵심 재미와 무관하다.
- 결정: Codex는 개발 과정에 적극 활용하되, 제출 게임의 핵심 플레이는 OpenAI API 없이 동작한다.
- 결과: 개발 과정은 `docs/WORKLOG.md`에 기록하고 선택 가산점 자료에 활용한다.

## D-006 — 실제 앱과 브랜드 로고를 사용하지 않는다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: 브라우저는 설치 앱 정보를 임의로 읽을 수 없고, 실제 앱 로고는 제3자 권리 문제가 생길 수 있다.
- 결정: `TAB SWARM`, `MEMORY LEAK`, `NOTIFICATION`처럼 일반 개념을 바탕으로 한 오리지널 도형과 아이콘을 만든다.
- 결과: 실제 제품을 떠올릴 수 있는 유머는 사용하되 로고, 이름, 고유 캐릭터를 복제하지 않는다.

## D-007 — Codex 장기 문맥은 저장소 문서로 보존한다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: 긴 작업과 새 세션 사이에 목표, 결정, 다음 행동이 사라질 수 있다.
- 결정: 루트 `AGENTS.md`에 불변 지침과 문서 읽기 순서를 두고, 상세 설계는 `docs/`, 매 작업 결과는 `docs/WORKLOG.md`에 기록한다.
- 결과: 새 작업자는 대화 기록 없이도 저장소만 읽고 현재 범위와 다음 행동을 확인할 수 있어야 한다.

## D-008 — 모든 플레이어는 자동 게스트로 진입한다

- 날짜: 2026-08-23
- 상태: 대체됨 — D-009 참고
- 배경: `.io` 게임처럼 링크를 연 즉시 플레이해야 하며 계정 생성은 이탈과 구현 비용을 늘린다.
- 결정: 첫 방문에서 익명 게스트 ID와 표시명을 자동 생성하고 브라우저에 유지한다. 로그인과 시작 전 이름 입력은 만들지 않는다.
- 결과: 닉네임 변경은 결과 화면의 선택 기능이다. 게스트 ID는 인증 수단으로 신뢰하지 않고 랭킹 제출 검사는 run session으로 처리한다.

## D-009 — 익명 즉시 플레이와 게스트 식별을 분리한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨 — D-033이 영구 로컬 최고점을 session 한정 단일 Guest 최고점으로 변경
- 배경: 링크를 연 사용자가 곧바로 플레이해야 하지만 글로벌 랭킹은 최후순위다. 랭킹이 없는데 게스트 ID와 표시명을 먼저 구현할 이유가 없다.
- 결정: MVP에서 게스트란 계정과 이름 입력 없이 익명으로 즉시 플레이한다는 경험만 뜻한다. 로컬 최고점만 저장한다. 게스트 ID, 표시명, 랭킹 서버는 제출 필수 작업을 모두 마친 뒤 시간이 남을 때만 구현한다.
- 결과: 현재 게임에는 인증, 프로필, 서버가 없다. 글로벌 랭킹을 시작할 때 D-004의 서버 경계와 게스트별 최고점 정책을 다시 검토한다.

## D-010 — 1차 graybox 규칙을 결정론적 simulation으로 고정한다

- 날짜: 2026-08-23
- 상태: 대체됨 — D-011 참고. 60 Hz, seed RNG, Phaser 분리 원칙은 유지
- 배경: UI와 연출을 붙이기 전에 위험·보상 루프와 충돌 순서를 자동 검증할 기반이 필요하다.
- 결정: 60 Hz 고정 timestep과 seed RNG를 사용한다. 화면 경계는 wrap하고 자기 꼬리 충돌은 끈다. Context는 24개가 최대이며 2초 안에 `COMPACT`하지 않으면 피해를 받는다. 충격파는 범위 안 적을 제거하지만 별도 제거 점수는 주지 않는다. 시간 종료 시 미확정 점수는 폐기한다.
- 결과: Phaser Scene은 입력과 표현만 담당한다. 판정 순서는 이동 → 수집 → `COMPACT` → 적 갱신 → 충돌/Overflow → 생성 → 타이머/종료이며, 같은 tick의 `COMPACT`가 충돌보다 먼저 처리된다.

## D-011 — 핵심 게임을 죽림고수 기반 무한 생존형으로 전환한다

- 날짜: 2026-08-23
- 상태: 확정, 수치는 플레이 테스트로 조정 가능
- 배경: 90초 수집·`COMPACT` 구조는 설명할 규칙과 HUD 정보가 많고, Codex 대기 중 짧게 반복하는 게임으로서 첫눈에 이해되는 회피 재미가 약했다. 사용자는 고전 `죽림고수`처럼 마우스 포인터로 공격을 피하며 오래 버티는 방향을 요청했다.
- 결정: 시간 제한, 목숨, 토큰, 꼬리, `COMPACT`, 점수 배율을 제거한다. 포인터를 이동해 사방의 직선 공격과 예고형 범위 공격을 피하고, 한 번 피격되면 종료하며 생존 밀리초를 기록한다.
- 결과: 게임 규칙은 이동 → 공격 갱신 → 공격 생성 → 충돌 → 종료로 단순해진다. `TAB`은 즉시 직선 이동하고 `POP-UP`은 경로를 예고한 뒤 돌진한다. `MEMORY LEAK` 원형 범위와 `CONTEXT OVERFLOW` 수평·수직 범위는 예고 단계에서 무해하고 활성 단계에서만 치명적이다. 같은 seed·입력·tick에는 같은 결과를 유지한다.

## D-012 — 브라우저 오류 페이지와 한 몸인 흑백 시각 언어를 사용한다

- 날짜: 2026-08-23
- 상태: 대체됨, D-019가 browser error page 대신 Codex task surface를 사용
- 배경: 기존 네온 격자, 상단 상태 바, 패널형 overlay가 일반적인 게임 UI처럼 보여 “Codex를 기다리는 브라우저 안의 게임”이라는 콘셉트를 약하게 만들었다.
- 결정: 웹페이지와 Canvas를 흰색으로 연결하고 격자, 프레임, 점수 게이지, 카드형 modal을 제거한다. 검정·회색을 기본으로 링크 파랑과 위험 빨강만 사용한다. 시작·결과 화면은 넓은 여백과 브라우저 오류 문구 같은 타이포그래피를 사용한다.
- 결과: 시각 token은 `presentation/theme.ts`에 모으고 renderer와 HUD가 공유한다. 실제 제품 로고나 Chrome 공룡 캐릭터는 복제하지 않는다.

## D-013 — native cursor와 전체 viewport를 게임 규칙으로 사용한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨, D-018이 player 입력과 표현을 변경하고 전체 viewport 규칙은 유지
- 배경: 고정 1280×720 `FIT` Canvas와 속도 기반 삼각형 추적은 브라우저 창이 잘려 보이고 커서와 플레이어 사이의 지연을 만들었다. 직선 화살과 단순한 원·band는 개발자 브라우저 콘셉트도 충분히 전달하지 못했다.
- 결정: Phaser `RESIZE`로 현재 browser viewport 전체를 arena로 사용한다. 운영체제 native cursor hotspot을 플레이어 좌표에 직접 반영하고 키보드 방향 이동, 추적 속도, dead zone, 삼각형 캐릭터와 별도 hitbox indicator를 제거한다. 화면에는 브라우저가 그리는 native cursor만 플레이어로 남긴다. 공격은 브라우저 탭 군집, pop-up 창, 동심원 memory leak, stripe context sweep로 표현하며 예고와 활성 상태를 시각적으로 분리한다.
- 결과: `GameState`가 동적 arena 크기를 소유하고 resize를 순수 simulation 함수로 처리한다. renderer의 잔상은 presentation-only state로 유지해 판정 결정성을 해치지 않는다.

## D-014 — 완성 전 Sites 접근을 소유자 전용으로 제한한다

- 날짜: 2026-08-23
- 상태: 대체됨 — D-026이 링크 공유와 제출을 위해 public 접근으로 전환
- 배경: 사용자는 개발 중인 게임을 본인만 플레이하고 완성 후 공개하기를 요청했다.
- 결정: Sites access mode를 `custom`으로 바꾸고 owner 외 사용자·그룹·외부 방문자 allowlist를 비운다. 별도의 클라이언트 비밀번호 gate는 우회 가능하므로 만들지 않는다.
- 결과: 현재 production URL은 호스팅 owner만 접근한다. 최종 제출 전 access mode를 `public`으로 전환하고 익명 브라우저 접근을 다시 검증해야 한다.

## D-015 — 흑백 기반 위에 공격별 digital accent와 Pretendard Variable을 사용한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨, D-019가 accent color를 제거하고 Pretendard Variable 규칙은 유지
- 배경: 흰 화면과 검정 타이포만 강조한 1차 UI는 둥글고 무채색인 일반 웹 UI처럼 보여 개발 도구·픽셀·digital 콘셉트가 약했다. 사용자는 흑백은 base일 뿐 전체 palette 제한이 아니며 font는 Pretendard Variable이어야 한다고 명확히 했다.
- 결정: warm white와 black을 base로 유지하되 `TAB` blue, `POP-UP` amber, `MEMORY LEAK` violet, `CONTEXT OVERFLOW` red, running status green을 사용한다. rounded rectangle과 smooth ring을 square frame, pixel ring, stepped trail로 바꾼다. 모든 Phaser HUD/overlay와 DOM fallback font는 self-hosted `Pretendard Variable`로 통일한다.
- 결과: `pretendard@1.3.9`를 production dependency로 고정하고 dynamic unicode subset CSS를 bundle한다. font license는 OFL-1.1이다. 게임은 font load가 끝난 뒤 boot해 Phaser text texture에도 같은 face가 적용되도록 한다.

## D-016 — pointer hotspot은 유지하고 검은 pixel cursor와 투명 pause 계층을 사용한다

- 날짜: 2026-08-23
- 상태: 대체됨, D-017을 거쳐 D-018이 pointer 입력을 제거
- 배경: 운영체제 기본 커서는 게임의 digital 도구 시각 언어와 충분히 연결되지 않았고, 기존 pause 화면은 마지막 플레이 장면을 거의 흰색으로 덮어 맥락을 잃게 했다.
- 결정: pointer 입력과 충돌 좌표의 1:1 규칙은 유지하되 Canvas 안에서 24×32 hard-edge black PNG cursor를 CSS hotspot `(1, 1)`로 사용한다. pause는 Phaser 결과 overlay와 분리한 DOM 계층에서 `backdrop-filter`로 마지막 장면을 흐리고 중앙 문구만 표시한다.
- 결과: 별도 player sprite나 추적 지연 없이 cursor 외형만 제품 언어에 맞는다. pause 안내는 입력을 가로채지 않아 기존 클릭·Space 재개 흐름을 유지하며, Scene 종료 시 DOM 계층을 제거한다.

## D-017 — pause 입력을 동결하고 frozen cursor 복귀로만 재개한다

- 날짜: 2026-08-23
- 상태: 대체됨, D-018이 pointer 입력과 frozen cursor gate를 제거
- 배경: pause 중 custom cursor와 gameplay target이 계속 움직여, 다른 위치로 옮긴 뒤 재개하면 공격을 피하는 순간이동 플레이가 가능했다. 24×32 cursor 외형도 일반적인 시스템 pointer보다 크고 넓게 보였다.
- 결정: 입력은 실제 pointer 위치와 gameplay target을 분리한다. blur/hidden부터 gameplay target을 동결하고 Canvas는 OS 기본 cursor로 복구한다. 마지막 player 위치에는 동일한 검은 cursor 이미지를 pause blur 아래에 남기며, 반경 18px 안으로 돌아온 pointer click만 재개한다. 다른 위치의 click과 keyboard action은 재개하지 않는다. 검은 cursor는 32×32 canvas 안에 일반적인 시스템 화살표 비율로 좁게 그린 hard-edge PNG와 hotspot `(2, 1)`을 사용한다.
- 결과: pause 중 OS cursor는 자유롭게 움직이지만 게임 좌표는 변하지 않는다. 재개 직후에도 동결 좌표를 유지하고 다음 pointer move부터 다시 1:1 추적한다. 웹 플랫폼은 사용자의 OS cursor bitmap과 배율을 읽어 색만 바꿀 수 없으므로 외형은 공통 시스템 화살표에 가까운 custom asset으로 유지한다.

## D-018 — 플레이어 입력을 WASD·방향키로 단순화한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨, 입력 결정은 유지하고 D-019가 cursor silhouette 표현을 task node로 변경
- 배경: 실제 OS pointer와 custom cursor 외형, pause 중 pointer 위치, 재개 gate를 동시에 관리하면 브라우저별 동작과 exploit을 계속 조정해야 한다. 사용자는 pointer 조작 대신 WASD와 방향키 조작으로 전환해 입력을 단순화하기로 했다.
- 결정: 실제 OS cursor는 게임 판정에서 제외하고 항상 기본 모양을 사용한다. 플레이어는 Canvas가 직접 그리는 검은 cursor silhouette이며 `WASD`와 방향키로 440px/s 고정 속도의 8방향 이동을 한다. 대각선 입력은 정규화하고 가속·관성은 두지 않는다. click·Space는 시작·재시작·pause 해제 action으로 유지하며 blur/hidden에서 held movement key를 초기화한다.
- 결과: `InputIntent`는 pointer position 대신 direction vector를 전달하고 60Hz simulation이 delta time으로 player를 이동·경계 clamp한다. `GameCursor`와 pause resume gate를 제거해 OS cursor 상태와 gameplay 좌표가 완전히 분리된다.

## D-019 — Codex task surface와 개발·vibe coding 공격 언어를 사용한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨 — D-020이 네 공격 계열과 작은 block 표현을 대체. monochrome task surface와 `>_` player는 유지
- 배경: browser tab, pop-up, memory leak 중심 표현은 Codex를 기다리는 게임이라는 핵심 콘셉트와 개발자 공감을 충분히 전달하지 못했다. 색상별 공격도 사용자가 요청한 strict black-and-white 방향과 맞지 않았다.
- 결정: 전체 화면을 white, black, gray만 쓰는 가상 Codex task surface로 바꾼다. player는 로고와 무관한 `>_` task node다. 공격은 `log`, `review`, `context-max`, `merge-conflict` 네 판정 계열로 구성하고 고정 phrase bank에서 일반 개발과 Codex·vibe coding 패러디를 seed 기반으로 선택한다. `log`는 player 좌표를 전혀 읽지 않고 임의 edge-to-edge로 이동하며, `review`만 생성 순간 위치를 snapshot하고 재조준하지 않는다.
- 결과: 색 대신 task chip, approval modal, context fill, conflict band의 실루엣과 outline·hatch·inverse 단계로 위험을 구분한다. 실제 workspace, Codex session, context, approval 상태는 읽지 않으며 Ready와 HUD에 fictional simulation임을 명시한다. 새 공격 다양성은 우선 네 계열 안의 label·경로·pattern 변형으로 확보하고 새로운 판정 규칙이 필요할 때만 kind를 추가한다.

## D-020 — 공격의 행동을 개발 용어의 의미와 결합하고 Stage 1–10으로 확장한다

- 날짜: 2026-08-23
- 상태: 대체됨 — D-028이 generic git 중심 메인 패턴을 Codex 경험 중심으로 교체
- 배경: 네 개의 작은 task chip·modal·band는 화면에서 일반 UI block처럼 보였고, 공격 이름을 다른 용어로 바꿔도 움직임이 성립해 개발 패러디의 개연성이 약했다. 긴 `merge-conflict` band는 `context-max` 영역 회피와 역할도 겹쳤다.
- 결정: 투사체 block을 제거하고 명령어·상태 문구 자체를 진행 방향에 맞춰 회전시킨다. collision도 같은 방향의 oriented rectangle을 사용한다. 공격은 `LOG STREAM`, snapshot `REVIEW REQUEST`, 일점 `CONTEXT MAX`, 반복 `RETRY LOOP`, 분할 `FORK BOMB`, 교차 `RACE CONDITION`, 수렴 후 발산하는 `MERGE → BUG!`의 일곱 행동 패턴으로 나눈다. 기존 `merge-conflict` band는 제거한다. 12초 단위 Stage 1–10에서 Stage 7까지 패턴을 해금하고 Stage 8–10은 동시 수·속도·빈도·radial 탄 수를 올린다. Stage 10은 108초부터 최고 난이도에 고정한다.
- 결과: `log`, `review`, `retry`, `branch`, `race`, `bug` projectile, `context-max` hazard, `fork-bomb`·`merge-bug` convergence sequence가 core state에서 분리된다. `RETRY`는 같은 snapshot을 시간차 반복하고, `READ()`와 `WRITE()`는 반대편에서 교차하며, `git branch --all`과 `git merge`는 각각 `BRANCH`와 `BUG!` radial projectile을 만든다. 상단 중앙 공격명 announcement는 제거하고 실제 공격 표현만으로 판독하게 한다.

## D-021 — 공격을 작은 terminal output으로 축소하고 색은 의미에만 연결한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨 — D-022가 단일 terminal 문법을 작업 surface별 문법으로 확장하고 scale을 더 축소
- 배경: 14–20px 굵은 Pretendard 문구, 긴 점선 경로와 motion rail, 30×24 `>_` node와 방향 notch가 합쳐져 실제 terminal보다 회전하는 포스터와 거대한 UI 장식처럼 보였다.
- 결정: 공격은 `$ command`, `error:`, `warning:`, `[review]`, `[context]` 형식의 11–13px monospace output으로 바꾼다. 색은 command blue, success green, warning amber, error red, Codex·context violet의 의미에만 대응한다. 예고선은 최대 132px, motion rail은 18–34px로 제한하며 hitbox도 실제 문구 크기에 맞춰 줄인다. player는 방향 notch·화살표·corner mark가 없는 8×14 block caret만 그린다.
- 결과: 기본 바탕과 HUD는 흑백을 유지하면서 공격 정보만 terminal처럼 읽힌다. 공격 방향은 회전 문구와 짧은 예고선으로 알 수 있고, player visual에는 이동 방향 정보가 남지 않는다.

## D-022 — 흑백 base 위에서 terminal·browser·Codex surface를 각각 표현한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨 — 공격 surface 결정은 유지하고 D-023이 player caret을, D-027이 label 단색 표현을 교체
- 배경: 흑백은 전체 게임의 base일 뿐 모든 Codex 작업이 terminal인 것은 아니다. browser 작업과 Codex tool·review·context까지 monospace와 ANSI식 색으로 통일하면 출처의 개연성이 사라진다. 기존 크기도 넓은 viewport에서 여전히 크게 느껴졌다.
- 결정: projectile에 `surface: terminal | browser | codex`를 명시한다. terminal은 10–11px monospace와 `$`·ANSI 의미색, browser는 10px sans와 6×8 page-outline·page/error 색, Codex는 10–11px Pretendard와 3×3 tool-state marker·violet context 언어를 쓴다. 기본 `LOG STREAM`에는 점선 경로와 motion rail을 표시하지 않는다. player는 최대 6×12, HUD는 8–24px, projectile hitbox는 새 font scale에 맞춰 축소한다.
- 결과: 하나의 탄막 안에서도 작업 출처가 font·copy·glyph·색으로 구분된다. 흑백 task surface는 통일감을 담당하고 accent는 각 surface의 정보 의미만 전달한다. 기본 공격은 경로선 없이 날아오는 문구 자체만 남고 전체 viewport는 상대적으로 넓게 느껴진다.

## D-023 — player를 정적인 정사각형 agent node로 교체한다

- 날짜: 2026-08-23
- 상태: 대체됨 — D-027이 내부 inset과 violet core를 제거
- 배경: 6×12 caret은 흰 배경에서 너무 가늘어 player 위치가 잘 보이지 않았고, 6px↔2px blink 때문에 아이콘 실루엣도 계속 달라졌다. 사용자는 animation이 없는 정적인 정사각형 아이콘을 요청했다.
- 결정: player는 12×12 black square, 4×4 white inset, 2×2 Codex violet core로 그린다. 16×16 white clearance로 주변 공격 문구와 분리한다. 시간과 입력 방향에 따른 blink·폭 변화·방향 장식은 모두 제거한다. 기존 이동, 피격 반경 5px과 판정은 변경하지 않는다.
- 결과: 흰 화면에서 검은 정사각형 외곽이 항상 같은 크기로 보이고, 작은 violet core가 Codex 작업 주체임을 표시한다. Ready 화면의 player glyph도 동일한 구조로 맞춘다.

## D-024 — Ready 화면을 독립적인 wait-time game identity로 구성한다

- 날짜: 2026-08-23
- 상태: 일부 대체됨 — layout과 game mark는 유지하고 D-027이 ambient의 색과 이동 규칙을 교체
- 배경: 기존 Ready는 작은 player glyph와 제목·설명 텍스트만 있어 화면 상단이 비고, Codex를 기다리며 하는 게임이라는 정체성과 실제 공격의 terminal·browser·Codex 문법을 시작 전에 전달하지 못했다.
- 결정: Ready를 Canvas text block이 아닌 presentation-only DOM overlay로 분리한다. 상단에는 black square, white rotated context loop와 violet core로 구성한 original mark와 task-running 상태를 둔다. 본문은 큰 headline, 두 줄 설명, 네 줄 run spec과 단일 rectangular CTA로 제한한다. 실제 phrase bank의 의미색·서체를 반영한 여덟 ambient attack 문구는 낮은 opacity와 약한 blur, 19–31초 저속 drift로 배경에서만 움직인다. OpenAI knot와 Codex 제품 logo는 복제하지 않는다.
- 결과: Ready의 typography와 responsive layout을 gameplay HUD와 독립적으로 조정할 수 있다. 같은 mark를 runtime-generated PNG favicon으로 browser tab에 표시한다. 장식 문구는 pointer event를 받지 않고 simulation·spawn·collision에 참여하지 않으며, 시작 click과 Space 입력 흐름은 그대로 유지한다.

## D-025 — 사용자 화면을 Start와 Game 두 개로 제한한다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: 기존에는 피격 뒤 `Task interrupted.` 전용 Results overlay가 나타나 Start와 다른 정보 구조를 만들었다. 사용자는 시작에 필요한 정보와 결과를 하나의 기본 UI에서 확인하고, 실제 플레이 중에는 게임만 보이기를 요청했다.
- 결정: 최초 `ready`와 game over 뒤 `results` phase는 모두 같은 `ReadyOverlay`를 표시한다. Start에는 objective, control, fail state, local best를 항상 두고 `results`일 때만 `LAST RUN`에 생존 시간과 피격 계열을 갱신한다. `Hud`는 `playing`에서만 표시하며 Results용 Graphics와 Text object는 제거한다. 내부 phase와 deterministic simulation은 변경하지 않는다.
- 결과: 사용자가 보는 완전한 화면은 Start와 Game 두 개뿐이다. game over 즉시 Start가 돌아오고 클릭 또는 Space는 기존 `restartRun` 경로로 새 Game을 시작한다. Pause는 Game을 대체하지 않는 일시적인 blur 계층으로 남는다.

## D-026 — 제출 URL을 로그인 없는 public 접근으로 전환한다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: owner-only `custom` 접근은 사용자가 매 변경 뒤 새로고침해 확인하고 링크를 심사위원·테스터에게 바로 공유하기에 불편했다. Sites에는 별도의 unlisted 또는 secret-link 접근 모드가 없고 `custom`과 `public`만 제공된다.
- 결정: production Sites 접근을 `public`으로 전환한다. URL을 아는 방문자는 로그인·승인 없이 플레이할 수 있다. HTML에는 `noindex, nofollow, noarchive` robots meta를 넣고 Worker가 모든 응답에 같은 `X-Robots-Tag`를 추가해 검색 색인을 요청하지 않는다.
- 결과: 같은 URL을 개발 확인과 대회 제출에 사용할 수 있다. Sites 외부 응답에서 `X-Robots-Tag`가 노출되지 않아 production 검색 제외는 HTML robots meta가 담당한다. `noindex`는 인증이나 접근 제어가 아니므로 URL을 전달받거나 발견한 사람의 접속을 차단하지 않으며, 이를 비공개 링크로 표현하지 않는다.

## D-027 — player를 순수 black square로 줄이고 공격 문구를 surface syntax로 조립한다

- 날짜: 2026-08-23
- 상태: 확정
- 배경: player 내부의 white inset과 violet core는 작은 크기에서 불필요한 glyph처럼 보였다. 공격 label도 문장 전체가 command blue·error red처럼 한 색을 가져 Codex terminal, browser error, Codex tool surface의 실제 문법과 달랐다. Start 배경 문구는 짧은 drift만 반복해 플레이 중 edge-to-edge 공격 움직임을 미리 보여주지 못했다.
- 결정: player는 판정을 바꾸지 않고 내부 요소 없는 12×12 black square 하나만 그린다. 한 projectile label은 surface별 syntax token으로 나눠 같은 회전 Container 안에 배치한다. Terminal은 Codex terminal의 executable gold, quoted string blue, parameter gray, 일반 output black을 기준으로 하고 Browser는 error code·path·본문, Codex는 tool token·진행 수치·본문을 각각 분리한다. Start ambient도 같은 tokenizer, font, surface glyph를 사용하고 무작위 edge에서 반대 edge까지 34–56초 동안 직선 이동한다.
- 결과: 색은 공격 entity의 종류가 아니라 문장 내부 정보 구조를 설명한다. projectile의 core label·surface·hitbox·이동·충돌은 유지되며 presentation만 token Text Container로 바뀐다. Start ambient는 simulation과 충돌에 참여하지 않지만 실제 공격의 방향성과 문법을 낮은 대비로 선행 학습시킨다.

## D-028 — 실제 Codex 사용자 경험을 여덟 개 메인 공격으로 만든다

- 날짜: 2026-08-23
- 상태: 확정, 수치와 문구 bank는 플레이 테스트로 조정 가능
- 배경: git branch·merge·race condition은 개발자에게 익숙하지만 Codex를 기다리는 게임의 고유한 경험은 아니었다. OpenAI 공식 문서와 community issue·discussion에서 context compaction 뒤 작업 상태 손실과 재탐색, 반복 approval, xhigh의 긴 대기와 높은 사용량, 반복 review마다 새 finding 발견, usage limit 급감·표시 불일치, parallel agent 대기가 반복 주제로 확인됐다.
- 결정: 메인 패턴을 `TOOL CALL STREAM`, `APPROVAL REQUIRED`, `CONTEXT COMPACTION`, `RETRY LOOP`, `REASONING: XHIGH`, `PARALLEL AGENTS`, `REVIEW / FIX LOOP`, `USAGE LIMIT`의 여덟 개로 교체한다. Stage 1–8에서 하나씩 해금하고 Stage 9–10은 동시 수·속도·빈도·radial 탄 수를 높인다. git·npm·browser error는 Stage 1 tool-call phrase bank의 실제 작업 소재로 유지하되 독립 메인 패턴으로 승격하지 않는다.
- 결과: core는 `tool-call`, `approval`, `retry`, `reasoning`, `agent`, `finding`, `limit` projectile, `compaction` hazard, `review-loop`·`usage-limit` sequence를 사용한다. approval과 reasoning은 생성 순간 snapshot 후 재조준하지 않고, compaction은 inward frame 뒤 `SUMMARY LOST` 영역이 되며, review와 usage는 각각 `ONE MORE ISSUE`와 `LIMIT REACHED` radial projectile을 만든다. 이 표현은 실제 사용자 session을 읽지 않는 fictional parody다.

### D-028 조사 근거

- [Compaction 이후 state 손실과 같은 파일 재탐색](https://github.com/openai/codex/issues/36712), [compaction 뒤 파일 재독해](https://github.com/openai/codex/issues/33498) → `CONTEXT COMPACTION`, `TOOL CALL STREAM`
- [같은 command에서 반복되는 approval 요청](https://github.com/openai/codex/issues/5038) → `APPROVAL REQUIRED`
- [xhigh의 긴 reasoning 시간과 usage 부담](https://github.com/openai/codex/discussions/9588) → `REASONING: XHIGH`
- [review를 반복할 때마다 새 issue가 발견되는 경험](https://www.reddit.com/r/codex/comments/1vpp316/why_does_codex_keep_finding_new_issues_every_time/) → `REVIEW / FIX LOOP`
- [usage가 빠르게 소진된다는 사용자 경험](https://www.reddit.com/r/codex/comments/1u7qdz8/codex_usage_limits_feel_way_too_aggressive_lately/) → `USAGE LIMIT`
- [approval prompt가 stuck되고 두 번째 요청이 첫 요청에 막히는 사례](https://github.com/openai/codex/issues/10760) → `APPROVAL REQUIRED`의 `still waiting`·`approve again` 문구
- [remote compaction이 `context_length_exceeded`로 session을 멈추는 사례](https://github.com/openai/codex/issues/24388) → `CONTEXT COMPACTION`의 실패·상태 손실 개연성
- [한두 요청만으로 5h usage가 급감한다는 2026년 6월 사용자 사례](https://www.reddit.com/r/codex/comments/1u08n13/usage_limit_hit_too_quick/)와 [5h·weekly 표시가 오락가락한다는 discussion](https://github.com/openai/codex/discussions/11406) → 세 종류의 usage burst 결말

community 게시물의 표현을 그대로 복사하지 않고 반복되는 경험만 추출해 고정 문구와 추상 도형으로 재구성한다.
