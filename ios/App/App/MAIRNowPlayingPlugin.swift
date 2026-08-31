import Capacitor
import MediaPlayer
import UIKit

@objc(MAIRNowPlayingPlugin)
final class MAIRNowPlayingPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "MAIRNowPlayingPlugin"
    let jsName = "MAIRNowPlaying"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private let center = MPNowPlayingInfoCenter.default()
    private let commands = MPRemoteCommandCenter.shared()
    private var artworkURL = ""
    private var commandTargets: [(MPRemoteCommand, Any)] = []

    override func load() {
        super.load()
        installRemoteCommands()
    }

    deinit {
        commandTargets.forEach { command, token in command.removeTarget(token) }
    }

    @objc func update(_ call: CAPPluginCall) {
        let title = call.getString("title", "MAIR")
        let artist = call.getString("artist", "MAIR")
        let album = call.getString("album", "MAIR")
        let duration = max(0, call.getDouble("duration") ?? 0)
        let elapsed = min(max(0, call.getDouble("elapsed") ?? 0), duration > 0 ? duration : .greatestFiniteMagnitude)
        let isPlaying = call.getBool("isPlaying", false)
        let nextArtworkURL = call.getString("artwork", "")

        var info = center.nowPlayingInfo ?? [:]
        info[MPMediaItemPropertyTitle] = title
        info[MPMediaItemPropertyArtist] = artist
        info[MPMediaItemPropertyAlbumTitle] = album
        if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = elapsed
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        center.nowPlayingInfo = info
        center.playbackState = isPlaying ? .playing : .paused

        if nextArtworkURL != artworkURL {
            artworkURL = nextArtworkURL
            if nextArtworkURL.isEmpty {
                info.removeValue(forKey: MPMediaItemPropertyArtwork)
                center.nowPlayingInfo = info
            } else {
                loadArtwork(nextArtworkURL)
            }
        }
        call.resolve(["updated": true])
    }

    @objc func clear(_ call: CAPPluginCall) {
        artworkURL = ""
        center.nowPlayingInfo = nil
        center.playbackState = .stopped
        call.resolve()
    }

    private func installRemoteCommands() {
        commands.playCommand.isEnabled = true
        commands.pauseCommand.isEnabled = true
        commands.nextTrackCommand.isEnabled = true
        commands.previousTrackCommand.isEnabled = true
        commands.changePlaybackPositionCommand.isEnabled = false
        commands.skipForwardCommand.isEnabled = false
        commands.skipBackwardCommand.isEnabled = false

        commandTargets = [
            (commands.playCommand, commands.playCommand.addTarget { [weak self] _ in self?.emit("play") ?? .commandFailed }),
            (commands.pauseCommand, commands.pauseCommand.addTarget { [weak self] _ in self?.emit("pause") ?? .commandFailed }),
            (commands.nextTrackCommand, commands.nextTrackCommand.addTarget { [weak self] _ in self?.emit("next") ?? .commandFailed }),
            (commands.previousTrackCommand, commands.previousTrackCommand.addTarget { [weak self] _ in self?.emit("previous") ?? .commandFailed })
        ]
    }

    private func emit(_ command: String) -> MPRemoteCommandHandlerStatus {
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("remoteCommand", data: ["command": command])
        }
        return .success
    }

    private func loadArtwork(_ source: String) {
        guard let url = URL(string: source), ["https", "http"].contains(url.scheme?.lowercased() ?? "") else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, self.artworkURL == source, let data, let image = UIImage(data: data) else { return }
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            DispatchQueue.main.async { [weak self] in
                guard let self, self.artworkURL == source else { return }
                var info = self.center.nowPlayingInfo ?? [:]
                info[MPMediaItemPropertyArtwork] = artwork
                self.center.nowPlayingInfo = info
            }
        }.resume()
    }
}

final class MAIRBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MAIRNowPlayingPlugin())
    }
}
