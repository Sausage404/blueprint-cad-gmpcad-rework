"""Exporte les icônes redessinées (docs/maquette/icons.py) en JSON pour l'appli.

icons.py reste la source : après l'avoir modifié, relancer `npm run icons`.
"""
import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, '..', '..', 'docs', 'maquette', 'icons.py')
DEST = os.path.join(HERE, '..', 'src', 'renderer', 'icons.json')

spec = importlib.util.spec_from_file_location('icons', SOURCE)
icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(icons)

assert len(icons.BASE) == 5 and all(len(row) == 20 for row in icons.BASE), 'BASE doit faire 5 x 20'

# Infobulles de la palette « Menu de Base », case par case.
TSV = os.path.join(HERE, '..', '..', 'docs', 'reference-gmpcad', 'listes', 'palette_menu_de_base.tsv')
labels = [[''] * 20 for _ in range(5)]
with open(TSV, encoding='utf-8') as f:
    next(f)
    for line in f:
        ligne, colonne, _famille, texte = line.rstrip('\n').split('\t')
        labels[int(ligne) - 1][int(colonne) - 1] = texte
assert all(all(row) for row in labels), 'case sans infobulle dans le TSV'

data = {'base': icons.BASE, 'baseLabels': labels, 'left': icons.LEFT, 'ui': icons.UI}
with open(DEST, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print('icônes exportées :', os.path.relpath(DEST, os.path.join(HERE, '..')))
