export interface ReceiptSpec {
  fontType: string; // 'Font A (Normal/Default)'
  dotMatrix: string; // '12 x 24 dots'
  charSize: string; // '1.3 x 3.0 mm'
  charsPerLine: number; // 32 for 58mm, 48 for 80mm
}

export function getReceiptSpec(printerSize: '58mm' | '80mm' | string): ReceiptSpec {
  const is80 = printerSize === '80mm';
  return {
    fontType: 'Font A (Normal/Default)',
    dotMatrix: '12 x 24 dots',
    charSize: '1.3 x 3.0 mm',
    charsPerLine: is80 ? 48 : 32
  };
}

/**
 * Truncate or fit text into exact character length
 */
export function centerText(text: string, maxChars: number): string {
  if (text.length >= maxChars) {
    return text.substring(0, maxChars);
  }
  const totalPadding = maxChars - text.length;
  const padLeft = Math.floor(totalPadding / 2);
  const padRight = totalPadding - padLeft;
  return ' '.repeat(padLeft) + text + ' '.repeat(padRight);
}

/**
 * Format two columns: Left aligned and Right aligned text fitting exact maxChars line length
 */
export function padLine(
  left: string,
  right: string,
  maxChars: number,
  fillChar: string = ' '
): string {
  const availableForLeft = maxChars - right.length - 1;
  let cleanLeft = left;
  if (cleanLeft.length > availableForLeft) {
    cleanLeft = cleanLeft.substring(0, availableForLeft);
  }
  const spaces = maxChars - (cleanLeft.length + right.length);
  return cleanLeft + fillChar.repeat(Math.max(1, spaces)) + right;
}

/**
 * Generate divider line matching exact character capacity
 */
export function formatSeparator(maxChars: number, char: string = '-'): string {
  return char.repeat(maxChars);
}

/**
 * Format item rows for thermal printer output
 */
export function formatItemRow(
  nama: string,
  qty: number,
  harga: number,
  subtotal: number,
  maxChars: number
): { nameLine: string; detailLine: string } {
  const formattedSubtotal = `Rp ${subtotal.toLocaleString('id-ID')}`;
  const formattedDetail = `${qty}x @${harga.toLocaleString('id-ID')}`;

  return {
    nameLine: nama.length > maxChars ? nama.substring(0, maxChars) : nama,
    detailLine: padLine(`  ${formattedDetail}`, formattedSubtotal, maxChars)
  };
}
