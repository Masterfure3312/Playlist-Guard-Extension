# Playlist Guard

**Playlist Guard remembers what YouTube forgets.**

Playlist Guard is a privacy-friendly browser extension that tracks your YouTube playlists and helps you remember which videos disappeared, returned, or were added.

It is designed for users who want a simple way to preserve playlist history without relying on an external account or server.


<img width="1254" height="1254" alt="Logo_PG_Alpha" src="https://github.com/user-attachments/assets/f40257f8-7198-44b2-83ad-68ab8e4d8f9a" />


---

## Features

- Track YouTube playlists manually selected by the user
- Detect videos that disappear from a playlist
- Detect videos that return later
- Detect newly added videos
- Keep a local history of playlist changes
- Independent automatic check intervals per playlist
- Manual refresh without changing the automatic schedule
- Show the current number of missing videos
- Search missing videos on YouTube or Google
- Import and export local backups
- Multiple UI themes
- English and Spanish interface
- Playlist cover thumbnails
- Local-first and privacy-friendly

---

## Supported browsers

Playlist Guard is designed for Chromium-based browsers.

Tested primarily on:

- Brave
- Google Chrome

Other Chromium-based browsers may also work.

---

## Installation

### Manual installation

Until Playlist Guard is published on the Chrome Web Store, you can install it manually.

1. Download or clone this repository.
2. Open your browser's extensions page.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension` folder.

For Brave: 

```text
brave://extensions
```
For Chrome:
```
chrome://extensions
```

How it works

Playlist Guard does not automatically track every playlist you visit.

You choose which playlists you want to protect.

For each protected playlist, Playlist Guard stores a local snapshot of its videos and compares it with future checks.

If a video disappears, Playlist Guard keeps the information it previously stored so you can identify what was removed.

If the video later returns, Playlist Guard records that change as well.

Privacy

Playlist Guard is designed to work locally.

No Playlist Guard account is required
No analytics service is included
No advertising system is included
Playlist data is stored locally in your browser
Data is not sent to a Playlist Guard server

Playlist Guard communicates with YouTube only when necessary to read playlist information.

A complete Privacy Policy will be published before the public Chrome Web Store release.

What Playlist Guard does not do

Playlist Guard is not a video downloader.

It does not download or archive video files.

Its purpose is to preserve playlist metadata and change history so users can identify videos that disappear from their playlists.

Current status

Version: 0.9 Beta

The extension is currently in public development and testing.

The next major milestone is:

Playlist Guard 1.0

Planned for the first public Chrome Web Store release.

Screenshots

Screenshots will be added before the public 1.0 release.

Project structure

playlist-guard/
├── extension/
│   ├── icons/
│   ├── background.js
│   ├── manifest.json
│   ├── options.html
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
│
└── README.md

Feedback

Bug reports and suggestions are welcome through GitHub Issues.

If you encounter a playlist that behaves incorrectly, please include:

browser used
playlist size
whether the check was manual or automatic
what Playlist Guard reported
what you expected to happen

Please do not include private account information.

License

License information will be added before the public 1.0 release.

Disclaimer

Playlist Guard is an independent project and is not affiliated with, endorsed by, or sponsored by YouTube or Google.

YouTube is a trademark of Google LLC.
