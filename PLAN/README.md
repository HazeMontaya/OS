# PLAN

Zentrale Wissens- und Ausführungsbasis für die Weiterentwicklung von OS.

## Struktur

```text
PLAN/
├─ 00-MASTER/       ← verbindliches Zielbild, Architektur, Bewertung, Roadmap
├─ 01-AKTUELL/      ← aktive kritische Entwicklungsblöcke
├─ 02-BACKLOG/      ← ältere/geplante Einzelaufgaben
├─ 03-ARCHIV/       ← erledigte/überholte Aufgaben
└─ 04-REFERENZEN/   ← Marktanalyse, Quellen, Repo-Snapshot
```

## Prioritätsregel

`00-MASTER/MASTERPLAN.md` und `00-MASTER/ROADMAP.md` haben Vorrang vor älteren Einzel-Backlogs. Alte Backlog-Dateien bleiben als Detailreferenzen erhalten, werden aber nur umgesetzt, wenn sie zum aktuellen Architekturplan passen.

## Kernziel

OS wird als **portable, local-first, provider-unabhängige Agent-Control-Plane** entwickelt: Multi-Agent Runtime, Computer Use, Capability Broker, persistenter State, Memory/Skills, Model Router, Workflows/Automationen und vollständige visuelle Kontrolle.

## Arbeitsregel

1. Zuerst Runtime-State/Event Backbone.
2. Dann Agent Runtime v2.
3. Dann Isolation/Security.
4. Dann Agent-Control-Center UI.
5. Danach Computer Use, Router, Memory/Skills und 24/7 Operations.
6. Kein Feature gilt als fertig ohne echte Datenpfade, Tests und Failure States.
