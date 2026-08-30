# User binaries (npm global prefix, etc.)
export PATH="$HOME/.local/bin:$PATH"

# Linux/CachyOS-specific zsh config, if present.
if [ -f "$HOME/.config/zsh/cachyos-config.zsh" ]; then
  source "$HOME/.config/zsh/cachyos-config.zsh"
fi

# Starship prompt, if installed.
if command -v starship >/dev/null 2>&1; then
  eval "$(starship init zsh)"
fi
