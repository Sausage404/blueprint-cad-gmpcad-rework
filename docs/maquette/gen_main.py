import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from icons import LEFT, UI, svg

ROOT = '/home/claude/gmpcad/maquette/root/project'
os.makedirs(ROOT, exist_ok=True)
SOMBRE = '/_blob/15f1b7d62fb9256aaac4b1fe062ebb8b'
CLAIR = '/_blob/bbe4dde5061743cbc4b205d6d3692add'

def sv(body, size='{{iconPx}}'):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>')

def tool(key, label, aria, active=False, fam=None):
    bg = '#e4ebf7' if active else 'transparent'
    bd = '#a9bfe3' if active else 'transparent'
    lab = (f'<span style="font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: #2b2f36">{label}</span>'
           if label else '')
    famstyle = f' --fam: {fam};' if fam else ''
    return (f'<button aria-label="{aria}" style="width: {{{{btnW}}}}; height: {{{{btnH}}}}; display: flex; flex-direction: column; '
            f'align-items: center; justify-content: center; gap: 3px; padding: 0; border-radius: 10px; border: 1px solid {bd}; '
            f'background: {bg}; color: #2b2f36; font: inherit; cursor: pointer;{famstyle}">{sv(LEFT[key])}{lab}</button>')

def chip(icon, text, aria, extra='', disabled=False):
    col = '#8a9099' if disabled else '#2b2f36'
    return (f'<button aria-label="{aria}" style="display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; '
            f'border-radius: 7px; border: 1px solid #d3d7de; background: #ffffff; color: {col}; font: inherit; font-size: 12px; '
            f'white-space: nowrap">{extra}{sv(UI[icon], 16) if icon else ""}<span>{text}</span></button>')

MENUS = ['Fichier', 'Edition', 'Gmac', 'Groupe', 'Métier', 'Outils', 'Préférences', 'Fenêtres', 'Aide']
menubar = ''.join(f'<span style="padding: 2px 0">{m}</span>' for m in MENUS)

