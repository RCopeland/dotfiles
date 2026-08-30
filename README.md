# dotfiles

Dotfiles managed with [yadm](https://yadm.io), primarily targeting **CachyOS / KDE Plasma 6** (with some macOS leftovers).

## Shell & Terminal

- **zsh** — `.zshrc` + a local copy of the CachyOS zsh config (oh-my-zsh, aliases, syntax highlighting, autosuggestions, fzf, pkgfile handler), with Powerlevel10k removed
- **Starship** — prompt via `.config/starship.toml`
- **Alacritty** — default terminal (`.config/alacritty/`)
- **Ghostty / iTerm2** — old configs kept around, not the active terminal

## Editors

- **Neovim** — LazyVim setup in `.config/nvim/`
- `vim` / `micro` as fallbacks (installed by bootstrap)

## AI Coding Agent (pi)

- `.pi/agent/settings.json` — theme, default provider/model/thinking level
- `.pi/agent/themes/catppuccin-mocha.json` — custom theme
- `.pi/agent/extensions/` — auto-update, herdr agent state, codex image-gen tracking

## Herdr

- `.config/herdr/config.toml` — terminal theme + onboarding settings

## KDE / Plasma

- **KWin "Toggle Terminal" script** (`.local/share/kwin/scripts/toggleterminal/`) — global shortcut to toggle Konsole
- KDE config overlays in `.config/yadm/kde/` (kwinrc.d, kglobalshortcutsrc.d), merged into `~/.config` at bootstrap
- Varies: Dolphin, Konsole, Spectacle, KDE Connect, etc. — full list in the packages file

## System Setup

- `bootstrap` — idempotent setup run after `yadm clone` (or manually via `yadm bootstrap`). Phases:
  - `packages` — pacman (+AUR) packages from the package lists
  - `tools` — user-local binaries: herdr, neovim, pi
  - `kde` — KWin script install + shortcuts
  - Skip phases with `--no-packages`, `--no-tools`, `--no-kde`
- `.config/yadm/packages` — pacman repo packages (shell, dev, system tools, GUI, KDE, fonts, media codecs)
- `.config/yadm/packages-aur` — AUR packages (google-chrome, dbus-app-launcher)