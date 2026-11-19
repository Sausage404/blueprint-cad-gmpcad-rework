// Moteur commun aux deux extensions : le lecteur DXF / .des du logiciel (apercu.js), exécuté par
// JavaScriptCore. Rien n'est envoyé ailleurs : tout se passe sur le Mac, dans l'extension.
import Foundation
import JavaScriptCore

enum ErreurApercu: Error {
    case moteur
    case lecture(String)
}

enum Moteur {
    /// Appelle `fonction(contenu, des)` du script et renvoie son résultat (JSON) sous forme de dictionnaire.
    static func appeler(_ fonction: String, fichier: URL) throws -> [String: Any] {
        guard let url = Bundle.main.url(forResource: "apercu", withExtension: "js"),
              let code = try? String(contentsOf: url, encoding: .utf8),
              let ctx = JSContext() else { throw ErreurApercu.moteur }
        var exception: String?
        ctx.exceptionHandler = { _, e in exception = e?.toString() }
        ctx.evaluateScript(code)
        if let exception { throw ErreurApercu.lecture(exception) }
        let octets = try Data(contentsOf: fichier)
        // Un caractère par octet (Latin-1) : le script décode lui-même (DXF, ou .des binaire).
        let contenu = String(data: octets, encoding: .isoLatin1) ?? ""
        let des = fichier.pathExtension.lowercased() == "des"
        guard let f = ctx.objectForKeyedSubscript(fonction),
              let r = f.call(withArguments: [contenu, des]), let json = r.toString(),
              let donnees = json.data(using: .utf8),
              let objet = try JSONSerialization.jsonObject(with: donnees) as? [String: Any] else {
            throw ErreurApercu.lecture(exception ?? "réponse illisible")
        }
        if let erreur = objet["erreur"] as? String { throw ErreurApercu.lecture(erreur) }
        return objet
    }
}
