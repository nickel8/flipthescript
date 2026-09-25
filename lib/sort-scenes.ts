/** Natural sort comparator for scene numbers — handles "1", "2", "10", "1A", "2B" etc. */
export function compareSceneNumbers(a: string, b: string): number {
  const parse = (s: string) => {
    const m = s.match(/^(\d+)([A-Za-z]?)/);
    return m ? { n: parseInt(m[1], 10), suffix: m[2] } : null;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa.n !== pb.n) return pa.n - pb.n;
  return pa.suffix.localeCompare(pb.suffix);
}
