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

// Тест перехоплення: тимчасова подія з нагадуванням через хвилину, яка потім сама видаляється.
// Спершу пробуємо локальний календар «На Mac» (не синхронізується з телефоном).
if CommandLine.arguments.contains("--test-event") {
    var tempCalendar: EKCalendar? = nil
    if let local = store.sources.first(where: { $0.sourceType == .local }) {
        let cal = EKCalendar(for: .event, eventStore: store)
        cal.title = "Clawd тест"
        cal.source = local
        if (try? store.saveCalendar(cal, commit: true)) != nil { tempCalendar = cal }
    }
    guard let calendar = tempCalendar ?? store.defaultCalendarForNewEvents else {
        output(["error": "no-calendar"], code: 3)
    }
    let ev = EKEvent(eventStore: store)
    ev.title = "Clawd тест 🦀"
    ev.calendar = calendar
    ev.startDate = Date().addingTimeInterval(60)
    ev.endDate = ev.startDate.addingTimeInterval(5 * 60)
    ev.addAlarm(EKAlarm(relativeOffset: 0))
    do {
        try store.save(ev, span: .thisEvent, commit: true)
    } catch {
        output(["error": "save-failed: \(error.localizedDescription)"], code: 4)
    }
    print("{\"ok\":true,\"local\":\(tempCalendar != nil)}")
    fflush(stdout)
    // чекаємо, поки спрацює нагадування, і прибираємо за собою
    Thread.sleep(forTimeInterval: 150)
    try? store.remove(ev, span: .thisEvent, commit: true)
    if let cal = tempCalendar { try? store.removeCalendar(cal, commit: true) }
    exit(0)
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
