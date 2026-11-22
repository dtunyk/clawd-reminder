// Стежить за банерами сповіщень macOS (через «Універсальний доступ»).
// Якщо банер підходить під одне з правил — закриває його і друкує вміст як JSON-рядок.
// Використання: "Clawd Watcher" --rules '[{"apps":["Calendar"],"words":[]}]' [--dump]
// Правило спрацьовує, якщо назва програми є в apps (або apps порожній)
// і текст містить одне зі слів words (або words порожній).
import Cocoa
import ApplicationServices

setvbuf(stdout, nil, _IOLBF, 0)

// ---------- Власний дозвіл ----------
// Перезапускаємо себе з «відмовою від відповідальності», щоб macOS питала дозвіл
// «Універсальний доступ» саме для Clawd Watcher, а не для головної програми.
// Тоді дозвіл не злітає, коли головна програма оновлюється.
@_silgen_name("responsibility_spawnattrs_setdisclaim")
func responsibility_spawnattrs_setdisclaim(_ attrs: UnsafeMutablePointer<posix_spawnattr_t?>, _ disclaim: Int32) -> Int32

let isDisclaimed = ProcessInfo.processInfo.environment["CLAWD_DISCLAIMED"] != nil
if !isDisclaimed, let exe = Bundle.main.executablePath {
    var attr: posix_spawnattr_t? = nil
    posix_spawnattr_init(&attr)
    _ = responsibility_spawnattrs_setdisclaim(&attr, 1)
    var env = ProcessInfo.processInfo.environment
    env["CLAWD_DISCLAIMED"] = "1"
    let envp: [UnsafeMutablePointer<CChar>?] = env.map { strdup("\($0.key)=\($0.value)") } + [nil]
    let argv: [UnsafeMutablePointer<CChar>?] = CommandLine.arguments.map { strdup($0) } + [nil]
    var pid: pid_t = 0
    if posix_spawn(&pid, exe, nil, &attr, argv, envp) == 0 {
        // якщо нас зупинили — зупиняємо й дитину
        for sig in [SIGTERM, SIGINT, SIGHUP] {
            signal(sig) { _ in exit(0) }
        }
        var st: Int32 = 0
        waitpid(pid, &st, 0)
        exit((st >> 8) & 0xff)
    }
}

let args = CommandLine.arguments
let dumpMode = args.contains("--dump")
struct Rule { let apps: [String]; let words: [String] }
var rules: [Rule] = []
if let i = args.firstIndex(of: "--rules"), i + 1 < args.count,
   let data = args[i + 1].data(using: .utf8),
   let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
    let low = { (v: Any?) in ((v as? [String]) ?? []).map { $0.lowercased() }.filter { !$0.isEmpty } }
    rules = arr.map { Rule(apps: low($0["apps"]), words: low($0["words"])) }
        .filter { !$0.apps.isEmpty || !$0.words.isEmpty }
}

func matches(app: String, text: String) -> Bool {
    let a = app.lowercased(), t = text.lowercased()
    return rules.contains { r in
        (r.apps.isEmpty || r.apps.contains(a)) && (r.words.isEmpty || r.words.contains { t.contains($0) })
    }
}

func emit(_ obj: [String: Any]) {
    if let d = try? JSONSerialization.data(withJSONObject: obj), let s = String(data: d, encoding: .utf8) {
        print(s)
    }
}

// ---------- Доступ ----------
let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
var trusted = AXIsProcessTrustedWithOptions([promptKey: true] as CFDictionary)
if !trusted { emit(["status": "no-permission"]) }
while !trusted {
    if isDisclaimed && getppid() == 1 { exit(0) }
    Thread.sleep(forTimeInterval: 2)
    trusted = AXIsProcessTrusted()
}
emit(["status": "ready"])

// ---------- Допоміжні функції AX ----------
func attr(_ el: AXUIElement, _ name: String) -> AnyObject? {
    var v: AnyObject?
    return AXUIElementCopyAttributeValue(el, name as CFString, &v) == .success ? v : nil
}
func str(_ el: AXUIElement, _ name: String) -> String? { attr(el, name) as? String }
func children(_ el: AXUIElement) -> [AXUIElement] { (attr(el, kAXChildrenAttribute) as? [AXUIElement]) ?? [] }
func actionNames(_ el: AXUIElement) -> [String] {
    var a: CFArray?
    return AXUIElementCopyActionNames(el, &a) == .success ? ((a as? [String]) ?? []) : []
}

