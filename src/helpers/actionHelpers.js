// Helper para manejar acciones docker con feedback visual y validación
export async function handleAction({
  containers,
  selected,
  actionFn,
  actionLabel,
  setMessage,
  setMessageColor,
  stateCheck
}) {
  const c = containers[selected];
  if (!c) return;
  if (stateCheck && stateCheck(c)) {
    setMessage(stateCheck(c));
    setMessageColor("red");
    setTimeout(() => setMessage(""), 2000);
    return;
  }
  setMessage(`${actionLabel} container...`);
  setMessageColor("green");
  try {
    await actionFn(c.id);
    setMessage(`${actionLabel} container...`);
    setMessageColor("green");
    setTimeout(() => setMessage(""), 3000);
  } catch (err) {
    setMessage(`Failed to ${actionLabel.toLowerCase()} container.`);
    setMessageColor("red");
    setTimeout(() => setMessage(""), 3000);
  }
}