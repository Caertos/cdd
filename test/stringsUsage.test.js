/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';

const read = (file) => fs.readFileSync(path.resolve(file), 'utf8');

// Checks that each consumer references its STRINGS key. Checking for the
// absence of the literal would not work: App.jsx holds these texts as bare
// JSX text (no quotes) and debugEmpty is split across two lines.

// Control: the same check finds a key that is already used.
test('src/components/ContainerSection.jsx uses STRINGS.noContainers', () => {
  expect(read('src/components/ContainerSection.jsx')).toContain('STRINGS.noContainers');
});

// §5.6 (D17) — fixed by TASK-19. One test per consumer/key.
test.failing('src/components/LogViewer.jsx uses STRINGS.logsTitle', () => {
  expect(read('src/components/LogViewer.jsx')).toContain('STRINGS.logsTitle(');
});

// §5.6 (D17) — fixed by TASK-19.
test.failing('src/components/LogViewer.jsx uses STRINGS.noLogs', () => {
  expect(read('src/components/LogViewer.jsx')).toContain('STRINGS.noLogs');
});

// §5.6 (D17) — fixed by TASK-19.
test.failing('src/App.jsx uses STRINGS.debugTitle', () => {
  expect(read('src/App.jsx')).toContain('STRINGS.debugTitle');
});

// §5.6 (D17) — fixed by TASK-19.
test.failing('src/App.jsx uses STRINGS.debugEmpty', () => {
  expect(read('src/App.jsx')).toContain('STRINGS.debugEmpty');
});

// §5.6 (D17) — fixed by TASK-19.
test.failing('src/App.jsx uses STRINGS.connection.staleWarning', () => {
  expect(read('src/App.jsx')).toContain('STRINGS.connection.staleWarning');
});
