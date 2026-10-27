import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpeechRecognitionSession,
  type SpeechRecognitionErrorInfo,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
  type SpeechRecognitionResultListLike,
  type SpeechRecognitionStatus,
} from './speechRecognition';

class FakeRecognition implements SpeechRecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;
  onend: (() => void) | null = null;

  start() {
    this.startCalls += 1;
    this.onstart?.();
  }

  stop() {
    this.stopCalls += 1;
    this.onend?.();
  }

  abort() {
    this.abortCalls += 1;
  }

  emitResult(transcript: string, isFinal: boolean) {
    const results = {
      length: 1,
      0: { isFinal, length: 1, 0: { transcript } },
    } as unknown as SpeechRecognitionResultListLike;
    this.onresult?.({ resultIndex: 0, results });
  }

  emitError(error: string) {
    this.onerror?.({ error });
  }
}

function createHarness() {
  const instances: FakeRecognition[] = [];
  const statuses: SpeechRecognitionStatus[] = [];
  const transcripts: Array<{ transcript: string; isFinal: boolean }> = [];
  const finals: string[] = [];
  const errors: SpeechRecognitionErrorInfo[] = [];
  let nowValue = 1_000;

  const session = createSpeechRecognitionSession({
    recognitionFactory: () => {
      const instance = new FakeRecognition();
      instances.push(instance);
      return instance;
    },
    onStatus: (status) => statuses.push(status),
    onTranscript: (payload) => transcripts.push(payload),
    onFinalTranscript: (transcript) => finals.push(transcript),
    onError: (error) => errors.push(error),
    now: () => nowValue,
  });

  return {
    session,
    statuses,
    transcripts,
    finals,
    errors,
    latest: () => instances[instances.length - 1],
    advanceTime: (ms: number) => {
      nowValue += ms;
    },
  };
}

test('unsupported browsers report unsupported and never listen', () => {
  const statuses: SpeechRecognitionStatus[] = [];
  const errors: SpeechRecognitionErrorInfo[] = [];
  const session = createSpeechRecognitionSession({
    recognitionFactory: () => null,
    onStatus: (status) => statuses.push(status),
    onError: (error) => errors.push(error),
  });

  assert.equal(session.supported, false);
  session.start();

  assert.equal(session.isListening(), false);
  assert.ok(statuses.includes('unsupported'));
  assert.equal(errors[0]?.code, 'unsupported');
  assert.equal(errors[0]?.recoverable, false);
});

test('start, stop, and dispose control the recognizer and clean up handlers', () => {
  const harness = createHarness();
  assert.equal(harness.session.supported, true);

  harness.session.start();
  const recognition = harness.latest();
  assert.equal(recognition.startCalls, 1);
  assert.equal(harness.session.isListening(), true);
  assert.ok(harness.statuses.includes('listening'));

  // A second start while listening is ignored.
  harness.session.start();
  assert.equal(recognition.startCalls, 1);

  harness.session.stop();
  assert.equal(recognition.stopCalls, 1);
  assert.equal(harness.session.isListening(), false);

  harness.session.dispose();
  assert.equal(recognition.abortCalls, 1);
  assert.equal(recognition.onresult, null);
  assert.equal(recognition.onerror, null);
  assert.equal(recognition.onend, null);
  assert.equal(recognition.onstart, null);
});

test('final transcripts are deduplicated within the duplicate window', () => {
  const harness = createHarness();
  harness.session.start();
  const recognition = harness.latest();

  recognition.emitResult('Explain this PR', true);
  recognition.emitResult('Explain this PR', true);
  assert.equal(harness.finals.length, 1);
  assert.equal(harness.finals[0], 'Explain this PR');

  harness.advanceTime(3_000);
  recognition.emitResult('Explain this PR', true);
  assert.equal(harness.finals.length, 2);
});

test('interim transcripts are surfaced without executing a command', () => {
  const harness = createHarness();
  harness.session.start();

  harness.latest().emitResult('Explain the', false);

  assert.equal(harness.transcripts.length, 1);
  assert.deepEqual(harness.transcripts[0], { transcript: 'Explain the', isFinal: false });
  assert.equal(harness.finals.length, 0);
});

test('permission and recognition errors are mapped to honest states', () => {
  const harness = createHarness();
  harness.session.start();
  const recognition = harness.latest();

  recognition.emitError('not-allowed');
  assert.equal(harness.errors[0]?.status, 'permission-denied');
  assert.equal(harness.errors[0]?.recoverable, true);

  recognition.emitError('no-speech');
  assert.equal(harness.errors[1]?.status, 'error');
  assert.match(harness.errors[1]?.message ?? '', /No speech/i);

  recognition.emitError('language-not-supported');
  assert.equal(harness.errors[2]?.status, 'error');
  assert.equal(harness.errors[2]?.recoverable, false);
});

test('dispose prevents later recognition results from executing', () => {
  const harness = createHarness();
  harness.session.start();
  const recognition = harness.latest();

  harness.session.dispose();
  recognition.emitResult('Explain this PR', true);

  assert.equal(harness.finals.length, 0);
  assert.equal(harness.session.isListening(), false);
});