# Finance Knowledge Guide

경제·재무 관련 자격증 학습 내용을 바탕으로 만든 통합 정리본 프로젝트입니다.

목표 산출물은 두 가지입니다.

- 정적 웹앱: `dist/index.html`
- PDF용 인쇄 HTML: `dist/finance-guide-print.html`

브라우저에서 `dist/finance-guide-print.html`을 열고 인쇄 메뉴에서 PDF로 저장하면 됩니다. GitHub Pages에는 `dist/`의 정적 파일을 배포 대상으로 쓰면 됩니다.

## 콘텐츠 구조

- `source/`: 원자료 보존 영역
- `content/chapters/`: 4대 챕터 편집본
- `content/source-map.md`: 원자료와 공식 보강 출처의 연결표
- `site/`: 정적 웹앱 템플릿과 인터랙티브 스크립트
- `scripts/build.py`: 콘텐츠를 `dist/`로 빌드

## 빌드

```powershell
python scripts/build.py
```

빌드 후 `dist/index.html`을 열면 웹앱을 볼 수 있습니다.

## 작성 원칙

- 자격증 보유자 수준의 깊이를 목표로 하며, 단순 용어 암기보다 개념 간 연결과 실무 판단 기준을 우선합니다.
- 세제, 법률, 금융상품 제도처럼 변동 가능한 내용은 공식 출처 확인이 필요한 항목으로 표시합니다.
- 원자료의 표현은 그대로 복사하기보다 구조화·검증·보강하여 재작성합니다.


## Versioning

웹앱 제목 옆 버전은 `VERSION` 파일에서 읽어옵니다. 배포용 커밋을 만들 때마다 `0.0.1`, `0.0.2`처럼 숫자를 올린 뒤 `python scripts/build.py`를 실행해 `dist/`를 갱신합니다.
