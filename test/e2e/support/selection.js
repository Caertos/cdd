import { docker } from './docker.js';
import { KEY } from './ink.js';

/**
 * Leave the app's selection on `name`'s row.
 *
 * The app sorts the list (problems first) while docker.listContainers does
 * not, and a shared daemon holds other containers: counting indexes in
 * Docker's order lands on the wrong row. Arrow down instead, until the '➤'
 * marker sits on the same line as the 17-char name prefix the row shows
 * (ContainerRow truncates longer names to that).
 *
 * @param {{frame: () => string, press: (...keys: string[]) => Promise<any>}} ui -
 *   Driver from renderApp(); selection always starts at row 0
 * @param {string} name - Full container name as Docker reports it
 * @returns {Promise<void>}
 */
export async function selectContainer(ui, name) {
  const prefix = name.slice(0, 17);
  await ui.waitForText(prefix);
  const marked = () =>
    ui
      .frame()
      .split('\n')
      .some((line) => line.includes('➤') && line.includes(prefix));
  const list = await docker.listContainers({ all: true });
  for (let i = 0; i <= list.length && !marked(); i++) {
    await ui.press(KEY.down);
  }
  if (!marked()) throw new Error(`Selection never reached ${name}`);
}
