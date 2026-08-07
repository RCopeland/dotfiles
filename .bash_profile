
# sse configuration
if [ -f ~/.sserc_bash ]; then
    source ~/.sserc_bash
fi

alias pi="pi update && pi update --extensions && pi"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

export NODE_USE_ENV_PROXY=1
