// Regression test for the alarm-sound picker (assets/app.js). This exists
// specifically because a prior refactor (ALARM_TONES -> the alarmTones()
// function, for test-harness exportability) left beep()'s call sites
// referencing the old identifier, which would throw at runtime the first
// time an alarm actually fired — see test/helpers/load-app.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { alarmTones } = loadDuration();

test("alarmTones returns exactly the four tones the picker <select> offers", () => {
  const tones = alarmTones();
  assert.deepEqual(Object.keys(tones).sort(), ["bell", "chime", "digital", "gentle"]);
});

test("every tone is a callable function (schedules oscillators against an AudioContext)", () => {
  const tones = alarmTones();
  for (const [name, fn] of Object.entries(tones)) {
    assert.equal(typeof fn, "function", `${name} should be a function`);
  }
});

test("alarmTones() is a fresh object each call (no shared mutable state between calls)", () => {
  assert.notEqual(alarmTones(), alarmTones());
});

// A minimal fake AudioContext — just enough surface for each tone function to
// run its real scheduling code against, so a typo'd property/method name
// (the actual failure mode this feature already hit once) throws here
// instead of only in a real browser at the moment an alarm fires.
function fakeAudioContext() {
  const node = () => ({
    connect: () => node(),
    start: () => {},
    stop: () => {},
    frequency: {},
    type: "",
    gain: {
      setValueAtTime: () => {},
      linearRampToValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
    },
  });
  return {
    currentTime: 0,
    destination: {},
    createOscillator: () => node(),
    createGain: () => node(),
  };
}

test("every tone runs against a real-shaped AudioContext without throwing", () => {
  const tones = alarmTones();
  for (const [name, fn] of Object.entries(tones)) {
    assert.doesNotThrow(() => fn(fakeAudioContext()), `${name} threw when invoked`);
  }
});
