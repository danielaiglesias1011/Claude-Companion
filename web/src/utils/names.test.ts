import { generateUniqueSessionName } from "./names.js";

describe("generateUniqueSessionName", () => {
  it("returns 'New chat' when no existing names", () => {
    // Default name for a fresh session with no collisions
    const name = generateUniqueSessionName(new Set());
    expect(name).toBe("New chat");
  });

  it("returns 'New chat 2' when 'New chat' is already taken", () => {
    const name = generateUniqueSessionName(new Set(["New chat"]));
    expect(name).toBe("New chat 2");
  });

  it("increments the counter to find the next available name", () => {
    const existing = new Set(["New chat", "New chat 2", "New chat 3"]);
    const name = generateUniqueSessionName(existing);
    expect(name).toBe("New chat 4");
  });

  it("returns a name not in the existing set", () => {
    const existing = new Set(["New chat", "New chat 2"]);
    const name = generateUniqueSessionName(existing);
    expect(existing.has(name)).toBe(false);
  });

  it("always returns a string", () => {
    // Ensure robustness even with a large existing set
    const existing = new Set<string>();
    for (let i = 2; i < 50; i++) existing.add(`New chat ${i}`);
    existing.add("New chat");
    const name = generateUniqueSessionName(existing);
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });
});
