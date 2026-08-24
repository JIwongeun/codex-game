# 일정과 제출 체크리스트

## 1. 공식 조건

공식 안내 기준:

- Track 1 접수: 2026-08-04 ~ 2026-08-26
- 예선 심사: 2026-08-27
- 브라우저에서 바로 실행되는 웹 빌드 필수
- 심사 기간 중 별도 승인 없이 플레이 가능한 링크 필수
- 조작법과 실행 방법 안내
- 필수 제출: 게임 제목, 200자 이내 소개, 플레이 링크, 16:9 권장 썸네일
- 선택 가산점: 3분 이내 실제 플레이 영상, Codex 활용 과정
- 심사 기준: Playability, Originality, Codex Collaboration, Release Potential, Presentation

참고:

- [OpenAI Game Builders Seoul](https://openaigame2026.com/#apply:track-1)
- [참가 약관](https://openaigame2026.com/ko/terms)

공식 페이지에 정확한 종료 시각이 명시되지 않았으므로 8월 25일 밤까지 제출을 완료한다.

## 2. 성공 정의

### 필수 제출 준비 완료

아래 항목은 실제 접수 전에 모두 만족해야 한다.

- 공개 HTTPS URL을 시크릿 창에서 열 수 있다.
- 한 번의 클릭으로 시작하고 피격까지 생존 시간을 기록할 수 있다.
- WASD·방향키 이동, `Esc` 대기화면 복귀, 공격 예고, 피격, 종료, 즉시 재시작이 동작한다.
- 첫 방문자가 계정과 이름 입력 없이 익명으로 바로 플레이한다.
- 실제 제3자 로고나 권리 불명 에셋이 없다.
- `pnpm check`가 통과한다.
- 게임 제목과 200자 이내 소개가 준비되어 있다.
- 16:9 썸네일이 있다.

### 선택 가산점 준비

아래 항목은 공식 필수가 아니며, 필수 제출과 실제 게임 QA를 늦추지 않는 범위에서 준비한다.

- 3분 이하 실제 플레이 영상 링크
- Codex 활용 과정을 어디에 사용했는지, 어떤 기능·문제를 해결했는지, 사람이 직접 결정한 부분이 무엇인지 사실에 맞게 정리

## 3. 3일 계획

### 2026-08-23 — 환경과 graybox

- 저장소 지침과 설계 문서
- TypeScript + Vite + Phaser 실행 환경
- 키보드 이동과 직선 공격 회피
- 생존 시간과 한 번 피격 종료
- 로컬에서 시작부터 재시작까지

완료 조건: 도형만 사용해도 핵심 위험/보상 루프를 반복 플레이할 수 있다.

### 2026-08-24 — 완성 가능한 게임

- 직선·범위 공격, 피격, 난이도 상승
- HUD와 명확한 시각 피드백
- 효과음과 기본 연출
- Guest session 최고점 하나
- 첫 production 배포

완료 조건: 다른 사람이 설명 없이 플레이하고 점수를 남길 수 있다.

### 2026-08-25 — QA와 제출

- 브라우저와 화면 크기 점검
- QHD·FHD에서 같은 gameplay 비율과 approval opening 판독성 확인
- 난이도 및 점수 밸런스
- 썸네일 제작
- 실제 플레이 영상 녹화
- Codex 활용 기록 정리
- 제출 양식 완료
- 위 항목이 끝나고 시간이 남으면 글로벌 랭킹 구현

완료 조건: 제출 링크와 자료를 실제 제출하고 접수 결과를 확인한다.

### 2026-08-26 — 버퍼

- 호스팅 상태 확인
- 치명적인 버그만 수정
- 새 기능은 추가하지 않음

## 4. 기능 우선순위와 컷 기준

### 반드시 유지

- 이동
- 생존 시간
- 한 번 피격 종료와 즉시 재시작
- 의미가 행동으로 드러나는 Codex 경험 기반 8개 공격 패턴
- Stage 1–10 시간 기반 난이도 상승
- 공개 웹 빌드

### 시간이 부족하면 단순화

- Stage 8–10의 동시 발생 수와 particle 밀도
- 수렴 경로의 장식 선과 보조 문구
- 음악 → 효과음만

### 가장 먼저 제거

- 글로벌 랭킹, 게스트 ID, 랭킹 서버
- 특수 아이템
- 일일 시드와 기간별 랭킹
- 모바일 터치 최적화
- 추가 게임 모드

## 5. 제출 전 실제 점검

### 링크

- [x] HTTPS — [현재 공개 제출 URL](https://await-codex-context-overflow.jygjyg99.chatgpt.site)
- [x] public 접근으로 전환
- [x] public URL에서 로그인과 승인 불필요
- [x] 첫 로딩 후 오류 없음
- [x] font API 미지원·reject·1.5초 timeout에서도 game boot 계속
- [x] original context-loop PNG favicon이 production bundle에 포함
- [x] Open Graph·Twitter 공유 카드가 favicon·Start header와 같은 original game mark 사용
- [x] 조작법 표시
- [ ] 별도 로그인 상태가 없는 브라우저에서 실제 플레이 확인
- [ ] 다른 PC 또는 휴대폰 네트워크에서 접속

### 플레이

- [x] 로그인·닉네임 입력 없이 익명으로 시작
- [x] 10초 안에 WASD·방향키 이동과 첫 공격 회피 가능
- [x] 한 번 피격 시 생존 시간으로 종료
- [x] 개발 검증에서 12·24·36·48·60·72초 패턴 해제와 108초 Stage 10 cap
- [x] 재시작 시 상태 초기화
- [x] lifecycle 회귀 검증에서 blur·hidden 시 fixed-step·held key reset, focus 후 명시적 action 전까지 pause 유지
- [ ] 실제 브라우저 background 탭 복귀 시 타이머 정상
- [x] M 입력과 Web Audio 음소거·active tone 차단

### 랭킹 — 후순위 기능을 구현한 경우에만

- [ ] 자동 생성 게스트 이름으로 제출
- [ ] 같은 게스트는 최고점 한 자리만 표시
- [ ] 비정상 점수 상한 거부
- [ ] 중복 run 제출 처리
- [ ] API 실패 시 게임 유지
- [ ] 실제 Top 10 조회

### 권리와 공개 정보

- [x] 사용한 폰트, 음원, 이미지, 코드의 라이선스 기록 — `docs/LICENSES.md`
- [x] 제3자 앱 로고 없음
- [x] 비밀키와 개인정보가 bundle 또는 저장소에 없음
- [ ] 제출 자료에 비공개 정보 없음

### 제출 자료

- [x] 게임 제목 — `await CODEX: CONTEXT//OVERFLOW`
- [ ] 200자 이내 소개
- [x] 플레이 URL — [production](https://await-codex-context-overflow.jygjyg99.chatgpt.site)
- [x] 16:9 PNG/JPG 썸네일 — `public/og.png` 1672×941, PNG signature·16:9 허용 오차·10MB 이하 production gate
- [ ] 선택 가산점: 3분 이하 실제 플레이 영상
- [x] 선택 가산점 근거: Codex 활용 과정 — `docs/WORKLOG.md`, `docs/DECISIONS.md`
