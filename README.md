# LabAssistant 🧪🚀

Embedded test automation and control App for the distinguished developer.

![LabAssistant Dashboard](https://github.com/Grippy98/LabAssistant/raw/main/screenshot.png)

## Features
- **JetKVM Integration**: Control ATX power and see video feed directly.
- **Home Assistant Control**: Toggle smart plugs/switches for your boards.
- **SD Mux Switching**: Physically switch SD cards between PC and Target.
- **Image Flasher**: Flash `.img`, `.xz`, `.balena-etcher` images to SD cards/EMMC.
- **Serial Monitor**: Integrated terminal for hardware debugging.
- **Multi-Arch**: Supports Linux (x86/arm64), Windows, and macOS.

## Installation (Release V2026.03.19)
Download the latest artifacts from the [Releases](https://github.com/Grippy98/LabAssistant/releases) page.
- **Linux**: `AppImage` (x64/arm64) or `.deb`.
- **Windows**: `NSIS` installer.
- **macOS**: `DMG`.

## Development Setup

### Prerequisites
- Node.js (v20+)
- Python 3.10+
- `pip`, `venv`

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Electron Desktop
```bash
npm install
npm run dev
```

## Automated Releases
This repository is configured with **GitHub Actions** to automatically build and release LabAssistant for Linux, Windows, and macOS.

To trigger a new release:
1. Update the version in `package.json`.
2. Commit and push the changes.
3. Push a new tag:
   ```bash
   git tag v2026.3.20
   git push origin v2026.3.20
   ```
GitHub will automatically build the installers and attach them to a new Release draft.

## Building Locally
To generate cross-platform packages:
```bash
# Build backend executable
npm run build:backend

# Package application
npm run package
```

License: MIT
Author: Grippy98
