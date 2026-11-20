// Читає події з системного Календаря macOS (iCloud, Google, Outlook — усе, що там додано)
// і друкує JSON. Використання: calendar-helper [днів_вперед]
import EventKit
import Foundation

func output(_ obj: [String: Any], code: Int32 = 0) -> Never {
    let data = try! JSONSerialization.data(withJSONObject: obj)
    FileHandle.standardOutput.write(data)
    exit(code)
}

let days = Double(CommandLine.arguments.dropFirst().first ?? "7") ?? 7
let store = EKEventStore()

// 1. Доступ до календаря (перший раз macOS покаже запит)
let status = EKEventStore.authorizationStatus(for: .event)
var granted = false
if #available(macOS 14.0, *), status == .fullAccess {
    granted = true
} else if status == .authorized {
    granted = true
} else if status == .denied || status == .restricted {
    granted = false
} else {
    let sem = DispatchSemaphore(value: 0)
    if #available(macOS 14.0, *) {
        store.requestFullAccessToEvents { ok, _ in granted = ok; sem.signal() }
    } else {
        store.requestAccess(to: .event) { ok, _ in granted = ok; sem.signal() }
    }
    sem.wait()
}
if !granted {
    output(["error": "denied"], code: 2)
}

// 2. Події від "годину тому" до "days днів уперед"
let from = Date().addingTimeInterval(-3600)
let to = Date().addingTimeInterval(days * 86400)
let calendars = store.calendars(for: .event)
let predicate = store.predicateForEvents(withStart: from, end: to, calendars: calendars)

var events: [[String: Any]] = []
for ev in store.events(matching: predicate) where !ev.isAllDay {
    let start = ev.startDate.timeIntervalSince1970 * 1000
    events.append([
        "id": "\(ev.calendarItemExternalIdentifier ?? ev.eventIdentifier ?? "")|\(Int(start))",
        "title": ev.title ?? "Подія",
        "start": start,
        "calendar": ev.calendar.title,
    ])
}

output([
    "events": events,
    "calendars": calendars.map { $0.title },
])
