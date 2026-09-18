import UIKit
import Capacitor
import AppTrackingTransparency

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /// Schluessel, ueber den src/ads/admob.ts die Tracking-Abfrage anstoesst.
    /// @capacitor/preferences schreibt auf iOS in UserDefaults.standard, mit
    /// dem Gruppennamen als Praefix (Preferences.swift im Plugin):
    /// "CapacitorStorage." + Schluessel. Aendert sich der Schluessel in
    /// admob.ts (`ATT_ANFRAGE_KEY`), muss er hier mitziehen.
    private let attAnfrageSchluessel = "CapacitorStorage.att.anfrage"

    /// Merker, damit zwei Ausloeser kurz hintereinander nicht zwei Dialoge
    /// anfordern. Wird in der Rueckmeldung wieder geloescht.
    private var trackingAbfrageLaeuft = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Sobald admob.ts den Schluessel setzt, meldet UserDefaults die
        // Aenderung — auf dem Thread des Schreibers, deshalb unten der Sprung
        // auf den Hauptthread.
        NotificationCenter.default.addObserver(self, selector: #selector(userDefaultsGeaendert),
                                               name: UserDefaults.didChangeNotification, object: nil)
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Rueckfallweg: Kam die Anfrage, waehrend die App nicht aktiv war,
        // holt der naechste Vordergrund-Wechsel sie nach.
        pruefeTrackingAnfrage()
    }

    // MARK: - App Tracking Transparency
    //
    //  Der ATT-Dialog wird NATIV angefordert, nicht mehr ueber das AdMob-Plugin.
    //  `AdMob.requestTrackingAuthorization()` ruft `ATTrackingManager` direkt in
    //  der Plugin-Methode auf, und Capacitor fuehrt Plugin-Aufrufe auf einer
    //  eigenen Hintergrund-Warteschlange aus — ein UIKit-Dialog gehoert auf den
    //  Hauptthread. Apple hat genau das bei Anigosha am 12.08.2026 beanstandet
    //  (Richtlinie 2.1: Dialog nicht auffindbar). Ohne erteiltes ATT gibt es
    //  keine IDFA, und jede iOS-Anzeige ist nicht-personalisiert — das ist der
    //  Unterschied zwischen 3 € und 6 bis 8 € eCPM je Interstitial.
    //
    //  Der ZEITPUNKT bleibt, wie in 1.1.2 entschieden: nicht beim ersten Start
    //  (dort standen schon zwei Systemdialoge), sondern unmittelbar vor der
    //  ersten Anzeige. Deshalb kein fester Aufruf in didBecomeActive, sondern
    //  ein Ausloeser: admob.ts setzt ueber @capacitor/preferences den Schluessel
    //  `att.anfrage`, UserDefaults meldet die Aenderung, und hier wird auf dem
    //  Hauptthread gefragt. admob.ts wartet danach auf die Antwort, bevor es
    //  die Anzeige laedt.
    @objc private func userDefaultsGeaendert() {
        DispatchQueue.main.async { [weak self] in self?.pruefeTrackingAnfrage() }
    }

    private func pruefeTrackingAnfrage() {
        let defaults = UserDefaults.standard
        guard defaults.string(forKey: attAnfrageSchluessel) == "1" else { return }
        // Nicht aktiv (z. B. Anfrage kam waehrend eines Wechsels): Schluessel
        // stehen lassen, didBecomeActive kommt noch einmal vorbei.
        guard UIApplication.shared.applicationState == .active else { return }
        // Vor dem Fragen entfernen — das loest erneut didChangeNotification
        // aus, aber ohne Schluessel endet der Durchlauf oben sofort.
        defaults.removeObject(forKey: attAnfrageSchluessel)
        frageNachTracking()
    }

    private func frageNachTracking() {
        guard !trackingAbfrageLaeuft else { return }
        // Schon beantwortet (auch „abgelehnt") — iOS zeigt den Dialog dann
        // ohnehin kein zweites Mal, die Antwort aendert man in den Einstellungen.
        guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else { return }
        trackingAbfrageLaeuft = true
        ATTrackingManager.requestTrackingAuthorization { [weak self] _ in
            self?.trackingAbfrageLaeuft = false
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
