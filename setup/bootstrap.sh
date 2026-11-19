#!/usr/bin/env bash
# Fresh Ubuntu 24.04 -> a box coding agents can operate. Run as root, once. Read it before you run it.
#   OPERATOR=ops SSH_PUBKEY="ssh-ed25519 AAAA..." bash bootstrap.sh
set -euo pipefail

OPERATOR="${OPERATOR:-ops}"
SSH_PUBKEY="${SSH_PUBKEY:-}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SSH_PORT="${SSH_PORT:-22}"   # the port sshd ALREADY listens on; opened in the firewall, sshd is not moved

[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
[ -n "$SSH_PUBKEY" ] || [ -s /root/.ssh/authorized_keys ] || { echo "set SSH_PUBKEY, or have a key in /root/.ssh/authorized_keys"; exit 1; }
# A bad key + "no passwords, no root" = locked out. Refuse anything ssh-keygen cannot parse.
if [ -n "$SSH_PUBKEY" ]; then echo "$SSH_PUBKEY" | ssh-keygen -l -f - >/dev/null 2>&1 || { echo "SSH_PUBKEY is not a valid public key"; exit 1; }; fi

echo "== packages"
apt-get update -q
DEBIAN_FRONTEND=noninteractive apt-get install -yq sudo openssh-server git tmux curl jq ufw unattended-upgrades fail2ban ca-certificates gnupg
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== operator user: $OPERATOR (agents run as this user, never as root)"
id "$OPERATOR" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$OPERATOR"
install -d -m 700 -o "$OPERATOR" -g "$OPERATOR" "/home/$OPERATOR/.ssh"
if [ -n "$SSH_PUBKEY" ]; then echo "$SSH_PUBKEY" >> "/home/$OPERATOR/.ssh/authorized_keys"; else cp /root/.ssh/authorized_keys "/home/$OPERATOR/.ssh/"; fi
chown "$OPERATOR:$OPERATOR" "/home/$OPERATOR/.ssh/authorized_keys"; chmod 600 "/home/$OPERATOR/.ssh/authorized_keys"
# No passwordless sudo on purpose: an agent running as $OPERATOR should not be able to become root. Grant narrow
# sudo rules (one script, one service) in /etc/sudoers.d/ when you need them.

echo "== ssh: keys only, no root login"
# Your current root session stays open: before closing it, test `ssh $OPERATOR@<box>` from another terminal.
cat > /etc/ssh/sshd_config.d/10-agent-vps.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sshd -t || { rm -f /etc/ssh/sshd_config.d/10-agent-vps.conf; echo "sshd config test failed; left ssh unchanged"; exit 1; }
systemctl reload ssh

echo "== firewall (host): ssh ($SSH_PORT), 80, 443 only"
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp"; ufw allow 80/tcp; ufw allow 443/tcp
ufw --force enable
# !! UFW does NOT protect ports published by Docker (`-p 5432:5432`): Docker DNATs the packet before UFW's rules see
# it. If you run Docker, either publish on 127.0.0.1 only (`-p 127.0.0.1:5432:5432`) or filter in DOCKER-USER with
# `-m conntrack --ctorigdstport`, after a RELATED,ESTABLISHED RETURN. See runbooks/docker-firewall.md. Better still, put
# a cloud firewall (your provider's) in front of the box as well; it sees traffic before Docker does.

echo "== node $NODE_MAJOR, gh"
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
apt-get install -yq nodejs
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list
apt-get update -q && apt-get install -yq gh

echo "== layout"
install -d -o "$OPERATOR" -g "$OPERATOR" /srv/runtime /srv/work
install -d -m 700 -o "$OPERATOR" -g "$OPERATOR" /srv/secrets
#   /srv/runtime  production checkouts; move ONLY by `git pull --ff-only` of merged main (AGENTS.md rule 1)
#   /srv/work     one git worktree per task (rule 2)
#   /srv/secrets  .env files services load with systemd EnvironmentFile=; never in a repo

echo "== agents (as $OPERATOR, user-level installs)"
sudo -iu "$OPERATOR" bash -s <<'EOF'
set -e
npm config set prefix "$HOME/.local"
grep -q '.local/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"
curl -fsSL https://claude.ai/install.sh | bash      # Claude Code (native installer)
npm install -g @openai/codex                         # Codex CLI
claude --version; codex --version
EOF
loginctl enable-linger "$OPERATOR"   # user services and tmux survive logout

cat <<EOF

!! Before you close this root session: from another terminal, check that 'ssh $OPERATOR@<this-box>' works.

Done. Next, as $OPERATOR (ssh $OPERATOR@<this-box>):
  1. claude            # log in once, interactively. Then read runbooks/agent-logins.md BEFORE any unattended run.
  2. codex login --device-auth   # ChatGPT plan; works over SSH. Then: codex login status
  3. node guards/install.mjs
  4. runbooks/telegram-channel.md
EOF
