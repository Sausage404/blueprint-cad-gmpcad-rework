// Outil de vérification (développement) : voir app/README.md, « Pour vérifier l'écran sans le regarder ».
import { app, type BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';

/**
 * DAO_CAPTURE=fichier.png enregistre une image de la fenêtre puis quitte.
 * DAO_SCENARIO=palette ouvre la palette avant la capture. La souris est placée au centre de la zone de dessin.
 */
export async function capturer(win: BrowserWindow, fichier: string): Promise<void> {
  const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const wc = win.webContents;
  await attendre(800);
  wc.sendInputEvent({ type: 'mouseMove', x: 641, y: 461 });
  if (process.env.DAO_OUVRIR) {
    await wc.executeJavaScript(`window.daoCapture.ouvrir(${JSON.stringify(process.env.DAO_OUVRIR)})`);
    await attendre(600);
    if (process.env.DAO_SVG) writeFileSync(process.env.DAO_SVG, await wc.executeJavaScript('window.daoCapture.svg()'));
  }
  if (process.env.DAO_SCENARIO === 'palette') {
    await attendre(100);
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  }
  if (process.env.DAO_SCENARIO === 'segments') {
    // Deux segments, puis le tracé élastique calé, un repérage (Ctrl) et une mesure (clic droit).
    const clic = async (x: number, y: number, button: 'left' | 'right' = 'left', modifiers: Electron.InputEvent['modifiers'] = []) => {
      wc.sendInputEvent({ type: 'mouseMove', x, y });
      await attendre(60);
      wc.sendInputEvent({ type: 'mouseDown', x, y, button, clickCount: 1, modifiers });
      await attendre(30);
      wc.sendInputEvent({ type: 'mouseUp', x, y, button, clickCount: 1, modifiers });
      await attendre(60);
    };
    await clic(400, 300);
    await clic(700, 300);
    await clic(700, 560);
    wc.sendInputEvent({ type: 'mouseMove', x: 905, y: 470 });
    await attendre(100);
    if (process.env.DAO_SCENARIO_FIN === 'construction') {
      const choisir = (code: string) => wc.executeJavaScript(`window.daoCapture.choisir('${code}')`);
      const touche = async (k: string) => {
        wc.sendInputEvent({ type: 'keyDown', keyCode: k });
        if (k.length === 1) wc.sendInputEvent({ type: 'char', keyCode: k });
        wc.sendInputEvent({ type: 'keyUp', keyCode: k });
        await attendre(25);
      };
      const taper = async (texte: string) => {
        for (const k of texte) await touche(k);
        await touche('Enter');
      };
      const lire = () => wc.executeJavaScript("document.getElementById('ligne-dialogue').textContent");
      await touche('Escape');
      await touche('Escape');
      await clic(600, 150);
      await clic(900, 150);
      await clic(900, 400);
      await touche('Escape');
      await touche('Escape');
      await choisir('D11');
      await taper('15');
      await clic(450, 150);
      await clic(500, 350);
      console.log('raccordement :', await lire());
      await choisir('D10');
      await clic(850, 150);
      await clic(900, 350);
      await taper('10');
      await taper('');
      console.log('chanfrein :', await lire());
      await choisir('B9');
      await clic(200, 470);
      await clic(500, 470);
      await clic(350, 430);
      await choisir('D4');
      await clic(300, 600);
      await taper('40');
      await choisir('B14');
      await clic(374, 600);
      await clic(420, 540);
      await choisir('B5');
      await clic(600, 600);
      await taper('Arbre de transmission');
      await choisir('F5');
      await clic(374, 600);
      console.log('examen :', await lire());
      wc.sendInputEvent({ type: 'mouseMove', x: 1100, y: 500 });
      await attendre(80);
    }
    if (process.env.DAO_SCENARIO_FIN === 'formes') {
      // Toutes les formes de l'étape 3a, choisies directement par leur case.
      const choisir = (code: string) => wc.executeJavaScript(`window.daoCapture.choisir('${code}')`);
      const taper = async (texte: string) => {
        for (const k of [...texte, 'Enter']) {
          wc.sendInputEvent({ type: 'keyDown', keyCode: k });
          if (k.length === 1) wc.sendInputEvent({ type: 'char', keyCode: k });
          wc.sendInputEvent({ type: 'keyUp', keyCode: k });
          await attendre(30);
        }
      };
      const lire = () => wc.executeJavaScript("document.getElementById('ligne-dialogue').textContent");
      wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      await attendre(30);
      await choisir('C10');
      await clic(150, 120);
      await clic(330, 250);
      await choisir('C11');
      console.log('C11 :', await lire());
      await taper('8');
      await clic(380, 120);
      await clic(560, 250);
      await choisir('C14');
      console.log('C14 :', await lire());
      await taper('');
      await clic(700, 190);
      await clic(700, 130);
      await choisir('D5');
      await clic(900, 190);
      await clic(960, 190);
      await choisir('D4');
      await clic(1100, 190);
      console.log('D4 :', await lire());
      await taper('40');
      await choisir('D9');
      await clic(150, 400);
      await clic(240, 330);
      await clic(330, 400);
      await choisir('D7');
      await clic(480, 400);
      await clic(420, 400);
      console.log('D7 :', await lire());
      await taper('180');
      await choisir('D8');
      await clic(650, 420);
      await clic(720, 420);
      await clic(650, 350);
      await choisir('C12');
      await clic(850, 380);
      await clic(1000, 380);
      await clic(925, 340);
      await choisir('C13');
      await taper('15');
      await clic(150, 560);
      await clic(350, 560);
      await choisir('D3');
      await clic(500, 620);
      await clic(560, 590);
      await choisir('D2');
      await clic(700, 600);
      await clic(800, 560);
      await choisir('F12');
      await choisir('D1');
      await clic(900, 560);
      await clic(1100, 560);
      wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      await attendre(30);
      await choisir('F14');
      await clic(900, 620);
      await clic(1100, 620);
      wc.sendInputEvent({ type: 'mouseMove', x: 1150, y: 500 });
      await attendre(80);
      console.log('fin :', await lire());
    }
    if (process.env.DAO_SCENARIO_FIN === 'saisie') {
      // Point au clavier : X=40, Y=-30 par rapport à l'origine de mesure, puis deux crans de molette.
      for (const k of ['4', '0', 'Enter', '-', '3', '0']) {
        wc.sendInputEvent({ type: 'keyDown', keyCode: k });
        if (k.length === 1) wc.sendInputEvent({ type: 'char', keyCode: k });
        wc.sendInputEvent({ type: 'keyUp', keyCode: k });
        await attendre(40);
      }
      const ligneAvant = await wc.executeJavaScript("document.getElementById('ligne-dialogue').textContent");
      wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
      await attendre(100);
      wc.sendInputEvent({ type: 'mouseMove', x: 905, y: 470 });
      await attendre(60);
      for (let i = 0; i < 2; i++) {
        wc.sendInputEvent({ type: 'mouseWheel', x: 905, y: 470, deltaX: 0, deltaY: 120, wheelTicksY: 1, canScroll: true });
        await attendre(150);
      }
      console.log('ligne de dialogue pendant la saisie :', ligneAvant);
    }
    if (process.env.DAO_SCENARIO_FIN === 'bascules') {
      const lire = (id: string) => wc.executeJavaScript(`document.getElementById('${id}').textContent`);
      await clic(905, 470, 'left', ['shift']);
      console.log('Maj + clic gauche :', await lire('ligne-dialogue'));
      await clic(905, 470, 'left', ['shift']);
      console.log('Maj + clic gauche (2e) :', await lire('ligne-dialogue'));
      await clic(905, 470, 'right', ['shift']);
      console.log('Maj + clic droit :', await lire('ligne-dialogue'), '|', await lire('tableau-de-bord'));
      wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      wc.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      await attendre(60);
      console.log('Échap :', await lire('ligne-dialogue'));
      wc.sendInputEvent({ type: 'mouseDown', x: 300, y: 200, button: 'left', clickCount: 1, modifiers: ['alt'] });
      for (let x = 300; x <= 500; x += 50) {
        wc.sendInputEvent({ type: 'mouseMove', x, y: 200, modifiers: ['alt', 'leftbuttondown'] });
        await attendre(30);
      }
      wc.sendInputEvent({ type: 'mouseUp', x: 500, y: 200, button: 'left', clickCount: 1, modifiers: ['alt'] });
      await attendre(60);
    }
    if (process.env.DAO_SCENARIO_FIN === 'reperage') {
      wc.sendInputEvent({ type: 'mouseMove', x: 703, y: 433 });
      await attendre(60);
      wc.sendInputEvent({ type: 'keyDown', keyCode: 'Control' });
      await attendre(400);
      wc.sendInputEvent({ type: 'keyUp', keyCode: 'Control' });
    }
  }
  // DAO_SOURIS=x,y : position finale de la souris.
  if (process.env.DAO_SOURIS) {
    const [x, y] = process.env.DAO_SOURIS.split(',').map(Number);
    wc.sendInputEvent({ type: 'mouseMove', x, y });
    await attendre(100);
  }
  // DAO_JS : script exécuté dans l'interface (window.daoCapture donne accès au poste) ; son résultat,
  // converti en JSON, est écrit dans DAO_JS_SORTIE.
  if (process.env.DAO_JS) {
    const r = await wc.executeJavaScript(`(async () => { ${process.env.DAO_JS} })()`).catch((e: Error) => ({ erreur: String(e) }));
    if (process.env.DAO_JS_SORTIE) writeFileSync(process.env.DAO_JS_SORTIE, JSON.stringify(r, null, 1));
  }
  await attendre(500);
  const image = await wc.capturePage();
  writeFileSync(fichier, image.toPNG());
  win.destroy(); // sans repasser par « Voulez-vous enregistrer ? »
  app.quit();
}

