# Perubahan Kebijakan Lembur Karyawan Non-Shift

## Ringkasan Perubahan
Efektif segera, kebijakan perhitungan jam lembur untuk karyawan non-shift mengalami penyesuaian terkait waktu istirahat selama periode lembur.

### Aturan Baru
- **Potongan Istirahat**: Setiap periode lembur yang berlangsung selama **4 jam atau lebih** akan dikenakan potongan waktu istirahat wajib selama **1 jam**.
- **Pengecualian**: Lembur dengan durasi kurang dari 4 jam tidak dikenakan potongan istirahat.

## Detail Implementasi Teknis

### 1. Struktur Jam Lembur & Kompresi Slot Istirahat
Analisis struktur jam lembur saat ini menunjukkan bahwa periode lembur panjang (>3 jam) seringkali tidak memiliki jeda istirahat yang tercatat secara formal dalam sistem, meskipun karyawan mengambil istirahat. Kebijakan ini memformalkan jeda tersebut.

| Durasi Lembur Aktual | Potongan Istirahat | Jam Lembur Efektif (Payable) |
|----------------------|--------------------|------------------------------|
| < 4 Jam              | 0 Jam              | Full (Sesuai Durasi)         |
| ≥ 4 Jam              | 1 Jam              | Durasi Aktual - 1 Jam        |

### 2. Dampak Terhadap Perhitungan (Impact Analysis)

#### Skenario A: Lembur Weekday (Senin-Jumat)
*Multiplier: 1 jam pertama x1.5, jam berikutnya x2.0*

**Contoh Kasus: Lembur 5 Jam**
- **Sebelum Revisi**: 
  - 5 jam lembur
  - Perhitungan: (1 x 1.5) + (4 x 2.0) = 1.5 + 8 = **9.5 jam bayaran**
- **Setelah Revisi**:
  - 5 jam lembur - 1 jam istirahat = 4 jam efektif
  - Perhitungan: (1 x 1.5) + (3 x 2.0) = 1.5 + 6 = **7.5 jam bayaran**
- **Selisih**: Berkurang 2 jam bayaran (efisiensi biaya lembur untuk durasi panjang).

#### Skenario B: Lembur Sabtu (Weekend)
*Multiplier: 5 jam pertama x2.0, sisanya x1.0*

**Contoh Kasus: Lembur 5 Jam**
- **Sebelum Revisi**:
  - 5 jam lembur
  - Perhitungan: 5 x 2.0 = **10.0 jam bayaran**
- **Setelah Revisi**:
  - 5 jam lembur - 1 jam istirahat = 4 jam efektif
  - Perhitungan: 4 x 2.0 = **8.0 jam bayaran**
- **Selisih**: Berkurang 2 jam bayaran.

## Integrasi Sistem
Perubahan ini telah diterapkan pada:
1. **Sistem Presensi Otomatis**: Perhitungan otomatis saat checkout akan mendeteksi durasi lembur dan menerapkan potongan jika memenuhi syarat.
2. **Modul Payroll**: Perhitungan gaji bulanan untuk komponen lembur non-shift sudah menggunakan logika baru.
3. **Laporan Kehadiran**: Kolom "Total Jam" dan rincian lembur akan menampilkan durasi efektif (setelah potongan) dan catatan "Potongan Istirahat Lembur: 1 jam" jika berlaku.
