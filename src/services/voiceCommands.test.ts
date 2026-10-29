import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertNumberWords,
  interpretVoiceTranscript,
  normalizeTranscript,
  voiceCommandToText,
} from './voiceCommands';

test('normalizeTranscript handles case, punctuation, contractions, and number words', () => {
  assert.equal(normalizeTranscript('  Explain THIS PR, please!  '), 'explain this pr please');
  assert.equal(normalizeTranscript("What's changed here?"), 'what is changed here');
  assert.equal(normalizeTranscript('Explain lines twenty to thirty-five'), 'explain lines 20 to 35');
  assert.equal(normalizeTranscript('Go through lines twelve to eighteen'), 'go through lines 12 to 18');
  assert.equal(convertNumberWords('one hundred five'), '105');
});

test('explainPR variations map to explain-pr', () => {
  for (const phrase of [
    'Explain this PR to me',
    'Go through this pull request',
    'Describe the current PR',
    'Tell me about this PR',
  ]) {
    const match = interpretVoiceTranscript(phrase);
    assert.equal(match.kind, 'explain-pr', phrase);
    assert.equal(voiceCommandToText(match), 'Explain the current PR.');
  }
});

test('summarizePR variations map to summarize-pr', () => {
  for (const phrase of [
    'Summarize the current PR',
    'Summarize the changes',
    'What changes have been made here?',
    'What changed?',
    'Give me the diff summary',
  ]) {
    const match = interpretVoiceTranscript(phrase);
    assert.equal(match.kind, 'summarize-pr', phrase);
    assert.equal(voiceCommandToText(match), 'Summarize the current PR.');
  }
});

test('explainFile and explainFunction variations map to their existing actions', () => {
  for (const phrase of ['Walk me through this file', 'Explain the selected file', 'Describe the current file']) {
    assert.equal(interpretVoiceTranscript(phrase).kind, 'explain-file', phrase);
  }

  for (const phrase of ['What does this function do?', 'Explain this method']) {
    assert.equal(interpretVoiceTranscript(phrase).kind, 'explain-function', phrase);
  }
});

test('line-range variations extract digits and spoken numbers', () => {
  const cases: Array<[string, number, number]> = [
    ['Explain lines 20 to 35', 20, 35],
    ['Go through lines 12 to 18', 12, 18],
    ['Explain code from line 5 to line 15', 5, 15],
    ['Explain lines twenty to thirty five', 20, 35],
    ['Go through lines twelve through eighteen', 12, 18],
    ['Explain lines 35 to 20', 20, 35],
  ];

  for (const [phrase, startLine, endLine] of cases) {
    const match = interpretVoiceTranscript(phrase);
    assert.equal(match.kind, 'explain-range', phrase);
    if (match.kind === 'explain-range') {
      assert.equal(match.startLine, startLine, phrase);
      assert.equal(match.endLine, endLine, phrase);
      assert.equal(
        voiceCommandToText(match),
        `Explain code from line ${startLine} to line ${endLine}.`
      );
    }
  }
});

test('security analysis variations map to check-security', () => {
  for (const phrase of [
    'Run a security analysis',
    'Check this PR for security vulnerabilities',
    'Are there any security threats?',
    'Check security in this file',
    'Scan for malicious code',
    'Check for hardcoded secrets',
    'Audit for vulnerabilities',
  ]) {
    const match = interpretVoiceTranscript(phrase);
    assert.equal(match.kind, 'check-security', phrase);
    assert.equal(voiceCommandToText(match), 'Run a security analysis.');
  }
});

test('PR error checking variations map to check-pr-errors', () => {
  for (const phrase of [
    'Check this PR for errors',
    'Are there any errors before pulling?',
    'Will this PR break anything?',
    'Check for bugs in this pull request',
    'Find defects in this PR',
  ]) {
    const match = interpretVoiceTranscript(phrase);
    assert.equal(match.kind, 'check-pr-errors', phrase);
    assert.equal(voiceCommandToText(match), 'Check this PR for errors.');
  }
});

test('file error checking variations map to check-file-errors', () => {
  for (const phrase of [
    'Check this file for errors',
    'Are there bugs in this file?',
    'Find errors in this file',
    'Check for issues in the selected file',
  ]) {
    const match = interpretVoiceTranscript(phrase);
    assert.equal(match.kind, 'check-file-errors', phrase);
    assert.equal(voiceCommandToText(match), 'Check this file for errors.');
  }
});

test('freeform repo questions route to ask-repo', () => {
  for (const phrase of [
    'How does the auth token get generated?',
    'What dependencies does this project use?',
    'Why is crypto used instead of jsonwebtoken?',
    'Where is the authentication router configured?',
    'Which line contains the error?',
    'Which line has any error?',
    'What line is the bug on?',
    'Explain what this route does',
  ]) {
    const match = interpretVoiceTranscript(phrase);
    assert.equal(match.kind, 'ask-repo', phrase);
    assert.equal(voiceCommandToText(match), phrase);
  }
});

test('ambiguous and incomplete requests ask for clarification without executing', () => {
  const ambiguous = interpretVoiceTranscript('Explain this');
  assert.equal(ambiguous.kind, 'clarify');
  assert.equal(voiceCommandToText(ambiguous), null);

  const noNumbers = interpretVoiceTranscript('Explain lines');
  assert.equal(noNumbers.kind, 'clarify');
  if (noNumbers.kind === 'clarify') {
    assert.equal(noNumbers.reason, 'missing-numbers');
  }

  const oneNumber = interpretVoiceTranscript('Explain this line 20');
  assert.equal(oneNumber.kind, 'clarify');
  if (oneNumber.kind === 'clarify') {
    assert.equal(oneNumber.reason, 'missing-end');
  }

  const empty = interpretVoiceTranscript('   ');
  assert.equal(empty.kind, 'clarify');
  assert.equal(voiceCommandToText(empty), null);
});

test('unrelated non-question requests are unsupported', () => {
  const joke = interpretVoiceTranscript('Tell me a joke');
  assert.equal(joke.kind, 'unsupported');
  assert.equal(voiceCommandToText(joke), null);
});
