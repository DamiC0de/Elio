/**
 * DivaWidget - iOS Home Screen Widget
 *
 * Quick access to Diva from the home screen:
 * - Tap to open Diva and start listening
 * - Shows last interaction status
 */

import WidgetKit
import SwiftUI

// MARK: - Widget Entry

struct DivaEntry: TimelineEntry {
    let date: Date
    let status: String
    let lastInteraction: String?
}

// MARK: - Provider

struct DivaProvider: TimelineProvider {
    func placeholder(in context: Context) -> DivaEntry {
        DivaEntry(date: Date(), status: "Prêt", lastInteraction: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (DivaEntry) -> Void) {
        let entry = DivaEntry(date: Date(), status: "Prêt", lastInteraction: getLastInteraction())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DivaEntry>) -> Void) {
        let entry = DivaEntry(date: Date(), status: "Prêt", lastInteraction: getLastInteraction())
        
        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        
        completion(timeline)
    }
    
    private func getLastInteraction() -> String? {
        // Read from shared UserDefaults (App Group)
        let defaults = UserDefaults(suiteName: "group.com.diva.app")
        return defaults?.string(forKey: "lastInteraction")
    }
}

// MARK: - Widget Views

struct DivaWidgetEntryView: View {
    var entry: DivaProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

struct SmallWidgetView: View {
    var entry: DivaEntry
    
    var body: some View {
        ZStack {
            // Gradient background
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.4, green: 0.3, blue: 0.9),
                    Color(red: 0.3, green: 0.2, blue: 0.7)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            VStack(spacing: 8) {
                // Mic icon
                Image(systemName: "mic.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.white)
                
                // Status text
                Text("Diva")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text(entry.status)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding()
        }
        .widgetURL(URL(string: "diva://listen"))
    }
}

struct MediumWidgetView: View {
    var entry: DivaEntry
    
    var body: some View {
        ZStack {
            // Gradient background
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.4, green: 0.3, blue: 0.9),
                    Color(red: 0.3, green: 0.2, blue: 0.7)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            HStack(spacing: 16) {
                // Left side - mic and name
                VStack(spacing: 8) {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.white)
                    
                    Text("Diva")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                }
                .frame(width: 100)
                
                // Right side - last interaction
                VStack(alignment: .leading, spacing: 4) {
                    Text("Dernière interaction")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                    
                    if let last = entry.lastInteraction {
                        Text(last)
                            .font(.subheadline)
                            .foregroundColor(.white)
                            .lineLimit(3)
                    } else {
                        Text("Appuie pour parler")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    
                    Spacer()
                    
                    Text(entry.status)
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.6))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding()
        }
        .widgetURL(URL(string: "diva://listen"))
    }
}

// MARK: - Widget Configuration

@main
struct DivaWidget: Widget {
    let kind: String = "DivaWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DivaProvider()) { entry in
            DivaWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Diva")
        .description("Accès rapide à ton assistant vocal")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview

struct DivaWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            DivaWidgetEntryView(entry: DivaEntry(date: Date(), status: "Prêt", lastInteraction: nil))
                .previewContext(WidgetPreviewContext(family: .systemSmall))
            
            DivaWidgetEntryView(entry: DivaEntry(date: Date(), status: "Prêt", lastInteraction: "Rappelle-moi d'appeler maman demain"))
                .previewContext(WidgetPreviewContext(family: .systemMedium))
        }
    }
}
