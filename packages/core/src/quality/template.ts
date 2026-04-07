export interface TemplateCoverageResult {
  matched: string[];
  missing: string[];
  coverage: number;
  passes: boolean;
}

export function checkTemplateCoverage(
  body: string,
  requiredSections: string[],
  minCoverage: number,
): TemplateCoverageResult {
  if (requiredSections.length === 0) {
    return { matched: [], missing: [], coverage: 1, passes: true };
  }

  const headings: string[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('#')) continue;
    const hashMatch = /^#{1,6}$/.exec(trimmed.split(/\s/)[0]);
    if (!hashMatch) continue;
    const text = trimmed.slice(hashMatch[0].length).trim();
    if (text.length > 0) {
      headings.push(text.toLowerCase());
    }
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const section of requiredSections) {
    const needle = section.toLowerCase();
    if (headings.some((h) => h.includes(needle))) {
      matched.push(section);
    } else {
      missing.push(section);
    }
  }

  const coverage = matched.length / requiredSections.length;
  return {
    matched,
    missing,
    coverage,
    passes: coverage >= minCoverage,
  };
}

export function hasChecklist(body: string): boolean {
  return /- \[[ x]\]/i.test(body);
}
