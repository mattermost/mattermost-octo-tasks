// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;

namespace Focalboard {
	/// <summary>
	/// Interaction logic for MainWindow.xaml
	/// </summary>
	public partial class MainWindow : Window {
		private int port {
			get { return ((App)Application.Current).port; }
		}

		private string sessionToken {
			get { return ((App)Application.Current).sessionToken; }
		}

		public MainWindow() {
			Debug.WriteLine($"MainWindow()");

			InitializeComponent();

			RestoreWindowsState();

			this.Loaded += MainWindow_Loaded;
			this.Closing += MainWindow_Closing;

			InitializeWebView();
		}

		private void MainWindow_Loaded(object sender, RoutedEventArgs e) {
			Activate();
		}

		private void PromptToInstallWebview2() {
			var dialogResult = MessageBox.Show(
				"Focalboard requires the WebView2 runtime to be downloaded and installed. Install now?",
				"Focalboard",
				MessageBoxButton.YesNo,
				MessageBoxImage.Information,
				MessageBoxResult.OK,
				MessageBoxOptions.DefaultDesktopOnly);

			if (dialogResult == MessageBoxResult.Yes) {
				installingLabel.Visibility = Visibility.Visible;
				webView.Visibility = Visibility.Collapsed;

				var installer = new Webview2Installer();
				installer.InstallProgress += Installer_InstallProgress;
				installer.InstallCompleted += Installer_InstallCompleted;
				installer.DownloadAndInstall();
			}
		}

		private void Installer_InstallProgress(Webview2Installer sender, EventArgs e) {
			Application.Current.Dispatcher.Invoke(() => {
				if (sender.downloadProgress < 100) {
					installingLabel.Content = $"Downloading Webview2: {sender.downloadProgress}%";
				} else {
					installingLabel.Content = "Installing Webview2...";
				}
			});
		}

		private void Installer_InstallCompleted(Webview2Installer sender, EventArgs e) {
			Application.Current.Dispatcher.Invoke(() => {
				installingLabel.Content = "Webview2 install completed";
				Activate();

				if (sender.exitCode != 0) {
					var message = $"Webview2 install FAILED with code {sender.exitCode}. Try again.";
					MessageBox.Show(message, "Install failed");
				}

				// Reopen window
				var window = new MainWindow();
				window.Show();
				Close();
			});
		}

		private void SaveWindowState() {
			try {
				Properties.Settings.Default.WindowPosition = new System.Drawing.Point(
					Convert.ToInt32(RestoreBounds.Location.X),
					Convert.ToInt32(RestoreBounds.Location.Y));

				Properties.Settings.Default.WindowSize = new System.Drawing.Size(
					Convert.ToInt32(RestoreBounds.Size.Width),
					Convert.ToInt32(RestoreBounds.Size.Height));

				Properties.Settings.Default.WindowMaximized = (WindowState == WindowState.Maximized);
				Properties.Settings.Default.Save();
			} catch {
				// Ignore errors, e.g. overflow
			}
		}

		private void RestoreWindowsState() {
			this.Left = Properties.Settings.Default.WindowPosition.X;
			this.Top = Properties.Settings.Default.WindowPosition.Y;
			this.Width = Math.Max(300, Properties.Settings.Default.WindowSize.Width);
			this.Height = Math.Max(200, Properties.Settings.Default.WindowSize.Height);

			if (Properties.Settings.Default.WindowMaximized) {
				WindowState = WindowState.Maximized;
			}
		}

		private void MainWindow_Closing(object sender, System.ComponentModel.CancelEventArgs e) {
			SaveWindowState();
		}

		async void InitializeWebView() {
			string version = GetWebView2Version();
			var isAltKeyPressed = (Keyboard.IsKeyDown(Key.LeftAlt) || Keyboard.IsKeyDown(Key.RightAlt));
			if (version == "" || isAltKeyPressed) {
				PromptToInstallWebview2();
				return;
			}

			this.Title = $"Focalboard (port {port} WebView {version})";

			// must create a data folder if running out of a secured folder that can't write like Program Files
			var env = await CoreWebView2Environment.CreateAsync(
				userDataFolder: Path.Combine(Path.GetTempPath(), "Focalboard")
			);
			await webView.EnsureCoreWebView2Async(env);

			webView.ContentLoading += WebView_ContentLoading;

			var url = String.Format("http://localhost:{0}/", port);
			webView.Source = new Uri(url);
		}

		private static string GetWebView2Version() {
			try {
				return CoreWebView2Environment.GetAvailableBrowserVersionString();
			} catch (Exception) { return ""; }
		}

		private void WebView_ContentLoading(object sender, CoreWebView2ContentLoadingEventArgs e) {
			// Set focalboardSessionId
			var url = String.Format("http://localhost:{0}/", port);
			string script = $@"if (window.location.href.toLowerCase().startsWith('{url}'.toLowerCase())) {{
				localStorage.setItem('focalboardSessionId', '{sessionToken}');
			}}";
			webView.ExecuteScriptAsync(script);
		}
	}
}
