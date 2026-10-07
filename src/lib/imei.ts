/**
 * Contrôle d'un IMEI (15 chiffres) : le dernier chiffre est une clé de Luhn.
 * Sert à repérer une faute de frappe quand le N° est tapé à la main.
 * Les autres formats (N° de série avec lettres, IMEI à 14 / 16 chiffres) ne sont pas vérifiés.
 */
export function imeiCheck(raw: string): 'valid' | 'invalid' | 'not-imei' {
  const code = raw.replace(/[\s-]/g, '');
  if (!/^\d{15}$/.test(code)) return 'not-imei';
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(code[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0 ? 'valid' : 'invalid';
}
