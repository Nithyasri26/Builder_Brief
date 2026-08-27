declare module 'mrz' {
  export interface MrzField {
    value: string | null;
    valid: boolean;
  }
  export interface MrzResult {
    valid: boolean;
    fields: Record<string, string | null> & {
      firstName?: string | null;
      lastName?: string | null;
      birthDate?: string | null;
      sex?: string | null;
      documentNumber?: string | null;
      expirationDate?: string | null;
      nationality?: string | null;
    };
  }
  export function parse(input: string | string[]): MrzResult;
}
