const TEMPORARY_DEVELOPER_CODE = '9725795';

export function isDeveloperAccessCode(value: string): boolean {
  return value.trim() === TEMPORARY_DEVELOPER_CODE;
}

export function requestDeveloperAccess(featureLabel: string): boolean {
  if (typeof window === 'undefined') return false;
  const entered = window.prompt(`Developer access required for ${featureLabel}.\nEnter developer code:`);
  if (entered === null) return false;
  if (isDeveloperAccessCode(entered)) return true;
  window.alert('Incorrect developer code.');
  return false;
}
