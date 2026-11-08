// Finds where an object graph still holds a value, for checking that an owner let go of an expired resource.

/**
 * Every path from `root` that reaches `target` through own data properties,
 * array items, Map keys and values, and Set members. Getters are never run.
 * Typed arrays and buffers are skipped, and each object is visited once.
 * @param {object} root The object to search.
 * @param {*} target The value no path should reach.
 * @returns {string[]} The paths that reach it, empty when none does.
 */
export function referencesTo(root, target)
{
  const found = [];
  const seen = new Set();

  const visit = (value, path) =>
  {
    if (value === target)
    {
      found.push(path || "(root)");
      return;
    }
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
    seen.add(value);

    if (value instanceof Map)
    {
      for (const [ key, item ] of value)
      {
        visit(key, `${path}<key>`);
        visit(item, `${path}[${String(key)}]`);
      }
      return;
    }
    if (value instanceof Set)
    {
      for (const item of value) visit(item, `${path}{}`);
      return;
    }
    for (const key of Object.getOwnPropertyNames(value))
    {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if ("value" in descriptor) visit(descriptor.value, `${path}.${key}`);
    }
  };

  visit(root, "");
  return found;
}
