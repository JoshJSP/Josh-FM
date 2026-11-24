import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        if let url = connectionOptions.urlContexts.first?.url { openDeeplink(url, coldStart: true) }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)

        if let url = URLContexts.first?.url { openDeeplink(url, coldStart: false) }
    }

    /// mairfm://?station=<id> doet hetzelfde als https://…/?station=<id> op het web (mair-deeplink.js).
    /// Zelfde regel als in mair-deeplink.js: alleen a-z en 0-9, 2 tot 12 tekens. Daardoor kan er
    /// niets anders dan een zendernaam in de JavaScript hieronder terechtkomen.
    static func station(from url: URL) -> String? {
        guard url.scheme?.lowercased() == "mairfm",
              let id = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "station" })?.value,
              id.range(of: "^[a-z0-9]{2,12}$", options: .regularExpression) != nil
        else { return nil }
        return id
    }

    /// Koude start: de pagina meteen met ?station laden. Draait de app al: niet herladen
    /// (dan stopt de muziek), maar window.mairDeeplink aanroepen. Oude webversie zonder
    /// die functie: dan toch herladen met ?station.
    private func openDeeplink(_ url: URL, coldStart: Bool) {
        guard let id = SceneDelegate.station(from: url),
              let bridgeVC = window?.rootViewController as? CAPBridgeViewController else { return }
        bridgeVC.loadViewIfNeeded()
        guard let webView = bridgeVC.webView, let bridge = bridgeVC.bridge else { return }
        if coldStart {
            var target = URLComponents(url: bridge.config.serverURL, resolvingAgainstBaseURL: false)
            target?.queryItems = [URLQueryItem(name: "station", value: id)]
            if let target = target?.url { webView.load(URLRequest(url: target)) }
        } else {
            webView.evaluateJavaScript("window.mairDeeplink ? window.mairDeeplink('\(id)') : location.assign('/?station=\(id)')")
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
