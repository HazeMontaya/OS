# Rebuild Notes

## Reparierte Ausgangsprobleme
- Die bisherigen Desktop-Installer referenzierten `seed\` und `app-src\`, die im gelieferten ZIP fehlten.
- Mehrere konkurrierende Installer erzeugten unterschiedliche OS-Strukturen (`AI-Brain`, `Vault`, `UI`, `Source`).
- Start- und Health-Skripte bezogen sich teilweise auf unterschiedliche Generationen.
- Die Desktop-App war im Paket nicht enthalten.

## Neue kanonische Struktur
`S:\OS` ist die einzige Root-Struktur. `Vault`, `Agents`, `Skills`, `MCP`, `Automations`, `Capabilities`, `Workspaces`, `Source`, `Core`, `Config`, `Apps`, `Runtime`, `Tools`, `Models`, `Data`, `Logs`, `Backups` sind feste Schichten.
