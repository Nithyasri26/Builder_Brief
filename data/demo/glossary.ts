/**
 * "What does this mean?" — plain-language explanations for the government
 * terminology that appears in the product. Deterministic content: no model
 * call is needed to answer these.
 */

export interface GlossaryEntry {
  term: string;
  aliases: string[];
  meaning: string;
  example?: string;
}

export const glossary: GlossaryEntry[] = [
  {
    term: 'KYC',
    aliases: ['kyc', 'know your customer'],
    meaning:
      'KYC means Know Your Customer. It is used to verify that your identity information matches your account records.',
    example: 'For a provident fund account, KYC usually means your identity and bank details are linked to the account.',
  },
  {
    term: 'UAN',
    aliases: ['uan', 'universal account number'],
    meaning:
      'UAN means Universal Account Number. It is a single number that stays with you across employers and links all your provident fund accounts together.',
    example: 'In this demo the UAN is 100123456789, which is a placeholder number.',
  },
  {
    term: 'PF Passbook',
    aliases: ['pf passbook', 'passbook', 'provident fund passbook'],
    meaning:
      'A PF passbook is a statement of your provident fund account. It shows how much you contributed, how much your employer contributed, and the interest added.',
  },
  {
    term: 'Income Certificate',
    aliases: ['income certificate', 'income proof'],
    meaning:
      'An income certificate is a document issued by the revenue authority that states your household income. Many welfare programmes use it to check income-based criteria.',
  },
  {
    term: 'DigiLocker',
    aliases: ['digilocker', 'digi locker', 'document wallet'],
    meaning:
      'DigiLocker is the Government of India platform where issued documents such as certificates and licences can be stored and shared digitally.',
    example: 'In this prototype the DigiLocker connection is simulated, so no real documents are accessed.',
  },
  {
    term: 'Address Proof',
    aliases: ['address proof', 'proof of address'],
    meaning:
      'An address proof is any accepted document that shows where you currently live, such as an Aadhaar letter, voter ID or a utility bill.',
  },
  {
    term: 'Date of Birth Proof',
    aliases: ['dob proof', 'date of birth proof', 'birth proof'],
    meaning:
      'A date of birth proof is a document that shows when you were born. A birth certificate or a school leaving certificate is commonly accepted.',
  },
  {
    term: 'Grievance',
    aliases: ['grievance', 'complaint', 'pgportal', 'cpgrams'],
    meaning:
      'A grievance is a formal complaint you file with a government department when a service has not worked as expected. The department records it and gives you a reference number to follow up.',
  },
  {
    term: 'Annexure',
    aliases: ['annexure'],
    meaning:
      'An annexure is an extra form or declaration attached to an application. Different services ask for different annexures depending on your situation.',
  },
  {
    term: 'Police Verification',
    aliases: ['police verification'],
    meaning:
      'Police verification is a step in some applications, such as a passport, where the local police confirm your address and identity details.',
  },
  {
    term: 'Self Attestation',
    aliases: ['self attestation', 'self attested'],
    meaning:
      'Self attestation means you sign a photocopy of your own document to confirm that it is a true copy of the original.',
  },
  {
    term: 'Beneficiary',
    aliases: ['beneficiary'],
    meaning:
      'A beneficiary is the person who receives the benefit of a scheme or payment.',
  },
];

export function lookupTerm(query: string): GlossaryEntry | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const direct = glossary.find(
    (entry) => entry.term.toLowerCase() === q || entry.aliases.includes(q),
  );
  if (direct) return direct;
  return (
    glossary.find(
      (entry) =>
        entry.aliases.some((alias) => q.includes(alias)) || q.includes(entry.term.toLowerCase()),
    ) ?? null
  );
}