func describe(_ el: AXUIElement, depth: Int = 0) -> [String: Any] {
    var d: [String: Any] = [:]
    for (k, n) in [("role", kAXRoleAttribute), ("subrole", kAXSubroleAttribute), ("title", kAXTitleAttribute),
                   ("desc", kAXDescriptionAttribute), ("id", "AXIdentifier")] {
        if let s = str(el, n), !s.isEmpty { d[k] = s }
    }
    if let v = attr(el, kAXValueAttribute) as? String, !v.isEmpty { d["value"] = v }
    let acts = actionNames(el)
    if !acts.isEmpty { d["actions"] = acts }
    if depth < 10 {
        let kids = children(el).map { describe($0, depth: depth + 1) }
        if !kids.isEmpty { d["children"] = kids }
    }
    return d
}

// Банер — елемент, у якого subrole містить Banner/Alert/Notification, але не Stack/Group-контейнер
func isBanner(_ el: AXUIElement) -> Bool {
    let sub = (str(el, kAXSubroleAttribute) ?? "").lowercased()
    guard sub.contains("notificationcenter") || sub.contains("notification") else { return false }
    return !sub.contains("stack") && !sub.contains("list")
}

func findBanners(_ el: AXUIElement, depth: Int, into out: inout [AXUIElement]) {
    if isBanner(el) { out.append(el); return }
    if depth > 12 { return }
    for c in children(el) { findBanners(c, depth: depth + 1, into: &out) }
}

func texts(_ el: AXUIElement, depth: Int = 0) -> [String] {
    var out: [String] = []
    if str(el, kAXRoleAttribute) == kAXStaticTextRole as String,
       let v = (attr(el, kAXValueAttribute) as? String) ?? str(el, kAXDescriptionAttribute), !v.isEmpty {
        out.append(v)
    }
    if depth < 10 { for c in children(el) { out += texts(c, depth: depth + 1) } }
    return out
}

func isCloseName(_ s: String) -> Bool {
    let l = s.lowercased()
    return l.contains("close") || l.contains("закрити") || l.contains("clear") || l.contains("очистити")
}

// Закриває банер: спершу дія «Close», потім кнопка «Закрити»
func close(_ banner: AXUIElement) -> Bool {
    for a in actionNames(banner) where isCloseName(a) {
        if AXUIElementPerformAction(banner, a as CFString) == .success { return true }
    }
    var stack = children(banner)
    while let el = stack.popLast() {
        if str(el, kAXRoleAttribute) == kAXButtonRole as String {
            let label = (str(el, kAXDescriptionAttribute) ?? "") + " " + (str(el, kAXTitleAttribute) ?? "")
                + " " + (str(el, "AXIdentifier") ?? "")
            if isCloseName(label), AXUIElementPerformAction(el, kAXPressAction as CFString) == .success { return true }
        }
        for a in actionNames(el) where isCloseName(a) {
            if AXUIElementPerformAction(el, a as CFString) == .success { return true }
        }
        stack += children(el)
    }
    return false
}

// ---------- Головний цикл ----------
var seen: [String: Date] = [:]
var lastWindowSignature = ""

while true {
    // батьківський процес зник (програму закрили) — виходимо
    if isDisclaimed && getppid() == 1 { exit(0) }
    autoreleasepool {
        guard let nc = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.notificationcenterui").first else { return }
        let app = AXUIElementCreateApplication(nc.processIdentifier)
        let windows = (attr(app, kAXWindowsAttribute) as? [AXUIElement]) ?? []

        if dumpMode {
            let sig = windows.map { describe($0) }.description
            if sig != lastWindowSignature {
                lastWindowSignature = sig
                emit(["dump": windows.map { describe($0) }])
            }
        }

        var banners: [AXUIElement] = []
        for w in windows { findBanners(w, depth: 0, into: &banners) }

        for b in banners {
            let desc = str(b, kAXDescriptionAttribute) ?? ""
            let t = texts(b)
            let key = desc + "|" + t.joined(separator: "|")
            if key == "|" || seen[key] != nil { continue }
            seen[key] = Date()
            // опис банера: "Програма, Заголовок, Текст"
            let app = desc.components(separatedBy: ", ").first ?? ""
            var parts: [String: String] = [:]
            for el in children(b) where str(el, kAXRoleAttribute) == kAXStaticTextRole as String {
                if let id = str(el, "AXIdentifier"), let v = attr(el, kAXValueAttribute) as? String { parts[id] = v }
            }
            guard matches(app: app, text: desc + " " + t.joined(separator: " ")) else { continue }
            let closed = close(b)
            emit(["notification": [
                "app": app, "desc": desc, "texts": t,
                "title": parts["title"] ?? "", "subtitle": parts["subtitle"] ?? "", "body": parts["body"] ?? "",
            ], "closed": closed])
        }

        let cutoff = Date().addingTimeInterval(-120)
        seen = seen.filter { $0.value > cutoff }
    }
    Thread.sleep(forTimeInterval: 0.2)
}
