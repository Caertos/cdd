/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.resolve(file), 'utf8');

// Checks that each consumer references its STRINGS key. Checking for the
// absence of the literal would not work: ContainersView.jsx holds these texts
// as bare JSX text (no quotes) and debugEmpty is split across two lines.

// Control: the same check finds a key that is already used.
test('src/components/ContainerSection.jsx uses STRINGS.noContainers', () => {
  expect(read('src/components/ContainerSection.jsx')).toContain('STRINGS.noContainers');
});

// §5.6 (D17). One test per consumer/key.
test('src/components/LogViewer.jsx uses STRINGS.logsTitle', () => {
  expect(read('src/components/LogViewer.jsx')).toContain('STRINGS.logsTitle(');
});

test('src/components/LogViewer.jsx uses STRINGS.noLogs', () => {
  expect(read('src/components/LogViewer.jsx')).toContain('STRINGS.noLogs');
});

test('src/views/ContainersView.jsx uses STRINGS.debugTitle', () => {
  expect(read('src/views/ContainersView.jsx')).toContain('STRINGS.debugTitle');
});

test('src/views/ContainersView.jsx uses STRINGS.debugEmpty', () => {
  expect(read('src/views/ContainersView.jsx')).toContain('STRINGS.debugEmpty');
});

test('src/views/ContainersView.jsx uses STRINGS.connection.staleWarning', () => {
  expect(read('src/views/ContainersView.jsx')).toContain('STRINGS.connection.staleWarning');
});
