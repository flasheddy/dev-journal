export type Exit = (code: number) => void;

export function report(errors: readonly string[], exit: Exit = (code) => process.exit(code)): void {
  if (errors.length === 0) return;
  for (const error of errors) console.error(`FAIL: ${error}`);
  exit(1);
}
