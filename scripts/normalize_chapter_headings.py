from pathlib import Path
import re

ROOT = Path('content/chapters')
files = [
    ROOT / '01_economics.md',
    ROOT / '02_finance.md',
    ROOT / '03_planning.md',
    ROOT / '04_law.md',
]

prefix_re = re.compile(r'^(?:[A-Z]|[0-9]+)(?:\.[0-9]+)*\.\s*')

for path in files:
    counters = {4: 0, 5: 0, 6: 0}
    out = []
    for line in path.read_text(encoding='utf-8').splitlines():
        m = re.match(r'^(#{4,6})\s+(.+)$', line)
        if not m:
            out.append(line)
            continue
        level = len(m.group(1))
        title = prefix_re.sub('', m.group(2).strip())
        if level == 4:
            counters[4] += 1
            counters[5] = 0
            counters[6] = 0
            number = f'{counters[4]}'
        elif level == 5:
            if counters[4] == 0:
                counters[4] = 1
            counters[5] += 1
            counters[6] = 0
            number = f'{counters[4]}.{counters[5]}'
        else:
            if counters[4] == 0:
                counters[4] = 1
            if counters[5] == 0:
                counters[5] = 1
            counters[6] += 1
            number = f'{counters[4]}.{counters[5]}.{counters[6]}'
        out.append(f'{m.group(1)} {number}. {title}')
    path.write_text('\n'.join(out) + '\n', encoding='utf-8')
