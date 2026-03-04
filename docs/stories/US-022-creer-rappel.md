# US-022 : Créer un rappel

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-022 |
| **Épique** | E4 — Deep Links |
| **Sprint** | Sprint 2 |
| **Estimation** | 3 points |
| **Priorité** | 🔴 MUST |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur
**Je veux** dire "Rappelle-moi dans 10 minutes"
**Afin de** créer un rappel vocalement

---

## Critères d'acceptation

- [ ] **AC-001** : Parsing durée (minutes, heures, secondes)
- [ ] **AC-002** : Parsing heure absolue ("à 14h30")
- [ ] **AC-003** : Création via Reminders.app (EventKit)
- [ ] **AC-004** : Confirmation vocale
- [ ] **AC-005** : Support "rappelle-moi de [action]"

---

## Tâches de développement

### T1 : ReminderService (1.5h)

```swift
// ReminderService.swift
import EventKit

class ReminderService {
    private let eventStore = EKEventStore()
    
    func requestAccess() async throws -> Bool {
        try await eventStore.requestFullAccessToReminders()
    }
    
    func createReminder(title: String, dueDate: Date) async throws {
        let reminder = EKReminder(eventStore: eventStore)
        reminder.title = title
        reminder.calendar = eventStore.defaultCalendarForNewReminders()
        reminder.dueDateComponents = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: dueDate
        )
        reminder.addAlarm(EKAlarm(absoluteDate: dueDate))
        
        try eventStore.save(reminder, commit: true)
    }
}
```

### T2 : Parsing durée (1h)

```swift
// DurationParser.swift
struct ParsedReminder {
    let title: String?
    let dueDate: Date
}

func parseReminder(from input: String) -> ParsedReminder? {
    let lowered = input.lowercased()
    
    // "dans X minutes/heures"
    if let match = lowered.range(of: #"dans\s+(\d+)\s+(minute|heure|seconde)s?"#, options: .regularExpression) {
        let substring = String(lowered[match])
        // Extract number and unit
        let number = Int(substring.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()) ?? 0
        let unit = substring.contains("heure") ? 3600 : substring.contains("minute") ? 60 : 1
        
        let dueDate = Date().addingTimeInterval(Double(number * unit))
        
        // Extract title if present ("de [action]")
        var title: String? = nil
        if let deMatch = lowered.range(of: #"de\s+(.+?)(?:\s+dans|$)"#, options: .regularExpression) {
            title = String(lowered[deMatch]).replacingOccurrences(of: "de ", with: "")
        }
        
        return ParsedReminder(title: title ?? "Rappel Diva", dueDate: dueDate)
    }
    
    // "à 14h30" / "à 2:30 PM"
    if let match = lowered.range(of: #"à\s+(\d{1,2})h?(\d{2})?"#, options: .regularExpression) {
        // Parse time and create date
        // ...
    }
    
    return nil
}
```

### T3 : Intégration triage (30min)

```swift
// Dans TriageService
if let parsed = parseReminder(from: input) {
    return TriageResult(
        tier: 1,
        intent: "reminder",
        confidence: 0.95,
        response: nil,
        parameters: [
            "title": parsed.title ?? "Rappel",
            "dueDate": ISO8601DateFormatter().string(from: parsed.dueDate)
        ]
    )
}
```

### T4 : Exécution action (30min)

```swift
// Dans VoiceOrchestrator
func executeLocalAction(_ result: TriageResult) async throws -> String {
    switch result.intent {
    case "reminder":
        guard let dateString = result.parameters["dueDate"],
              let dueDate = ISO8601DateFormatter().date(from: dateString) else {
            return "Je n'ai pas compris quand te rappeler."
        }
        
        let title = result.parameters["title"] ?? "Rappel"
        try await reminderService.createReminder(title: title, dueDate: dueDate)
        
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "fr_FR")
        let relative = formatter.localizedString(for: dueDate, relativeTo: Date())
        
        return "D'accord, je te rappellerai \(relative)."
        
    default:
        throw ActionError.unknownIntent
    }
}
```

---

## Tests manuels

| # | Input | Résultat attendu |
|---|-------|------------------|
| 1 | "Rappelle-moi dans 10 minutes" | Rappel créé, "dans 10 minutes" |
| 2 | "Rappelle-moi de faire les courses dans 1 heure" | Rappel "faire les courses" |
| 3 | "Rappelle-moi à 14h30" | Rappel à l'heure indiquée |
| 4 | "Rappelle-moi demain" | Rappel lendemain 9h |

---

## Dépendances

- **Prérequise** : US-011
- **Bloquante pour** : Aucune

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
