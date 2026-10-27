import CarPlay
import UIKit

/// The CarPlay UI: a list of hadiths and the system Now Playing screen. Named
/// for Objective-C so the Info.plist scene manifest can reference it.
@objc(MajlisCarPlaySceneDelegate)
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?
  private var listTemplate: CPListTemplate?
  private var libraryObserver: NSObjectProtocol?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    MajlisCarPlayer.shared.reloadLibrary()

    let template = CPListTemplate(title: "مجلس", sections: [makeSection()])
    listTemplate = template
    interfaceController.setRootTemplate(template, animated: false, completion: nil)

    // The phone app rewrites the index on launch; refresh the list when it does.
    libraryObserver = NotificationCenter.default.addObserver(
      forName: MajlisCarPlayer.libraryDidChange, object: nil, queue: .main
    ) { [weak self] _ in
      guard let self else { return }
      self.listTemplate?.updateSections([self.makeSection()])
    }
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    if let libraryObserver { NotificationCenter.default.removeObserver(libraryObserver) }
    libraryObserver = nil
    listTemplate = nil
    self.interfaceController = nil
  }

  private func makeSection() -> CPListSection {
    let player = MajlisCarPlayer.shared
    guard !player.library.isEmpty else {
      // The index is written by the phone app, so it must have run once.
      return CPListSection(items: [CPListItem(text: "افتح مجلس على الهاتف مرة واحدة", detailText: nil)])
    }

    let items = player.library.map { hadith -> CPListItem in
      let item = CPListItem(text: hadith.title, detailText: hadith.artist, image: player.thumbnail)
      item.handler = { [weak self] _, completion in
        player.play(hadith)
        self?.interfaceController?.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
        completion()
      }
      return item
    }
    return CPListSection(items: items)
  }
}
