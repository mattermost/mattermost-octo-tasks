// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Cocoa
import WebKit

class ViewController:
	NSViewController,
	WKUIDelegate,
	WKNavigationDelegate,
	WKScriptMessageHandler {
	@IBOutlet var webView: WKWebView!
	private var didLoad = false
	private var refreshWebViewOnLoad = true

	override func viewDidLoad() {
		super.viewDidLoad()

		NSLog("viewDidLoad")

		webView.navigationDelegate = self
		webView.uiDelegate = self
		webView.isHidden = true
		webView.configuration.userContentController.add(self, name: "nativeApp")

		clearWebViewCache()

		// Load the home page if the server was started, otherwise wait until it has
		let appDelegate = NSApplication.shared.delegate as! AppDelegate
		if (appDelegate.isServerStarted) {
			updateSessionTokenAndUserSettings()
			loadHomepage()
		}

		// Do any additional setup after loading the view.
		NotificationCenter.default.addObserver(self, selector: #selector(onServerStarted), name: AppDelegate.serverStartedNotification, object: nil)
	}

	override func viewDidAppear() {
		super.viewDidAppear()
		self.view.window?.makeFirstResponder(self.webView)
	}

	override var representedObject: Any? {
		didSet {
			// Update the view, if already loaded.
		}
	}

	private func clearWebViewCache() {
		let websiteDataTypes = NSSet(array: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache])
		let date = Date(timeIntervalSince1970: 0)
		WKWebsiteDataStore.default().removeData(ofTypes: websiteDataTypes as! Set<String>, modifiedSince: date, completionHandler:{ })
	}

	@IBAction func showDiagnosticsInfo(_ sender: NSObject) {
		let appDelegate = NSApplication.shared.delegate as! AppDelegate

		let alert: NSAlert = NSAlert()
		alert.messageText = "Diagnostics info"
		alert.informativeText = "Port: \(appDelegate.serverPort)"
		alert.alertStyle = .informational
		alert.addButton(withTitle: "OK")
		alert.runModal()
	}

	@objc func onServerStarted() {
		NSLog("onServerStarted")
		DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
			self.updateSessionTokenAndUserSettings()
			self.loadHomepage()
		}
	}

	private func updateSessionTokenAndUserSettings() {
		let appDelegate = NSApplication.shared.delegate as! AppDelegate
		let sessionTokenScript = WKUserScript(
			source: "localStorage.setItem('focalboardSessionId', '\(appDelegate.sessionToken)');",
			injectionTime: .atDocumentStart,
			forMainFrameOnly: true
		)
		let blob = UserDefaults.standard.string(forKey: "localStorage") ?? ""
		let userSettingsScript = WKUserScript(
			source: "const NativeApp = { settingsBlob: \"\(blob)\" };",
			injectionTime: .atDocumentStart,
			forMainFrameOnly: true
		)
		webView.configuration.userContentController.removeAllUserScripts()
		webView.configuration.userContentController.addUserScript(sessionTokenScript)
		webView.configuration.userContentController.addUserScript(userSettingsScript)
	}

	private func loadHomepage() {
		NSLog("loadHomepage")
		let appDelegate = NSApplication.shared.delegate as! AppDelegate
		let port = appDelegate.serverPort
		let url = URL(string: "http://localhost:\(port)/")!
		let request = URLRequest(url: url)
		refreshWebViewOnLoad = true
		webView.load(request)
	}

	private func downloadJsonUrl(_ url: URL) {
		NSLog("downloadJsonUrl")
		let prefix = "data:text/json,"
		let urlString = url.absoluteString
		let encodedJson = String(urlString[urlString.index(urlString.startIndex, offsetBy: prefix.lengthOfBytes(using: .utf8))...])
		guard let json = encodedJson.removingPercentEncoding else {
			return
		}

		// Form file name
		let dateFormatter = DateFormatter()
		dateFormatter.dateFormat = "yyyy-M-d"
		let dateString = dateFormatter.string(from: Date())
		let filename = "archive-\(dateString).focalboard"

		// Save file
		let savePanel = NSSavePanel()
		savePanel.canCreateDirectories = true
		savePanel.nameFieldStringValue = filename
		// BUGBUG: Specifying the allowedFileTypes causes Catalina to hang / error out
		//savePanel.allowedFileTypes = [".focalboard"]
		savePanel.begin { (result) in
			if result.rawValue == NSApplication.ModalResponse.OK.rawValue,
			   let fileUrl = savePanel.url {
				try? json.write(to: fileUrl, atomically: true, encoding: .utf8)
			}
		}
	}

	private func downloadCsvUrl(_ url: URL) {
		NSLog("downloadCsvUrl")
		let prefix = "data:text/csv;charset=utf-8,"
		let urlString = url.absoluteString
		let encodedContents = String(urlString[urlString.index(urlString.startIndex, offsetBy: prefix.lengthOfBytes(using: .utf8))...])
		guard let contents = encodedContents.removingPercentEncoding else {
			return
		}

		let filename = "data.csv"

		// Save file
		let savePanel = NSSavePanel()
		savePanel.canCreateDirectories = true
		savePanel.nameFieldStringValue = filename
		// BUGBUG: Specifying the allowedFileTypes causes Catalina to hang / error out
		//savePanel.allowedFileTypes = [".focalboard"]
		savePanel.begin { (result) in
			if result.rawValue == NSApplication.ModalResponse.OK.rawValue,
			   let fileUrl = savePanel.url {
				try? contents.write(to: fileUrl, atomically: true, encoding: .utf8)
			}
		}
	}

	func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
		NSLog("webView runOpenPanel")
		let openPanel = NSOpenPanel()
		openPanel.canChooseFiles = true
		openPanel.begin { (result) in
			if result == NSApplication.ModalResponse.OK {
				if let url = openPanel.url {
					completionHandler([url])
				}
			} else if result == NSApplication.ModalResponse.cancel {
				completionHandler(nil)
			}
		}
	}

	func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
		if let url = navigationAction.request.url {
			// Intercept archive downloads, and present native UI
			if (url.absoluteString.hasPrefix("data:text/json,")) {
				decisionHandler(.cancel)
				downloadJsonUrl(url)
				return
			}
			if (url.absoluteString.hasPrefix("data:text/csv;charset=utf-8,")) {
				decisionHandler(.cancel)
				downloadCsvUrl(url)
				return
			}
			NSLog("decidePolicyFor navigationAction: \(url.absoluteString)")
		}
		decisionHandler(.allow)
	}

	func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
		NSLog("webView didFinish navigation: \(webView.url?.absoluteString ?? "")")
		// Disable right-click menu
		webView.evaluateJavaScript("document.body.setAttribute('oncontextmenu', 'event.preventDefault();');", completionHandler: nil)
		webView.isHidden = false
		didLoad = true

		// HACKHACK: Fix WebView initial rendering artifacts
		if (refreshWebViewOnLoad) {
			refreshWebViewOnLoad = false
			DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: {
				self.refreshWebView()
			})
		}
	}

	// HACKHACK: Fix WebView initial rendering artifacts
	private func refreshWebView() {
		let frame = self.webView.frame
		var frame2 = frame
		frame2.size.height += 1
		self.webView.frame = frame2
		self.webView.frame = frame
	}

	func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
		NSLog("webView didFailProvisionalNavigation, error: \(error.localizedDescription)")
		if (!didLoad) {
			DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
				self.updateSessionTokenAndUserSettings()
				self.loadHomepage()
			}
		}
	}

	func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
		webView.isHidden = false
	}

	func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
		if let frame = navigationAction.targetFrame,
			frame.isMainFrame {
			return nil
		}
		// for _blank target or non-mainFrame target, open in default browser
		if let url = navigationAction.request.url {
			NSWorkspace.shared.open(url)
		}
		return nil
	}

	@IBAction func navigateToHome(_ sender: NSObject) {
		loadHomepage()
	}

	func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
		guard
			let body = message.body as? [AnyHashable: Any],
			let type = body["type"] as? String,
			let blob = body["settingsBlob"] as? String
		else {
			NSLog("Received unexpected script message \(message.body)")
			return
		}
		NSLog("Received script message \(type)")
		switch type {
		case "didImportUserSettings":
			NSLog("Imported user settings keys \(body["keys"] ?? "?")")
		case "didNotImportUserSettings":
			break
		case "didChangeUserSettings":
			UserDefaults.standard.set(blob, forKey: "localStorage")
			NSLog("Persisted user settings after change for key \(body["key"] ?? "?")")
		default:
			NSLog("Received script message of unknown type \(type)")
		}
		if let settings = Data(base64Encoded: blob).flatMap({ try? JSONSerialization.jsonObject(with: $0, options: []) }) {
			NSLog("Current user settings: \(settings)")
		}
	}
}

