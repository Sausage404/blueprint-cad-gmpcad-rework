// Préférences de l'utilisateur, gardées dans un fichier JSON du dossier de l'appli.
import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PREFS, type Prefs } from '../shared/types';

const file = () => join(app.getPath('userData'), 'preferences.json');

export function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf-8')) as Partial<Prefs>;
    // Le thème par défaut est passé de Classique à Moderne : un thème enregistré n'est gardé que s'il a été
    // choisi dans le menu (les anciennes préférences enregistraient aussi celui par défaut).
    if (!saved.themeChoisi) delete saved.theme;
    return { ...DEFAULT_PREFS, ...saved };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Les préférences avec une valeur changée ; un thème réglé est un thème choisi. */
export function avecPref<K extends keyof Prefs>(prefs: Prefs, cle: K, valeur: Prefs[K]): Prefs {
  return { ...prefs, [cle]: valeur, ...(cle === 'theme' ? { themeChoisi: true } : {}) };
}

export function savePrefs(prefs: Prefs): void {
  try {
    writeFileSync(file(), JSON.stringify(prefs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Préférences non enregistrées :', err);
  }
}
