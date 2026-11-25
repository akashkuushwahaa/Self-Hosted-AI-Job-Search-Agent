// Stand-ins for the request-scoped Next.js APIs server actions use, so actions can be called directly.
// Each "visitor" has their own cookie jar; switch with `as(visitor)`.
type Jar = Map<string, string>;
const jars = new Map<string, Jar>();
let current = "default";

export function as(visitor: string) {
  current = visitor;
}

export const cookies = async () => {
  const jar = jars.get(current) ?? jars.set(current, new Map()).get(current)!;
  return {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  };
};

export const resetCookies = () => jars.clear();
