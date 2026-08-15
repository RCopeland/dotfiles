# User binaries (npm global prefix, etc.)
export PATH="$HOME/.local/bin:$PATH"

# Local copy of the CachyOS zsh config with Powerlevel10k removed
# (keeping oh-my-zsh, aliases, syntax highlighting, autosuggestions, fzf, pkgfile handler).
# Recreate from /usr/share/cachyos-zsh-config/cachyos-config.zsh if the package updates.
source ~/.config/zsh/cachyos-config.zsh

# Starship prompt
eval "$(starship init zsh)"
