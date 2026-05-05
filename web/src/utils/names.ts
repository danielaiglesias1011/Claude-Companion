export function generateUniqueSessionName(existingNames: Set<string>): string {
  if (!existingNames.has("New chat")) return "New chat";
  for (let i = 2; i < 1000; i++) {
    const name = `New chat ${i}`;
    if (!existingNames.has(name)) return name;
  }
  return "New chat";
}
