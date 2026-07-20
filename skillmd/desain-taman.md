# SKILL: Pembuatan Gambar Desain Taman — Greenpark Group

> **Status: DRAFT — riset 2 tahap selesai, 1 keputusan teknis masih menunggu
> konfirmasi user (lihat 8d).** Dokumen ini disusun dari
> `Penjelasan Skill Pembuatan Gambar desain Taman.docx` + 11 gambar lampiran
> di dalamnya (dibaca lengkap termasuk gambarnya), diperkaya via deep-research
> 2 tahap (25+25 klaim diverifikasi adversarial 3-vote). **Temuan kritis:
> Ollama Cloud TIDAK mendukung image editing/inpainting** — lihat 8c — perlu
> keputusan jalur teknis pengganti sebelum skill ini siap dipakai produksi.

## 1. Tujuan

Generate gambar desain landscape/taman dari foto kondisi lahan kosong (biasanya
screenshot 3D SketchUp berisi area rumput/tanah kosong + lingkungan sekitarnya),
menggunakan AI image generation — akurat, menarik, dan mencerminkan brand image
Greenpark Group: **"Live Green Live Better"**. Desain harus seragam gayanya antar
satu taman dengan taman lainnya.

## 2. Alat & Akses

- **Jalur utama**: ChatGPT via web Chrome (`mcp__Claude_in_Chrome__*`) — ChatGPT
  bisa generate gambar, ini jalur yang benar (bukan computer-use).
  - Login Google: `greenparkgroupacademy@gmail.com`. Cek dulu apakah sesi sudah
    login sebelum login ulang.
- **Jalur alternatif**: Claude generate image secara langsung (tanpa lewat
  ChatGPT/Chrome), dengan Claude sendiri yang menyusun prompt yang relevan.

## 3. Input — Lampiran Gambar Kondisi Lahan

- Setiap kali skill dijalankan, akan ada lampiran gambar kondisi lahan yang akan
  didesain (biasanya render 3D SketchUp).
- Area yang perlu didesain = area bermaterial **rumput atau tanah kosong** saja.
- **Lingkungan sekitarnya tidak boleh berubah bentuk/layout/geometrinya** —
  bangunan, dinding, jalan/paving, kontur, harus tetap identik posisi & bentuknya.
  - Nuansa penting dari contoh referensi asli: "tidak berubah" ini soal
    **struktur & layout**, bukan berarti gaya render sekitarnya harus tetap
    kartun/SketchUp mentah. Pada contoh output resmi, seluruh gambar (termasuk
    dinding & paving di sekitar taman) ikut di-upgrade jadi fotorealistik —
    yang dipertahankan adalah bentuk, ukuran, dan tata letaknya, bukan gaya
    render mentahnya. Lihat `assets/desain-taman/contoh-lahan-kosong.jpeg` vs
    `assets/desain-taman/contoh-output-taman-resort-tropis.jpeg` (lokasi sama
    persis, before/after).

## 4. Ketentuan Desain

- Mencerminkan brand "Live Green Live Better": pepohonan rindang + taman bunga
  cantik & berwarna.
- Kriteria tanaman yang dipilih — **harus semua terpenuhi sekaligus**:
  kuat, rindang, estetik, mewah, bernilai jual tinggi, tidak mahal, mudah
  ditemukan di Indonesia, mudah dirawat, biasa dipakai di perumahan-perumahan
  besar lain.
- **Konsistensi jenis & jumlah tanaman**:
  - Satu area tertentu → satu jenis pohon besar saja (jangan campur beberapa
    jenis pohon besar berbeda dalam satu area — hasilnya belang-belang/tidak
    seragam).
  - Antar hasil generate (image generate pertama vs kedua dst.) harus tetap
    memakai jenis tanaman yang mirip/konsisten.
  - Jumlah tanaman harus skalatis terhadap luas area — jangan area kecil diisi
    pohon berukuran besar sehingga tidak bisa diimplementasikan di lapangan.
- Desain harus **bisa diimplementasikan nyata di lapangan**, bukan sekadar
  gambar bagus di atas kertas.

## 5. Larangan Tanaman

Jangan pakai tanaman yang berisiko:
- Akarnya merusak konstruksi/pondasi/paving
- Mengundang hama
- Daun/bunga mudah rontok & mengotori area
- Tumbuh tidak beraturan
- Tumbuh terlalu tinggi & rawan roboh/tumbang
- Sulit dirawat / mudah mati

