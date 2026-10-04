+++
title = "Declarative Workstation Architecture: Decoupling System Packages from Developer Toolchains"
date = 2026-10-04
draft = false
description = "How a bespoke CachyOS workstation is described declaratively with chezmoi: three installation layers, why language toolchains stay out of the distro package manager, and how checksum-triggered lifecycle hooks keep the machine reproducible."
[taxonomies]
tags = ["chezmoi", "Arch Linux", "Dotfiles", "Toolchains"]
+++

A workstation is only reproducible if its state is described somewhere other
than the machine itself. This journal runs on a CachyOS (Arch-based) desktop
that is managed end to end by chezmoi: the source tree is the single source of
truth, and `chezmoi apply` reconciles the live system to it.

The interesting part is not *that* dotfiles are version-controlled. It is how
the layering is drawn — which artefacts belong to the operating system, which
belong to the distro package manager, and which belong to standalone upstream
toolchains — and why those boundaries are worth defending.

## Three layers, three update cadences

The machine is described in three deliberately separate layers:

| Layer | Technology | Owners |
|---|---|---|
| OS / desktop | CachyOS + a Wayland desktop environment | the distro |
| System packages | `pacman` + AUR helpers + Flatpak | the distro and packagers |
| Developer toolchains | official upstream installers (`rustup`, `uv`, `bun`, `go`) | upstream projects |

Everything else — shell, editor, prompt, input methods, terminal — is
configuration layered on top and tracked in the same source tree.

## Why toolchains stay out of the package manager

Language toolchains are the classic source of version pain. A distro package
manager is optimised for system software with a slow, stable cadence; a Rust or
Python toolchain updates weekly and is often several releases ahead of what a
distro ships.

Rather than fight that mismatch, the toolchains are installed by their own
upstream installers and kept entirely in user space:

| Toolchain | Manager | Install location |
|---|---|---|
| Rust | `rustup` + `cargo` | `~/.cargo/bin` |
| Python CLIs | `uv` | `~/.local/bin` |
| JS/TS tools | `bun` | `~/.bun/bin` |
| Go tools | `go install` | `~/go/bin` |

Two properties fall out of this:

- **No version conflicts with distro packages.** A toolchain never fights
  `pacman` over a shared path.
- **Independent update cadence.** Each toolchain self-updates on its own
  schedule, and a broken user-level tool cannot corrupt the system layer — nor
  can a system upgrade silently replace a pinned toolchain.

Each toolchain is recorded in a plain-text manifest (`toolchains/cargo.txt`,
`toolchains/uv.txt`, and so on), so the *set* of installed tools is declarative
even though the installers are imperative.

## Hooks that run only when their content changes

Installing software is a side effect, and side effects need an execution model.
The repository uses chezmoi's `run_onchange_` scripts: a script re-runs **only
when its rendered content changes**. The rendered content usually embeds a
checksum of the manifests it consumes, so editing a manifest is what triggers an
install.

Three hooks cover the lifecycle in order:

1. **Packages** — installs and updates native packages, AUR packages, and
   Flatpaks from the manifests.
2. **Toolchains** — bootstraps the managers if missing, then restores the
   sub-tools listed in the toolchain manifests.
3. **System services** — deploys the one tracked root-level config and enables
   the relevant timers and services.

Two rules keep the hooks safe to re-run indefinitely. They are **idempotent**:
every mutation is guarded by a presence check, so N runs equal one. And they
**degrade gracefully**: optional steps are allowed to fail without aborting the
run, so a missing network dependency never leaves the machine half-configured.

## The shell is authoritative

The primary shell is Fish, configured so that non-interactive agent tools use
the same dialect as an interactive session. That single decision removes an
entire class of "works in my terminal, fails in a script" bugs, because there is
exactly one shell grammar to reason about.

## Root configuration as tracked state

Root-level configuration is kept to an absolute minimum: exactly one tracked
system file (a keyboard remapping config) is deployed, plus a small set of timer
and service enablements. Everything else lives in user space.

The keyboard example is instructive. Caps Lock is overloaded — tap sends `Esc`,
hold acts as `Ctrl` — declared as a few lines of config rather than a graph
tweak. That is the whole point of the repository: even low-level input behaviour
is a reviewable, reproducible artefact.

## Anatomy of the source tree

```
~/.local/share/chezmoi
├── AGENTS.md              # operational rules for AI agents
├── README.md              # quickstart + daily workflow + troubleshooting
├── packages/              # native / AUR / Flatpak manifests
├── toolchains/            # rustup, uv, bun, go manifests
├── dot_config/            # → ~/.config  (fish, editor, prompt, input, agents)
├── dot_local/             # → ~/.local   (bin symlinks, toolcards)
├── private_dot_ssh/       # SSH client config only — never keys
├── system/                # the one tracked root-level config
└── run_onchange_after_*.sh.tmpl   # the three lifecycle hooks
```

The layout follows one rule: the source tree is the single source of truth, and
live files are treated as build output. Edit the source, preview with
`chezmoi diff`, then apply — never the other way around, unless a live edit is
first pulled back with `chezmoi re-add`.

## Takeaway

Reproducibility is not a single tool; it is a set of boundaries. Separating
system packages from developer toolchains, keeping side effects inside
content-hashed hooks, and treating root configuration as a rare, tracked
exception are three boundaries that make a personal workstation behave like a
declarative system.
