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

  const headingPattern = /^#{1,6}\s+(.+)$/gm;
  const headings: string[] = [];
  for (
    let match = headingPattern.exec(body);
    match !== null;
    match = headingPattern.exec(body)
  ) {
    headings.push(match[1].trim().toLowerCase());
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
