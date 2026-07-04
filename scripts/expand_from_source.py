from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "merged_20260401_001718.md"
OUT = ROOT / "content" / "chapters"


def section(text: str, start_heading: str, end_heading: str | None = None) -> str:
    start = text.index(start_heading)
    end = len(text) if end_heading is None else text.index(end_heading, start + len(start_heading))
    return text[start:end].strip()


def strip_heading(block: str) -> str:
    lines = block.splitlines()
    if lines and lines[0].startswith("## "):
        return "\n".join(lines[1:]).strip()
    return block.strip()


def level_shift(markdown: str, delta: int = 1) -> str:
    def repl(match: re.Match[str]) -> str:
        return "#" * (len(match.group(1)) + delta) + " "

    return re.sub(r"^(#{2,5})\s+", repl, markdown, flags=re.MULTILINE)


def normalize_bullets(markdown: str) -> str:
    markdown = markdown.replace("*   ", "- ")
    markdown = markdown.replace("    *   ", "  - ")
    markdown = markdown.replace("        *   ", "    - ")
    return markdown


def write_chapter(filename: str, title: str, lead: str, body: str, extra: str = "") -> None:
    final = f"# {title}\n\n{lead.strip()}\n\n{normalize_bullets(level_shift(body)).strip()}\n"
    if extra.strip():
        final += f"\n{extra.strip()}\n"
    (OUT / filename).write_text(final + "\n", encoding="utf-8")


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")

    planning = strip_heading(section(text, "## I. 재무 및 자산설계", "## II. 투자 관련"))
    investing = strip_heading(section(text, "## II. 투자 관련", "## III. 법률 및 규제"))
    law = strip_heading(section(text, "## III. 법률 및 규제", "## 추가 보완 포인트"))

    macro = section(investing, "### A. 거시경제 분석 및 예측", "### B. 금융상품의 이해")
    finance = investing[investing.index("### B. 금융상품의 이해") :].strip()

    write_chapter(
        "01_economics.md",
        "1. 경제",
        "거시경제 분석 파트는 금융시장 판단의 출발점이다. GDP, 물가, 고용, 금리, 환율, 재정·통화정책, 경기순환을 단절된 암기 항목이 아니라 자산가격과 기업가치에 연결되는 전달경로로 정리한다.",
        macro,
        """## 정리 포인트

- 생산물시장, 노동시장, 화폐시장, 외환시장을 함께 보아야 경기 국면 판단이 흔들리지 않는다.
- 금리와 환율은 정책 변수이면서 동시에 시장가격이다. 중앙은행의 현재 결정뿐 아니라 향후 경로 기대가 중요하다.
- 경기예측 지표는 선행·동행·후행 지표의 역할을 구분하고, 단일 지표보다 조합으로 해석한다.
""",
    )

    write_chapter(
        "02_finance.md",
        "2. 금융",
        "금융 파트는 금융상품, 주식, 채권, 파생상품, 투자설계, 부동산, 재무제표 분석을 하나의 투자 의사결정 체계로 묶는다. 각 상품의 수익 원천과 위험, 평가모형, 규제상 유의점을 함께 본다.",
        finance,
        """## 정리 포인트

- 주식은 현금흐름·성장률·할인율, 채권은 현금흐름·만기·금리위험, 파생상품은 기초자산·변동성·시간가치가 핵심이다.
- 투자성과 평가는 단순 수익률이 아니라 위험조정성과, 벤치마크 대비 성과, 비용과 세후수익률까지 포함한다.
- 부동산과 대안투자는 유동성, 레버리지, 규제, 평가 불확실성을 별도 위험으로 다룬다.
""",
    )

    write_chapter(
        "03_planning.md",
        "3. 재무설계",
        "재무설계 파트는 고객의 생애주기, 현금흐름, 자산·부채, 세금, 연금, 위험성향을 종합해 목표 달성 경로를 설계하는 영역이다. 상품보다 먼저 목표와 제약을 정의한다.",
        planning,
        """## 정리 포인트

- 재무설계는 관계 정립, 정보 수집, 분석, 제안, 실행, 사후관리의 반복 프로세스다.
- 세금은 투자수익률과 현금흐름을 직접 바꾸므로 상품 선택 전후에 반드시 재검토한다.
- 은퇴·상속·증여 설계는 장기 현금흐름과 가족관계, 세법상 평가, 유동성 확보를 함께 본다.
""",
    )

    write_chapter(
        "04_law.md",
        "4. 법률",
        "법률 파트는 금융거래와 투자권유가 어떤 규율 아래 움직이는지를 설명한다. 민법·상법의 기본 권리관계, 은행거래, 금융소비자보호법, 자본시장법, 직무윤리를 실무 판단 기준으로 연결한다.",
        law,
        """## 정리 포인트

- 자본시장법은 금융투자상품, 금융투자업, 투자자 분류, 영업행위 규제, 공시와 불공정거래 규제가 중심이다.
- 금융소비자보호법은 판매 과정의 원칙과 소비자 권리를 다루므로 실제 권유·설명·광고 장면에 적용해야 한다.
- 직무윤리는 단순 규범이 아니라 이해상충, 정보차단, 고객우선 원칙을 구현하는 내부통제 체계다.
""",
    )


if __name__ == "__main__":
    main()

