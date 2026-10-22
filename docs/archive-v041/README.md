# 무협생활 v0.4.1

빌드 없이 실행하는 텍스트 무협 인생 시뮬레이션이다. ZIP을 풀고 index.html을 Edge 또는 Chrome에서 연다. 0~7세는 자동으로 지나고8세부터 조작한다. 1배속은1년12초이며 사계절에 행동을 예약한다. 중요한 사건과 전투에서는 시간이 멈춘다. 무공을 익히지 않아도 생업·인연·가족·노년과 일대기를 경험할 수 있다.

설정 → 게임 설정 → 테스트 모드를 켜면 현재 삶의 복사본에서 개발 도구를 사용할 수 있다. 원본 복원·종료로 이전 삶을 정확히 되돌린다. 테스트 중 일반 저장 슬롯을 보호하며 명시 저장은 별도 JSON 파일로 내보낸다.

- [테스트 모드 사용법](docs/TEST-MODE.md)
- [구현 실사·63탭 범위·판정](docs/IMPLEMENTATION-AUDIT.md)
- [설정 충돌과 결정 사항](docs/RULE-CONFLICTS.md)
- [이번 변경 기록](docs/IMPLEMENTATION-CHANGELOG.md)
- [실제 QA 결과](docs/QA-RESULT.md)
- [기존 세계관](docs/WORLD.md)
- [현재 밸런스 표본](docs/BALANCE.md)

원본은 사용자 제공 murim_prototype (2).zip의 v0.4.0이다. 원래 실행 구조·연대기 UI·120사건·서사 소재집·삽화·전투·소문·민초 경로를 유지했다. 새 출생 데이터는 가구·혈연·문파를 분리한다. 자연 출생은 기존6종18/28/18/16/12/8을 유지하며7가구·5가문·본가/분가·직계/방계 조합은 테스트 생성기에서 사용할 수 있다. 신규 가문의 자연 확률·전수·가산 운영은 미확정이다.

새 게임과 이전 버전 저장은 같은 일반 저장 키 murim-playable-v03을 사용한다. v0.3.x와 v0.4.0 데이터를 이행하며 이전 로그·NPC·혈연·재산·무공·대기 사건·전투·연쇄 기록을 유지한다. 과거 noble은 남궁 본가 직계로 유지한다. 버전 이행 전 원문 백업 슬롯도 보존한다. 기존 데이터를 지우는 절차는 없다.

490검사 통과, PC·모바일50배치 가로 넘침0, 표준10,008회 및 지도층1,152회 새 생애 실험 규칙 위반0. 원본 v0.4.0의 과거 검증과 이번 결과를 구분한다. 일부 기능과 실제 사람의 체감은 미완이며 상세 제한은 문서에 기록했다.

## 검증과 배포

Windows PowerShell과 설치된 Microsoft Edge를 사용한다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify-ui.ps1 -Samples 10008
powershell -NoProfile -ExecutionPolicy Bypass -File tools/write-release-report.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/package-release.ps1
```

같은 engine/story-pool/birth-model 해시로 이번 세션의 생애 실험이 이미 존재하면 -ReuseSimulation으로 회귀·화면 검사를 다시 실행할 수 있다. 소스가 바뀌면 재사용을 거절한다. 자동 검사에서는 전용 브라우저 프로필을 사용한다.

Google 기획서의42~45 감사 탭과 동일 구조의 CSV를 docs에 보관한다. 원문63탭 snapshot, 원본 소스 manifest, 실제 이전 버전 저장 fixture, 행별 감사·충돌·적용·테스트 데이터와 최종 실행 파일 해시를 함께 남긴다. .qa 폴더와 과거 ZIP은 실행/배포 대상이 아니다.