## 6. Format Output Wajib

Bukan sekadar gambar tempelan/sketsa kasar — harus setara kualitas rendering
konsultan arsitek landscape ternama, **dan mengikuti format legenda tanaman**
yang sudah dipakai di contoh referensi asli (lihat `assets/desain-taman/`):

- Render fotorealistik area taman, menyatu dengan foto/render kondisi
  sekitarnya (lihat catatan di bagian 3 soal "tidak berubah" = struktur, bukan
  gaya render).
- **Panel legenda tanaman** di sisi gambar (kiri/kanan), berisi:
  - Judul tema desain (contoh dari referensi: "ALTERNATIF – TAMAN RESORT TROPIS",
    "JENIS TANAMAN — TAMAN JALAN & ENTRANCE")
  - Daftar tanaman bernomor, tiap entri: foto thumbnail, **nama umum Indonesia**
    (yang dipahami tukang taman awam), *nama latin dalam kurung/italic*,
    deskripsi singkat (ciri, warna, ketahanan), tinggi dewasa perkiraan
  - Opsional: badge ringkasan keunggulan (contoh: "Tahan Panas", "Minim
    Perawatan", "Berbunga Sepanjang Tahun", "Akar Aman")
  - Catatan kaki: tinggi tanaman adalah perkiraan saat dewasa, dapat
    disesuaikan lewat pemangkasan rutin
- **Konsistensi format** wajib antar semua gambar yang dihasilkan dalam satu
  batch/proyek — layout panel, gaya tulisan, dan cara penamaan harus seragam.

Referensi visual (diambil dari lampiran docx asli, sudah disalin ke folder ini):
- `assets/desain-taman/contoh-lahan-kosong.jpeg` — contoh kondisi lahan (input)
- `assets/desain-taman/contoh-output-taman-resort-tropis.jpeg` — contoh output
  untuk lahan yang sama persis di atas (before/after)
- `assets/desain-taman/contoh-output-taman-jalan-entrance.jpeg` — contoh output
  format lain (taman jalan & entrance, 10 jenis tanaman)
- `assets/desain-taman/contoh-output-taman-bermain.jpeg` — contoh output untuk
  area taman bermain anak

## 7. Palet Tanaman Terkurasi

> **Status riset tahap 1 (deep-research, 25 klaim diverifikasi 3-vote adversarial):**
> sebagian solid, sebagian ada **gap besar** — lihat catatan gap di bawah sebelum
> dipakai sebagai rujukan final.

### 7a. Kriteria resmi penolakan pohon (terverifikasi 3-0)

Sumber: BPBD DIY + Kepala Dinas Pertamanan & Hutan Kota DKI Jakarta (dikutip Antara, Nov 2025).

Tanda pohon **berisiko, tolak sebagai referensi desain**: cabang rapuh, ada
lubang menganga di batang, ada jamur di batang/akar, batang pohon miring.
Pohon yang dipilih harus: akar kuat (tidak dangkal-melebar), tajuk relatif
ringan, tahan angin kencang.

### 7b. Pohon peneduh/kanopi — DILARANG (terverifikasi, sumber: Kompas mengutip peneliti LIPI + korroborasi insiden nyata)

| Nama | Alasan dilarang |
|---|---|
| Trembesi (*Samanea saman*) | Kayu rapuh, mudah patah, riwayat roboh |
| Angsana (*Pterocarpus indicus*) | Kayu tidak ulet/keropos meski cepat tumbuh; banyak insiden tumbang nyata di Jakarta (kerugian ditaksir Rp270 miliar oleh Dewan Transportasi Jakarta) |
| Mahoni (*Swietenia mahagoni*) | Gugur daun saat kemarau (kotor, sumbat selokan), buah besar berbahaya bagi pejalan kaki/kendaraan |

### 7c. Pohon peneduh/kanopi — direkomendasikan (medium confidence, vote 2-1)

**Pohon Asam / Tamarind** (*Tamarindus indica*) — batang besar & tegak, akar
tunggang tidak muncul ke permukaan sehingga tidak merusak paving/trotoar.
Perlu dikombinasikan dengan tanaman hias lain agar kesan "mewah" tercapai
(pohon asam sendiri kesannya lebih ke arah "rindang-fungsional").

### 7d. Tanaman hias berbunga — direkomendasikan (terverifikasi 3-0)

**Bougenville** (*Bougainvillea*) — mudah dirawat, berbunga sepanjang tahun,
tumbuh baik di matahari penuh & kondisi kering, responsif terhadap
pemangkasan rutin. Satu-satunya tanaman hias berbunga yang benar-benar lolos
verifikasi dari seluruh kandidat yang dicek (Soka/Ixora, Tapak Dara/Vinca,
Pucuk Merah — semua DITOLAK verifikasi, jangan dipakai sebagai rujukan
tunggal tanpa cek ulang).

### 7f. Verifikasi daftar tanaman Greenpark sendiri (riset tahap 2)

Dari 17 tanaman di contoh output resmi, hanya beberapa yang punya cukup data
untuk diverifikasi (sisanya tidak ketemu sumber otoritatif — dianggap
**belum terverifikasi**, bukan berarti aman/tidak aman):

| Tanaman | Hasil | Detail |
|---|---|---|
| **Teh-tehan Kuning** (*Duranta erecta* 'Golden') | 🚩 **RED FLAG** | Berstatus **spesies invasif** menurut datasheet resmi CABI Compendium & biosecurity Queensland (vote 3-0 & 2-1, sumber primer). Tetap lazim dipakai sebagai tanaman pagar/border di Indonesia, tapi tumbuh tak terkendali kalau tidak rutin dipangkas — pertahankan hanya kalau ada komitmen perawatan/pemangkasan rutin, catat ini eksplisit di skill. |
| **Kroton Mini** (*Codiaeum variegatum*) | 🚩 **RED FLAG (untuk tukang taman)** | Getah/lateksnya terbukti menyebabkan **dermatitis kontak & sensitisasi alergi** pada paparan berulang (occupational, jurnal medis PubMed + NC State Extension, vote 3-0 ganda). Juga ada masalah hama terdokumentasi. Bukan bahaya untuk penghuni rumah (bukan tanaman yg disentuh terus), tapi tim taman yang memangkas rutin perlu pakai sarung tangan — sebaiknya dicatat sebagai catatan perawatan, bukan dilarang total. |
| **Hanjuang Merah** (*Cordyline fruticosa*) | ⚪ **BELUM TERBUKTI AMAN** | Klaim "akarnya serabut aman/tidak merusak paving" **DITOLAK verifikasi** (vote 1-2) — bukan berarti terbukti berbahaya, tapi klaim keamanannya belum cukup bukti independen. Penggunaannya sebagai tanaman lanskap umum di Indonesia terkonfirmasi (vote 2-1), jadi aman dari sisi "lazim dipakai", tapi klaim akar amannya jangan dipakai sebagai jaminan tanpa cek ulang.|
| 14 tanaman lainnya (Tabebuya, Palem Merah, Palem Kipas, Bunga Kana, Helikonia, Pakis Brazil, Alpinia Merah, Rumput Jepang, Bunga Pukul Delapan Kuning, Calathea, Lili Paris, Rumput Gajah Mini, Keladi Tikus, Alternanthera) | ⚪ **TIDAK CUKUP DATA** | Tidak ditemukan sumber otoritatif independen dalam riset tahap 1-2. Tetap boleh dipakai (sudah jadi house-style Greenpark & tidak ada red flag ditemukan), tapi belum ada jaminan riset pihak ketiga — kalau butuh kepastian penuh, perlu riset tambahan per-tanaman atau konsultasi arsitek lanskap bersertifikat.|

**Rekomendasi aksi**: pertahankan 17 tanaman ini sebagai palet utama (sudah
jadi identitas visual Greenpark & tidak ada larangan keras ditemukan), tapi
tambahkan 2 catatan operasional: (1) Teh-tehan Kuning wajib rutin dipangkas
supaya tidak invasif liar, (2) penanganan Kroton Mini oleh tim taman pakai
sarung tangan.

### 7e. ⚠️ GAP — belum ada rujukan terverifikasi

- **Ground cover/rumput** dan **semak/border/pagar hidup**: seluruh kandidat
  dari blog properti (Kiara Payung, Ketapang Kencana, Pule, Pucuk Merah,
  Soka, Tapak Dara) **ditolak** verifikasi adversarial — sumbernya blog,
  bukan otoritatif. Perlu riset lanjutan dari sumber lebih primer (dinas
  pertamanan kota, IALI/asosiasi arsitek lanskap, atau jurnal hortikultura).
- **Daftar tanaman yang benar-benar dipakai developer besar** (BSD/Summarecon/
  Alam Sutera/Citra) — tidak ada satupun klaim spesifik yang lolos
  verifikasi soal ini. "Konvensi industri" masih asumsi, belum terbukti.
- **Belum di-cross-check** dengan daftar tanaman yang SUDAH dipakai di contoh
  output resmi Greenpark sendiri (lihat bagian 6): Tabebuya, Palem Merah,
  Palem Kipas, Bunga Kana, Helikonia, Pakis Brazil, Hanjuang Merah, Alpinia
  Merah, Rumput Jepang, Bunga Pukul Delapan Kuning, Calathea, Lili Paris,
  Teh-tehan Kuning, Kroton Mini, Rumput Gajah Mini, Keladi Tikus,
  Alternanthera — riset tahap 1 belum memverifikasi keamanan/kecocokan
  daftar spesifik ini secara langsung.

## 8. Teknik Prompting AI Image Generation

> Status riset tahap 1: 3 klaim teknis solid, tapi **semua detail yang
> actionable (aturan ukuran mask, struktur prompt, konvensi warna mask,
> contoh kode) DITOLAK verifikasi** — belum cukup kuat untuk jadi instruksi
> operasional.

### 8a. Terverifikasi (konseptual, tapi belum cukup detail untuk dieksekusi)

- **gpt-image-1 (OpenAI API resmi)** mendukung inpainting via upload gambar +
  mask (vote 2-1, dikonfirmasi dokumentasi resmi OpenAI). **Catatan penting**:
  gpt-image-1 memakai "soft mask dengan total image recreation" — BUKAN
  penggantian piksel presisi. Artinya area di luar mask BISA sedikit berubah
  warna/pencahayaan meski strukturnya dipertahankan. → SKILL perlu instruksi
  eksplisit "jaga konsistensi pencahayaan & warna di luar area taman".
- **Editor kanvas ChatGPT/DALL-E** punya brush tool untuk melukis mask hanya
  di region yang mau diubah (vote 2-1, dikonfirmasi PetaPixel/Maginative/forum
  resmi OpenAI).
- **Denoising strength (img2img/Stable Diffusion)**: nilai tinggi = hasil
  lebih berubah drastis, nilai rendah = pertahankan gambar asli (vote 3-0,
  sangat solid) — tapi ini konsep Stable Diffusion, **tidak berlaku langsung**
  ke ChatGPT chat atau Claude image gen (parameter ini tidak diekspos ke user
  consumer di kedua platform itu). Relevan hanya jika skill nanti pindah ke
  workflow Stable Diffusion.

### 8c. 🛑 TEMUAN PENTING — Ollama Cloud TIDAK BISA dipakai untuk skill ini

Riset tahap 2 mengecek jujur permintaan pakai Ollama Cloud. Hasilnya, sumber
resmi Ollama sendiri (ollama.com/blog/image-generation & GitHub
ollama/ollama, per Jan 2026) mengonfirmasi:

1. **Ollama baru punya text-to-image generation eksperimental** (model
   `x/z-image-turbo` dari Alibaba Tongyi Lab & `x/flux2-klein` dari Black
   Forest Labs) — fitur ini **BARU**, setelah 2+ tahun tidak ada dukungan
   image generation sama sekali.
2. Fitur ini **LOKAL, bukan Ollama Cloud** — hidup di subtree eksperimental
   `x/imagegen`, dijalankan via `ollama run` di mesin sendiri, bukan layanan
   cloud-hosted.
3. **Baru jalan optimal di macOS Apple Silicon** (build khusus MLX); dukungan
   CUDA/Windows/Linux GPU masih "underway" (belum siap).
4. **TIDAK ADA dukungan inpainting/img2img/mask-based editing** — cuma
   text-to-image murni dari nol. Context-preserving edit ("ubah sebagian,
   sisanya tetap") secara eksplisit baru ada di roadmap, belum diimplementasi.
5. Model vision yang tersedia di **Ollama Cloud** (qwen3-vl dkk) itu model
   image **understanding** (baca gambar), BUKAN image **generation**
   (bikin gambar) — dua kapabilitas yang berbeda total.

> Sebagian klaim di atas belum lolos verifikasi adversarial 3-vote penuh
> karena server sempat overload saat proses riset — tapi sumbernya langsung
> dari blog resmi Ollama & repo GitHub Ollama sendiri (primer, bukan blog
> pihak ketiga), dan seluruh percobaan verifikasi yang berhasil jalan tidak
> ada satupun yang membantahnya. Kesimpulan ini cukup dapat diandalkan.

**Kesimpulan: Ollama Cloud tidak bisa memenuhi kebutuhan inti skill ini**
(redesign sebagian area, pertahankan sisanya) — baik karena belum ada
inpainting sama sekali, maupun karena fiturnya lokal-macOS-only, bukan cloud.

### 8d. Alternatif yang terverifikasi solid: ComfyUI (self-hosted)

Karena Ollama tidak bisa, riset mencari alternatif yang tetap open-source/
self-hosted (sesuai semangat infrastruktur AI Greenpark yang sudah ada).
**ComfyUI** lolos verifikasi kuat (semua klaim berikut vote 3-0):

- Self-hosted, open-source, node-graph based image generation platform
- Mendukung **inpainting** dengan mask (regular & khusus untuk model FLUX)
- API-nya expose **endpoint upload-mask khusus** — cocok untuk workflow
  "kirim foto lahan + mask area rumput → generate"
- Mendukung img2img, ControlNet conditioning (berguna untuk mempertahankan
  struktur/garis bangunan-jalan sekitar sambil redesign area taman)

**Rekomendasi jalur teknis skill** (menggantikan asumsi awal Ollama Cloud):
- **Opsi A (kalau mau tetap self-hosted)**: pasang ComfyUI di server sendiri,
  pakai model FLUX/Stable Diffusion + ControlNet, panggil via API dari
  backend yang sama dengan sistem Ollama yang sudah ada.
- **Opsi B (paling cepat diterapkan, dari riset tahap 1)**: pakai jalur
  ChatGPT/DALL-E via Chrome seperti disebutkan di docx asli — sudah
  terverifikasi mendukung mask-based inpainting (bagian 8a).
- Perlu keputusan Anda: mana yang mau dipakai — instalasi ComfyUI perlu
  effort setup infra baru (GPU server), sementara ChatGPT jalur sudah siap
  pakai tapi bergantung akun eksternal.

### 8b. ⚠️ GAP — belum ada rujukan terverifikasi

- Aturan ukuran mask ideal (klaim "<20% luas gambar" DITOLAK)
- Struktur prompt 3-bagian yang "terbukti efektif" (DITOLAK — klaim generik,
  tidak cukup bukti independen)
- Konvensi warna mask (hitam=preserved vs putih=preserved — sumber-sumber
  yang dicek justru saling kontradiksi, tidak ada yang lolos verifikasi)
- Contoh kode API konkret (client.images.edit dsb — DITOLAK, versi API
  berubah cepat, sumber blog tidak reliable)
- **Cara kerja Claude image generation untuk context-preserving edit** — TIDAK
  ADA klaim terverifikasi sama sekali soal ini. Semua yang terverifikasi
  murni tentang OpenAI/DALL-E/Stable Diffusion. Padahal bagian 2 skill ini
  menyebut Claude sebagai jalur alternatif — bagian ini paling berisiko kalau
  langsung dipakai tanpa riset ulang.
- Prompt konkret khusus kasus "screenshot 3D SketchUp (garis CAD/render kasar)
  → hasil fotorealistik hanya di area taman" — belum ditemukan sumber yang
  membahas kasus spesifik ini.

## 9. Kesalahan yang Harus Dihindari (checklist QA sebelum output final)

- [ ] Salah penamaan tanaman — nama di keterangan harus presisi & komposit
      dengan gambar yang ditampilkan
- [ ] Salah menentukan jenis tanaman — bukan tanaman yang ada/bisa didapat di
      Indonesia
- [ ] Hasil rendering tidak menarik / sulit dimengerti / tidak bisa terealisasi
- [ ] Skala tidak sesuai — lahan sempit digambar seolah luas atau sebaliknya
- [ ] Desain tidak bisa dilaksanakan di lapangan

## Sumber

- `Penjelasan Skill Pembuatan Gambar desain Taman.docx` (dokumen asli, dari
  tim Greenpark) — dibaca lengkap termasuk 11 gambar lampirannya.
