// Vignette d'un dessin DXF ou .des dans le Finder (icônes, présentation en galerie) : la feuille blanche
// et ses traits, les traits forts plus épais.
import AppKit
import QuickLookThumbnailing

@objc(ThumbnailProvider)
class ThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(for request: QLFileThumbnailRequest, _ handler: @escaping (QLThumbnailReply?, Error?) -> Void) {
        let r: [String: Any]
        do {
            r = try Moteur.appeler("apercuTraits", fichier: request.fileURL)
        } catch {
            handler(nil, error)
            return
        }
        let l = r["largeur"] as? Double ?? 297
        let h = r["hauteur"] as? Double ?? 210
        let forts = (r["forts"] as? [NSNumber] ?? []).map { CGFloat($0.doubleValue) }
        let fins = (r["fins"] as? [NSNumber] ?? []).map { CGFloat($0.doubleValue) }
        let max = request.maximumSize
        let k = min(max.width / CGFloat(l), max.height / CGFloat(h))
        let taille = CGSize(width: CGFloat(l) * k, height: CGFloat(h) * k)
        handler(QLThumbnailReply(contextSize: taille, currentContextDrawing: { () -> Bool in
            guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
            ctx.setFillColor(NSColor.white.cgColor)
            ctx.fill(CGRect(origin: .zero, size: taille))
            ctx.clip(to: CGRect(origin: .zero, size: taille))
            ctx.setLineCap(.round)
            // Le dessin a l'axe Y vers le haut, comme ce contexte : simple mise à l'échelle.
            for (liste, epaisseur, gris) in [(fins, 0.25, 0.35), (forts, 0.5, 0.0)] {
                ctx.setStrokeColor(NSColor(white: CGFloat(gris), alpha: 1).cgColor)
                ctx.setLineWidth(Swift.max(0.6, CGFloat(epaisseur) * k))
                ctx.beginPath()
                var i = 0
                while i + 3 < liste.count {
                    ctx.move(to: CGPoint(x: liste[i] * k, y: liste[i + 1] * k))
                    ctx.addLine(to: CGPoint(x: liste[i + 2] * k, y: liste[i + 3] * k))
                    i += 4
                }
                ctx.strokePath()
            }
            return true
        }), nil)
    }
}
