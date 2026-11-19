import csv, html, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from icons import BASE

ROOT = '/home/claude/gmpcad/maquette/root/project'
SOMBRE = '/_blob/15f1b7d62fb9256aaac4b1fe062ebb8b'
TSV = '/home/claude/gmpcad/pack/reference-gmpcad/listes/palette_menu_de_base.tsv'

names = {}
with open(TSV, encoding='utf-8') as f:
    rd = csv.reader(f, delimiter='\t'); next(rd)
    for r, c, fam, txt in rd:
        names[(int(r) - 1, int(c) - 1)] = txt
names[(4, 6)] = 'Fonction (*) — sans infobulle dans l’original'

BAR = ['#0e9fb3', '#1f9d55', '#1f9d55', '#d4a200', '#e5484d']
LBL = ['#0b6f7d', '#1b7a43', '#1b7a43', '#7d5c00', '#b5232a']
FAM = ['Habillage', 'Création', 'Création', 'Modification', 'Gestion']
HOVER = (2, 3)

def icon(body):
    return ('<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>')

rows = []
for r, row in enumerate(BASE):
    cells = []
    for c, body in enumerate(row):
        name = html.escape(names[(r, c)].rstrip('.'), quote=True)
        hov = (r, c) == HOVER
        bg, bd = ('#eaf1fb', '1.5px solid #6f97d6') if hov else ('#ffffff', '1px solid #e1e4e9')
        tip = ''
        if hov:
            tip = ('<span role="tooltip" style="position: absolute; left: 0; top: 50px; z-index: 2; white-space: nowrap; '
                   'padding: 6px 10px; border-radius: 7px; background: #2b2f36; color: #ffffff; font-size: 12px; '
                   f'font-weight: 500; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25)">{names[(r, c)]}</span>')
        cells.append(
            f'<button aria-label="{name}" style="position: relative; width: 44px; height: 44px; display: flex; '
            f'align-items: center; justify-content: center; padding: 0; border-radius: 8px; border: {bd}; background: {bg}; '
            f'color: #2b2f36; cursor: pointer; --fam: {BAR[r]}">{icon(body)}'
            f'<span aria-hidden="true" style="position: absolute; left: 9px; right: 9px; bottom: 3px; height: 3px; '
            f'border-radius: 2px; background: {BAR[r]}"></span>{tip}</button>')
    label = (f'<sc-if value="{{{{familles}}}}" hint-placeholder-val="{{{{ true }}}}">'
             f'<div style="width: 104px; flex: none; display: flex; align-items: center; gap: 7px; font-size: 12px; '
             f'font-weight: 600; color: {LBL[r]}"><span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 4px; '
             f'background: {BAR[r]}"></span>{FAM[r]}</div></sc-if>')
    rows.append(f'<div style="display: flex; align-items: center; gap: 6px">{label}'
                f'<div style="display: grid; grid-template-columns: repeat(20, minmax(0, 1fr)); gap: 4px; width: 956px">'
                + ''.join(cells) + '</div></div>')

doc = f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Palette Menu de Base modernisée</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap">
<style>
body{{margin:0}}
a{{color:#0a5bc4}}a:hover{{color:#073f88}}
</style>
</helmet>
<div style="position: relative; width: 1280px; height: 600px; overflow: hidden; background: #1d2126; font-family: Inter, system-ui, -apple-system, sans-serif; color: #1d1f23">
<img src="{SOMBRE}" alt="" aria-hidden="true" style="position: absolute; left: 40px; top: 24px; width: 1200px; height: auto; opacity: 0.45">
<div style="position: absolute; left: 64px; top: 56px; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px 14px; background: #f6f6f8; border: 1px solid #c3c7ce; border-radius: 14px; box-shadow: 0 20px 44px rgba(0, 0, 0, 0.45)">
<div style="display: flex; align-items: center; gap: 12px; height: 26px; padding: 0 2px">
<span style="font-size: 13px; font-weight: 700">Menu de Base</span>
<span style="flex: 1"></span>
<span style="font-size: 12px; color: #555b64">Barre d’espace pour ouvrir · se referme quand la souris en sort</span>
</div>
{chr(10).join(rows)}
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"familles":{{"editor":"boolean","default":true,"section":"Affichage"}},"$preview":{{"width":1280,"height":600}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{ familles: this.props.familles ?? true }};
}}
}}
</script>
</body>
</html>
'''
open(os.path.join(ROOT, 'Palette.dc.html'), 'w', encoding='utf-8').write(doc)
print('ok', len(doc))
