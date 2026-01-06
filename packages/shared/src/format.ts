export function formatAllowanceType(type: string): string {
  if (type === "NON_SHIFT_MEAL_ALLOWANCE") return "Tunjangan Makan";
  if (type === "NON_SHIFT_TRANSPORT_ALLOWANCE") return "Tunjangan Transport";
  if (type === "SHIFT_FIXED_ALLOWANCE") return "Tunjangan Shift";
  if (type.startsWith("TUNJANGAN_JABATAN")) return "Tunjangan Jabatan";
  return "Tunjangan Lainnya";
}

export function formatDeductionType(type: string): string {
  if (type === "KASBON") return "Potongan Kasbon";
  if (type === "PINJAMAN") return "Potongan Pinjaman Lunak";
  if (type === "ABSENCE") return "Potongan Tidak Masuk";
  if (type === "LATE") return "Potongan Keterlambatan";
  if (type === "BPJS_KESEHATAN") return "BPJS Kesehatan";
  if (type === "BPJS_KETENAGAKERJAAN") return "BPJS Ketenagakerjaan";
  return "Potongan Lainnya";
}
