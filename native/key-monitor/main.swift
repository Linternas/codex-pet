import ApplicationServices
import Darwin
import Foundation

let readyMessage = Data("ready\n".utf8)
let keyDownMessage = Data("keyDown\n".utf8)
let permissionRequiredMessage = Data("permission-required\n".utf8)
let tapUnavailableMessage = Data("tap-unavailable\n".utf8)

func writeStdout(_ data: Data) {
  FileHandle.standardOutput.write(data)
}

let accessibilityOptions = [
  kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: false,
] as CFDictionary

guard AXIsProcessTrustedWithOptions(accessibilityOptions) else {
  writeStdout(permissionRequiredMessage)
  exit(2)
}

let keyDownMask = CGEventMask(1 << CGEventType.keyDown.rawValue)
let eventCallback: CGEventTapCallBack = { _, type, event, _ in
  if type == .keyDown {
    writeStdout(keyDownMessage)
  }

  return Unmanaged.passUnretained(event)
}

guard
  let eventTap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: keyDownMask,
    callback: eventCallback,
    userInfo: nil,
  ),
  let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
else {
  writeStdout(tapUnavailableMessage)
  exit(3)
}

CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: eventTap, enable: true)
writeStdout(readyMessage)
CFRunLoopRun()
