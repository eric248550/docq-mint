/** Hardcoded organization categories. Change here + redeploy to update the list. */
export const SCHOOL_TYPES = [
  { value: 'church', label: 'Church' },
  { value: 'school', label: 'School' },
  { value: 'college', label: 'College' },
  { value: 'university', label: 'University' },
] as const;

export type SchoolTypeValue = (typeof SCHOOL_TYPES)[number]['value'];

export function isValidSchoolType(value: string): value is SchoolTypeValue {
  return SCHOOL_TYPES.some((t) => t.value === value);
}

export function getSchoolTypeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return SCHOOL_TYPES.find((t) => t.value === value)?.label ?? value;
}