html = f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Écran principal modernisé</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;600&amp;display=swap">
<style>
body{{margin:0}}
a{{color:#0a5bc4}}a:hover{{color:#073f88}}
</style>
</helmet>
<div style="min-height: 920px; display: flex; flex-direction: column; background: #d7dbe1; font-family: Inter, system-ui, -apple-system, sans-serif; color: #1d1f23">
<div style="display: flex; align-items: center; flex-wrap: wrap; column-gap: 18px; row-gap: 2px; min-height: 28px; padding: 0 16px; background: #f4f4f6; border-bottom: 1px solid #c3c7ce; font-size: 13px">
<span style="font-weight: 700">[NOM DU LOGICIEL]</span>
{menubar}
</div>
<div style="flex: 1; display: flex; padding: 24px">
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; background: #f6f6f8; border: 1px solid #b4b9c1; border-radius: 12px; box-shadow: 0 18px 40px rgba(20, 24, 31, 0.22); overflow: hidden">
<div style="display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; background: #ececf0; border-bottom: 1px solid #d9dce1">
<span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 6px; background: #ff5f57"></span>
<span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 6px; background: #febc2e"></span>
<span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 6px; background: #28c840"></span>
<div style="flex: 1; text-align: center; font-size: 13px; font-weight: 600">BROCHE.des <span style="font-weight: 400; color: #555b64">— Format A1H · Échelle 1</span></div>
<span aria-hidden="true" style="width: 52px"></span>
</div>
<div style="flex: 1; display: flex; min-height: 700px">
<div style="flex: none; width: {{{{barW}}}}; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 0; background: #f6f6f8; border-right: 1px solid #d9dce1">
{tool('base', 'BASE', 'Menu de Base (barre d’espace)', active=True, fam='#1f9d55')}
{tool('meca', 'MECA', 'Menu métier Mécanique')}
{tool('calculs', 'CALCULS', 'Calculs')}
<span aria-hidden="true" style="width: 40px; height: 1px; background: #d9dce1; margin: 4px 0"></span>
{tool('traceur', '', 'Traceur (impression)')}
{tool('calc', '', 'Calculatrice')}
{tool('xy', '', 'Saisie en coordonnées cartésiennes', fam='#1f9d55')}
{tool('polar', '', 'Saisie en coordonnées polaires')}
<span aria-hidden="true" style="flex: 1"></span>
{tool('niveaux', '', 'Bouton du bas de la barre d’outils (rôle à confirmer)')}
</div>
<div style="flex: 1; min-width: 0; position: relative; height: 700px; background: {{{{canvasBg}}}}; overflow: hidden">
<img src="{{{{drawingSrc}}}}" alt="Plan d’ensemble BROCHE au format A1, en traits de couleur par niveau" style="position: absolute; left: 3%; top: 3%; width: 94%; height: auto">
<svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%">
<line x1="0" y1="41" x2="100" y2="41" stroke="{{{{reticule}}}}" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0.8"/>
<line x1="47" y1="0" x2="47" y2="100" stroke="{{{{reticule}}}}" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0.8"/>
<line x1="33" y1="58" x2="47" y2="41" stroke="#4cc38a" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>
</svg>
<span aria-hidden="true" style="position: absolute; left: 47%; top: 41%; width: 12px; height: 12px; margin: -7px 0 0 -7px; border: 1.5px solid {{{{reticule}}}}; border-radius: 2px"></span>
<span aria-hidden="true" style="position: absolute; left: 33%; top: 58%; width: 10px; height: 10px; margin: -5px 0 0 -5px">
<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><line x1="5" y1="0" x2="5" y2="10" stroke="#ff5a52" stroke-width="2"/><line x1="0" y1="5" x2="10" y2="5" stroke="#ff5a52" stroke-width="2"/></svg>
</span>
<span aria-hidden="true" style="position: absolute; right: 4px; top: 30%; width: 6px; height: 120px; border-radius: 3px; background: rgba(150, 156, 166, 0.55)"></span>
<span aria-hidden="true" style="position: absolute; bottom: 4px; left: 40%; width: 180px; height: 6px; border-radius: 3px; background: rgba(150, 156, 166, 0.55)"></span>
</div>
</div>
<div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding: 8px 12px; background: #ffffff; border-top: 1px solid #d9dce1">
<div aria-label="Fonction en cours : segment de droite" style="flex: none; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: #e7f5ed; color: #17663a; --fam: #1f9d55">{sv(UI['segment'], 22)}</div>
<div style="flex: 1 1 320px; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 14px; color: #1d1f23">Segment de droite. <span style="font-weight: 600">Désigner un point.</span></div>
<div style="font-size: 12px; color: #555b64">Application : BROCHE · Format A1H (840 × 594) · Échelle du plan : 1</div>
</div>
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 12px; background: #eef0f3; border-top: 1px solid #d9dce1">
{chip('trait', 'Continu fort', 'Type de trait courant : continu fort')}
{chip('cale', 'Calé 15°', 'Calage angulaire : 15 degrés')}
{chip('', 'Niv 1', 'Niveau de travail : 1', extra='<span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 3px; background: #28b463"></span>')}
{chip('zoom', 'Zoom 0,37', 'Zoom : 0,37')}
{chip('grille', 'Pas 1 mm', 'Pas de la grille : 1 millimètre')}
{chip('disk', '68 Ko', 'Taille estimée du fichier : 68 kilo-octets')}
{chip('cote', 'AFNOR', 'Système de cotation : AFNOR')}
{chip('', '(+)', 'Indicateur à identifier', disabled=True)}
</div>
</div>
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"fond":{{"editor":"enum","options":["Graphite","Gris","Clair"],"default":"Graphite","section":"Thème"}},"grandesIcones":{{"editor":"boolean","default":false,"section":"Thème"}},"reticule":{{"editor":"color","options":["#e040fb","#3dd6f5","#ffd43b","#ff6b6b"],"default":"#e040fb","section":"Thème"}},"$preview":{{"width":1280,"height":920}}}}'>
class Component extends DCLogic {{
renderVals() {{
const fond = this.props.fond ?? 'Graphite';
const big = this.props.grandesIcones ?? false;
const bg = {{ Graphite: '#1d2126', Gris: '#6b7079', Clair: '#f4f4f1' }};
return {{
canvasBg: bg[fond] ?? '#1d2126',
drawingSrc: fond === 'Clair' ? '{CLAIR}' : '{SOMBRE}',
reticule: this.props.reticule ?? '#e040fb',
iconPx: big ? 30 : 24,
btnW: big ? '72px' : '60px',
btnH: big ? '76px' : '60px',
barW: big ? '92px' : '76px'
}};
}}
}}
</script>
</body>
</html>
'''
open(os.path.join(ROOT, 'Main.dc.html'), 'w', encoding='utf-8').write(html)

canvas = {
  "v": 3,
  "createdOnFiles": {"v": 1, "at": "2026-11-18T05:55:00Z"},
  "title": "Maquette — interface GMPCAD modernisée",
  "launch": {"view": "canvas"},
  "pages": [],
  "boards": {
    "Original.dc.html": {"x": 0, "y": 0, "w": 1280, "h": 1024, "title": "Original — GMPCAD 2007"},
    "Main.dc.html": {"x": 1360, "y": 0, "w": 1280, "h": 920, "expand": "fill", "title": "Moderne — écran principal (macOS)"},
    "OriginalPalette.dc.html": {"x": 0, "y": 1444, "w": 1133, "h": 289, "title": "Original — palette « Menu de Base »"},
    "Palette.dc.html": {"x": 1360, "y": 1444, "w": 1280, "h": 600, "title": "Moderne — palette « Menu de Base »"}
  },
  "order": ["Main.dc.html", "Original.dc.html", "OriginalPalette.dc.html", "Palette.dc.html"],
  "notes": {
    "titreEcran": {"x": 0, "y": -300, "text": "Écran principal : l’original (2007) et la version modernisée", "kind": "title1", "maxW": 2640},
    "titrePalette": {"x": 0, "y": 1144, "text": "Palette « Menu de Base » (barre d’espace) : mêmes cases, mêmes couleurs", "kind": "title1", "maxW": 2640}
  },
  "designSystems": []
}
json.dump(canvas, open(os.path.join(ROOT, 'canvas.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', os.path.getsize(os.path.join(ROOT, 'Main.dc.html')))
