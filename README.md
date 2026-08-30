# dotfiles

Personal dotfiles managed with [yadm](https://yadm.io), combining a shared core for macOS and Linux with KDE-focused Linux extras.

## Included

- `~/.config/nvim/` — Neovim / LazyVim config
- `~/.config/alacritty/`, `~/.config/ghostty/`, `~/.config/starship.toml`
- `~/.config/herdr/` — Herdr config
- `~/.config/yadm/` — bootstrap, package manifests, KDE snippets
- `~/.local/share/kwin/scripts/toggleterminal/` — KWin toggle-terminal script
- `~/.pi/agent/` — Pi settings, MCP config, extensions, themes, selected skills
- `~/.zshrc` and `~/.config/zsh/cachyos-config.zsh`

## Bootstrap

After cloning with `yadm`, run:

```bash
yadm bootstrap
```

Supported phases:

- `packages` — Linux uses `pacman` + AUR, macOS uses `brew bundle`
- `tools` — installs Pi everywhere and Linux-only user-local helpers like Herdr + Neovim tarball
- `kde` — applies KDE config overlays on Linux only

Skip phases with:

```bash
yadm bootstrap --no-packages --no-tools --no-kde
```

## Platform notes

### macOS

- uses `.config/yadm/Brewfile`
- bootstrap installs Homebrew automatically if needed
- includes core terminal/dev packages such as `git`, `yadm`, `neovim`, `node`, `ripgrep`, `fzf`, and `starship`
- keeps terminal configs like Ghostty and iTerm2 available

### Linux / CachyOS

- uses `.config/yadm/packages` and `.config/yadm/packages-aur`
- bootstrap can install packages, Pi, Herdr, and a user-local Neovim tarball
- KDE config snippets and the toggle-terminal script are Linux-only

## Notes

- Keep secrets and machine-local runtime state out of the repo.
- Pi runtime files are ignored via `.pi/.gitignore` and `.config/yadm/gitignore`.
- This repo intentionally keeps the local Neovim config instead of the upstream `.config/nvim` git submodule.
