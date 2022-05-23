export function isUsingFakeTimers() {
  return (
    typeof jest !== 'undefined' &&
    typeof setTimeout !== 'undefined' &&
    (setTimeout.hasOwnProperty('_isMockFunction') || setTimeout.hasOwnProperty('clock'))
  );
}
