# US-024 : Affichage de l'orbe

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **ID** | US-024 |
| **Épique** | E5 — Orb UI |
| **Sprint** | Sprint 1 |
| **Estimation** | 3 points |
| **Priorité** | 🔴 MUST |
| **Assigné** | - |
| **Status** | Ready |

---

## Description

**En tant qu'** utilisateur
**Je veux** voir un orbe animé au centre de l'écran
**Afin de** savoir que Diva est active et prête à m'écouter

---

## Contexte technique

### Design

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│                                         │
│              ╭─────────╮                │
│            ╱             ╲              │
│           │    ORBE      │              │
│           │   (animé)    │              │
│            ╲             ╱              │
│              ╰─────────╯                │
│                                         │
│         "Appuie pour parler"            │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

### Stack

- **SwiftUI** : Vue principale
- **Core Animation** : Animations fluides
- **Metal** : Shaders si nécessaire (optionnel)

### Fichiers à créer

```
app/
├── views/
│   ├── OrbView.swift             # Composant orbe
│   ├── OrbAnimations.swift       # Animations
│   └── HomeView.swift            # Écran principal
├── viewmodels/
│   └── OrbViewModel.swift        # État de l'orbe
└── utils/
    └── Colors.swift              # Palette couleurs
```

---

## Critères d'acceptation

### Fonctionnels

