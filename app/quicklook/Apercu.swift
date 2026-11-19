// Aperçu « Coup d'œil » (barre d'espace dans le Finder) d'un dessin DXF ou .des : la feuille en SVG,
// traits noirs sur papier blanc, comme à l'impression.
import Cocoa
import QuickLookUI
import UniformTypeIdentifiers

@objc(PreviewProvider)
class PreviewProvider: QLPreviewProvider, QLPreviewingController {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let r = try Moteur.appeler("apercuSvg", fichier: request.fileURL)
        let svg = r["svg"] as? String ?? ""
        let l = r["largeur"] as? Double ?? 297
        let h = r["hauteur"] as? Double ?? 210
        let largeur = 1000.0
        let taille = CGSize(width: largeur, height: (largeur * h / l).rounded() + 40)
        let html = """
        <!doctype html><html><head><meta charset="utf-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">
        <style>
        html, body { margin: 0; height: 100%; background: #5f6368; }
        body { display: flex; align-items: center; justify-content: center; }
        .papier { width: calc(100% - 40px); aspect-ratio: \(l) / \(h); max-height: calc(100% - 40px); background: #fff;
                  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.5); }
        .papier svg { display: block; width: 100%; height: 100%; }
        </style></head><body><div class="papier">\(svg)</div></body></html>
        """
        let reponse = QLPreviewReply(dataOfContentType: .html, contentSize: taille) { r in
            r.stringEncoding = .utf8
            return Data(html.utf8)
        }
        reponse.title = request.fileURL.lastPathComponent
        return reponse
    }
}
