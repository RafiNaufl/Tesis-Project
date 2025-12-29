import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const holidays = [
      { date: format(new Date(y, 0, 1)), label: "Tahun Baru", type: "national" },
      { date: format(new Date(y, 4, 1)), label: "Hari Buruh", type: "national" },
      { date: format(new Date(y, 7, 17)), label: "Hari Kemerdekaan", type: "national" },
      // Contoh aturan perusahaan
      { date: format(new Date(y, 11, 25)), label: "Libur Akhir Tahun Perusahaan", type: "company" },
    ];

    return NextResponse.json({ holidays });
  } catch {
    return NextResponse.json({ error: "Failed to load holidays" }, { status: 500 });
  }
}
