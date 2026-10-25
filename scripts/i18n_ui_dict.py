"""영어 화면 사전(dist/i18n-en.js) 관리 (2026-10-24, 표준 라이브러리만).

dist/i18n-en.js는 묶음(@section)마다 JSON 객체 하나를 Object.assign(I18N_EN, {...})로 더한다. 키는 정규화한 한국어 원문
(앞뒤 공백 제거, 연속 공백 하나로), 값은 영어. 이 스크립트가 읽고 쓰므로 손으로 고칠 때도 JSON 문법(따옴표, 끝 쉼표 없음)을 지킨다.

  python scripts/i18n_ui_dict.py add <묶음 이름> <파일.json>   # {한국어: 영어} 파일을 그 묶음에 더한다(같은 키는 새 값으로)
  python scripts/i18n_ui_dict.py list                         # 묶음별 항목 수
  python scripts/i18n_ui_dict.py stamp                        # ?v= 캐시 값을 파일 sha256(LF 기준) 앞 10자로 맞춘다

stamp는 i18n.js 안의 i18n-en.js·i18n-data-en.json 값을 먼저 맞추고, 그다음 index.html·expedition.html이 ?v=로 부르는
dist 안 파일을 모두 맞춘다(verification/test_client_outdated.mjs가 같은 규칙을 검사한다).
"""
import hashlib
import json
import pathlib
import re
import sys

DIST = pathlib.Path(__file__).resolve().parent.parent / 'dist'
EN_JS = DIST / 'i18n-en.js'
HEAD = """'use strict';
// 영어 화면 사전 (2026-10-24). i18n.js가 영어(?lang=en)일 때만 불러온다. 키 = 정규화한 한국어 원문, 값 = 영어.
// 묶음(@section)마다 Object.assign 한 번. 고칠 때는 python scripts/i18n_ui_dict.py add/stamp, 팀 검토는 docs/i18n-review.csv.
// 값에는 태그를 넣지 않는다. 예외는 index.html의 data-i18n-html 문장(키도 HTML)뿐이다. 번역은 Claude 초안이며 팀 검토가 필요하다.
"""
SECTION = re.compile(r'// @section (.+?)\nObject\.assign\(I18N_EN,(\{.*?\n\})\);\n', re.S)
key = lambda s: re.sub(r'\s+', ' ', s).strip()


def read():
    if not EN_JS.exists():
        return {}
    return {m.group(1): json.loads(m.group(2)) for m in SECTION.finditer(EN_JS.read_text(encoding='utf-8'))}


def write(sections):
    out = [HEAD]
    for name, d in sections.items():
        body = ',\n'.join(json.dumps(k, ensure_ascii=False) + ':' + json.dumps(v, ensure_ascii=False) for k, v in d.items())
        out.append(f'// @section {name}\nObject.assign(I18N_EN,{{\n{body}\n}});\n')
    EN_JS.write_text(''.join(out), encoding='utf-8', newline='\n')
    assert read() == sections, 'i18n-en.js round trip'


def sha10(p):
    return hashlib.sha256(p.read_bytes().replace(b'\r\n', b'\n')).hexdigest()[:10]


def stamp():
    i18n = DIST / 'i18n.js'
    s = i18n.read_text(encoding='utf-8')
    for f in ('i18n-en.js', 'i18n-data-en.json'):
        if (DIST / f).exists():
            s = re.sub(re.escape(f) + r'\?v=[0-9a-f]+', f'{f}?v={sha10(DIST / f)}', s)
    i18n.write_text(s, encoding='utf-8', newline='\n')
    for page in ('index.html', 'expedition.html'):
        p = DIST / page
        h = p.read_text(encoding='utf-8')
        h = re.sub(r'(["/])([\w./-]+\.(?:js|css|json))\?v=[0-9a-f]+',
                   lambda m: f'{m.group(1)}{m.group(2)}?v={sha10(DIST / m.group(2))}' if (DIST / m.group(2)).exists() else m.group(0), h)
        p.write_text(h, encoding='utf-8', newline='\n')


def main(argv):
    if argv[:1] == ['add'] and len(argv) == 3:
        sections = read()
        new = {key(k): v for k, v in json.loads(pathlib.Path(argv[2]).read_text(encoding='utf-8')).items()}
        for d in sections.values():
            for k in new:
                d.pop(k, None)
        sections.setdefault(argv[1], {}).update(new)
        write({n: d for n, d in sections.items() if d})
        print(f'{argv[1]}: +{len(new)} -> {sum(map(len, read().values()))} entries')
    elif argv[:1] == ['list']:
        for n, d in read().items():
            print(f'{len(d):5d}  {n}')
    elif argv[:1] == ['stamp']:
        stamp()
        print('stamped')
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