- [ ] **AC-001** : L'orbe est affiché au centre de l'écran
- [ ] **AC-002** : L'orbe a une animation de pulsation "breathing"
- [ ] **AC-003** : L'orbe réagit au tap (feedback visuel)
- [ ] **AC-004** : L'orbe change de couleur selon l'état (voir US-025)
- [ ] **AC-005** : Fond sombre par défaut (#0A0A0F)

### Non-fonctionnels

- [ ] **AC-006** : Animation fluide 60fps
- [ ] **AC-007** : Pas de lag au changement d'état
- [ ] **AC-008** : Responsive (iPhone SE → iPhone 15 Pro Max)

### Accessibilité

- [ ] **AC-009** : VoiceOver : "Diva, bouton, appuie pour parler"
- [ ] **AC-010** : Reduce Motion : animation simplifiée

---

## Tâches de développement

### T1 : Structure de base OrbView (1h)

```swift
// OrbView.swift
import SwiftUI

struct OrbView: View {
    @StateObject var viewModel: OrbViewModel
    
    var body: some View {
        ZStack {
            // Glow externe
            Circle()
                .fill(viewModel.glowColor.opacity(0.3))
                .blur(radius: 40)
                .scaleEffect(viewModel.glowScale)
            
            // Orbe principal
            Circle()
                .fill(
                    RadialGradient(
                        colors: [viewModel.primaryColor, viewModel.secondaryColor],
                        center: .center,
                        startRadius: 0,
                        endRadius: 100
                    )
                )
                .frame(width: 150, height: 150)
                .scaleEffect(viewModel.scale)
                .shadow(color: viewModel.primaryColor.opacity(0.5), radius: 20)
        }
        .frame(width: 200, height: 200)
        .onTapGesture {
            viewModel.onTap()
        }
        .accessibilityLabel("Diva")
        .accessibilityHint("Appuie pour parler")
        .accessibilityAddTraits(.isButton)
    }
}
```

### T2 : ViewModel avec états (1h)

```swift
// OrbViewModel.swift
import SwiftUI
import Combine

enum OrbState {
    case idle
    case listening
    case processing
    case speaking
    case error
}

class OrbViewModel: ObservableObject {
    @Published var state: OrbState = .idle
    @Published var scale: CGFloat = 1.0
    @Published var glowScale: CGFloat = 1.0
    
    var primaryColor: Color {
        switch state {
        case .idle: return Color(hex: "#8B5CF6") // Violet
        case .listening: return Color(hex: "#3B82F6") // Bleu
        case .processing: return Color(hex: "#06B6D4") // Cyan
        case .speaking: return Color(hex: "#10B981") // Vert
        case .error: return Color(hex: "#EF4444") // Rouge
        }
    }
    
    var secondaryColor: Color {
        primaryColor.opacity(0.6)
    }
    
    var glowColor: Color {
        primaryColor
    }
    
    var onTapAction: (() -> Void)?
    
    func onTap() {
        // Feedback haptique
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        
        onTapAction?()
    }
}
```

### T3 : Animation breathing (1.5h)

```swift
// OrbAnimations.swift
import SwiftUI

extension OrbViewModel {
    func startBreathingAnimation() {
        // Animation infinie de pulsation
        withAnimation(
            .easeInOut(duration: 2.0)
            .repeatForever(autoreverses: true)
        ) {
            scale = 1.05
            glowScale = 1.1
        }
    }
    
    func stopBreathingAnimation() {
        withAnimation(.easeOut(duration: 0.3)) {
            scale = 1.0
            glowScale = 1.0
        }
    }
}

// Vue avec animation
struct AnimatedOrbView: View {
    @StateObject var viewModel = OrbViewModel()
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    
    var body: some View {
        OrbView(viewModel: viewModel)
            .onAppear {
                if !reduceMotion {
                    viewModel.startBreathingAnimation()
                }
            }
    }
}
```

### T4 : Écran principal HomeView (1h)

```swift
// HomeView.swift
import SwiftUI

struct HomeView: View {
    @StateObject var orbViewModel = OrbViewModel()
    @StateObject var voiceSession = VoiceSessionViewModel()
    
    var body: some View {
        ZStack {
            // Fond sombre
            Color(hex: "#0A0A0F")
                .ignoresSafeArea()
            
            VStack {
                Spacer()
                
                // Orbe central
                AnimatedOrbView(viewModel: orbViewModel)
                
                Spacer()
                
                // Hint
                if orbViewModel.state == .idle {
                    Text("Appuie pour parler")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                        .padding(.bottom, 50)
                }
            }
        }
        .onAppear {
            orbViewModel.onTapAction = {
                voiceSession.toggleRecording()
            }
        }
        .onChange(of: voiceSession.state) { newState in
            orbViewModel.state = newState.toOrbState()
        }
    }
}
```

### T5 : Palette couleurs (30min)

```swift
// Colors.swift
import SwiftUI

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

struct DivaColors {
    static let background = Color(hex: "#0A0A0F")
    static let violet = Color(hex: "#8B5CF6")
    static let blue = Color(hex: "#3B82F6")
    static let cyan = Color(hex: "#06B6D4")
    static let green = Color(hex: "#10B981")
    static let red = Color(hex: "#EF4444")
}
```

### T6 : Accessibilité (30min)

```swift
// Reduce Motion support
struct OrbView: View {
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    
    var body: some View {
        ZStack {
            // ...
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: viewModel.state)
    }
}
```

---

## Tests requis

### Tests unitaires

```swift
// OrbViewModelTests.swift
func testInitialState() {
    let vm = OrbViewModel()
    XCTAssertEqual(vm.state, .idle)
    XCTAssertEqual(vm.scale, 1.0)
}

func testColorForState() {
    let vm = OrbViewModel()
    
    vm.state = .idle
    XCTAssertEqual(vm.primaryColor, DivaColors.violet)
    
    vm.state = .listening
    XCTAssertEqual(vm.primaryColor, DivaColors.blue)
    
    vm.state = .speaking
    XCTAssertEqual(vm.primaryColor, DivaColors.green)
}

func testTapTriggersAction() {
    let vm = OrbViewModel()
    var tapped = false
    vm.onTapAction = { tapped = true }
    
    vm.onTap()
    
    XCTAssertTrue(tapped)
}
```

### Tests UI (XCUITest)

```swift
func testOrbIsDisplayed() {
    let app = XCUIApplication()
    app.launch()
    
    let orb = app.buttons["Diva"]
    XCTAssertTrue(orb.exists)
}

func testOrbTapChangesState() {
    let app = XCUIApplication()
    app.launch()
    
    app.buttons["Diva"].tap()
    
    // Vérifier changement visuel (snapshot test)
}
```

### Tests manuels

| # | Scénario | Résultat attendu |
|---|----------|------------------|
| 1 | Lancement app | Orbe violet au centre, pulsation douce |
| 2 | Tap sur orbe | Feedback haptique, changement couleur |
| 3 | iPhone SE | Orbe bien centré, taille adaptée |
| 4 | iPhone 15 Pro Max | Orbe bien centré, taille adaptée |
| 5 | VoiceOver activé | "Diva, bouton, appuie pour parler" |
| 6 | Reduce Motion | Pas d'animation de pulsation |

---

## Dépendances

### Prérequises

- Aucune (UI peut être développée en parallèle)

### Bloquantes pour

- US-025 (États visuels)
- US-026 (Waveform)
- US-034 (Écran principal post-onboarding)

---

## Definition of Done

- [ ] Code implémenté et compilant
- [ ] Tests unitaires passent
- [ ] Tests UI passent
- [ ] Animation 60fps validée (Instruments)
- [ ] Responsive validé (SE → Pro Max)
- [ ] VoiceOver validé
- [ ] Code review approuvée
- [ ] PR mergée dans `main`

---

## Notes

### Design inspiration

L'orbe doit évoquer :
- Une présence intelligente (comme HAL 9000 mais amicale)
- La respiration (vie, attention)
- L'écoute (réactivité au son)

### Couleurs par état

| État | Couleur | Signification |
|------|---------|---------------|
| Idle | Violet #8B5CF6 | Prêt, en attente |
| Listening | Bleu #3B82F6 | Écoute active |
| Processing | Cyan #06B6D4 | Réflexion |
| Speaking | Vert #10B981 | Réponse |
| Error | Rouge #EF4444 | Problème |

---

*Story créée par Bob (SM BMAD) — 2026-03-04*
