// Gera o "Pix copia e cola" (BR Code / EMV estático) conforme o manual do Banco Central.
// Com uma chave Pix real, o código abre normalmente no app do banco.

const field = (id: string, value: string) => `${id}${value.length.toString().padStart(2, "0")}${value}`;

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

// O BR Code aceita só ASCII sem acentos nos campos de texto.
const ascii = (v: string, max: number) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, max).trim() || "LOJA";

export function buildPixPayload({ key, name, city, amount, txid }: { key: string; name: string; city: string; amount: number; txid: string }) {
  const account = field("00", "br.gov.bcb.pix") + field("01", key);
  const payload =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    field("54", amount.toFixed(2)) +
    field("58", "BR") +
    field("59", ascii(name, 25)) +
    field("60", ascii(city, 15)) +
    field("62", field("05", txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***")) +
    "6304";
  return payload + crc16(payload);
}
