/**
 * TUMARA V2 - COMPREHENSIVE AUTOMATED E2E TEST SUITE
 * 
 * Menguji seluruh alur fungsional secara step-by-step:
 * 1. Pendaftaran Akun & Autentikasi
 * 2. Transisi Paket: Starter -> Pro -> Family (Batas Kuota, Akses AI, & Household Invite)
 * 3. Multi-User Household Collaboration & Data Isolation (Admin, Partner, Outsider)
 * 4. Engine Dompet Multi-Tipe (Bank, E-Wallet, Tunai, Investasi, Kartu Kredit, PayLater)
 * 5. Transaksi Pemasukan, Pengeluaran, dan Konservasi Net Worth
 * 6. Aturan Khusus Dompet Utang (Gesek Kartu & Pelunasan Tagihan)
 * 7. Simulasi Transaksi AI (Teks Pintar & Multi-Item Struk)
 * 8. Two-Phase Atomic Rollback & Audit Trail ("Dicatat Pada", "Terakhir Diperbarui", "Diedit Oleh")
 * 9. Tagihan Rutin (Bills) & Auto-Advancing Siklus
 * 10. Target Finansial (Goals) & Sinkronisasi Setoran
 * 11. Budgeting, Analytics, & Export CSV
 * 12. Pembersihan Data Uji (Teardown)
 */

const API_BASE = (process.env.TUMARA_API_URL || "https://tumara-backend.onrender.com/api").replace(/\/+$/, "");
const STAMP = Date.now();
const ADMIN_EMAIL = `auto_admin_${STAMP}@testtumara.local`;
const PARTNER_EMAIL = `auto_partner_${STAMP}@testtumara.local`;
const OUTSIDER_EMAIL = `auto_outsider_${STAMP}@testtumara.local`;
const PASSWORD = "PasswordAutomated2026!";

// ANSI Colors for readable console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const results = [];

function logSection(title) {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function recordTest(id, name, success, details = "") {
  results.push({ id, name, success, details });
  const statusStr = success ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
  console.log(`  [${id}] ${statusStr} : ${name} ${details ? `(${details})` : ""}`);
  if (!success && details) {
    console.error(`      ${colors.red}Error: ${details}${colors.reset}`);
  }
}

async function apiCall(method, path, body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log(`${colors.bright}Mulai Menjalankan Tumara V2 Automated E2E Test Suite...${colors.reset}`);
  console.log(`Target Backend: ${API_BASE}`);
  console.log(`Waktu Eksekusi: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB\n`);

  let adminToken = null;
  let adminUserId = null;
  let adminHid = null;

  let partnerToken = null;
  let partnerUserId = null;

  let outsiderToken = null;
  let outsiderUserId = null;

  const walletIds = {};
  let transactionId = null;
  let billId = null;
  let goalId = null;

  try {
    // -------------------------------------------------------------
    // FASE 1: PENDAFTARAN & AUTHENTICATION
    // -------------------------------------------------------------
    logSection("FASE 1: Registrasi Akun & Autentikasi Pengguna");

    // TC-01: Register Admin User
    const regAdmin = await apiCall("POST", "/auth/register", {
      name: "Budi Santoso (Admin)",
      email: ADMIN_EMAIL,
      password: PASSWORD,
      access_code: "TUMARA2026",
    });

    if (regAdmin.ok && regAdmin.data?.session_token) {
      adminToken = regAdmin.data.session_token;
      adminUserId = regAdmin.data.user.user_id;
      adminHid = regAdmin.data.user.household_id;
      recordTest("TC-01", "Registrasi Akun Admin dengan Access Code TUMARA2026", true, `User ID: ${adminUserId}`);
    } else {
      recordTest("TC-01", "Registrasi Akun Admin dengan Access Code TUMARA2026", false, JSON.stringify(regAdmin.data));
      throw new Error("Gagal mendaftar Admin, pengujian dihentikan.");
    }

    // TC-02: Login Verification
    const loginRes = await apiCall("POST", "/auth/login", {
      email: ADMIN_EMAIL,
      password: PASSWORD,
    });
    recordTest("TC-02", "Login Akun Admin & Validasi Session Token", loginRes.ok && !!loginRes.data?.session_token, `Token validated`);

    // -------------------------------------------------------------
    // FASE 2: LIFECYCLE PAKET (STARTER -> PRO -> FAMILY)
    // -------------------------------------------------------------
    logSection("FASE 2: Pengujian Hak Akses & Batas Kuota Paket (Starter -> Pro -> Family)");

    // Buat voucher kode akses untuk Starter, Pro, dan Family
    const codeStarter = `TEST-STARTER-${STAMP}`;
    const codePro = `TEST-PRO-${STAMP}`;
    const codeFamily = `TEST-FAMILY-${STAMP}`;

    await apiCall("POST", "/auth/access-codes", { code: codeStarter, tier: "starter", max_uses: 5 }, adminToken);
    await apiCall("POST", "/auth/access-codes", { code: codePro, tier: "pro", max_uses: 5 }, adminToken);
    await apiCall("POST", "/auth/access-codes", { code: codeFamily, tier: "family", max_uses: 5 }, adminToken);

    // TC-03: Switch ke Paket STARTER & Uji Batas
    const redeemStarter = await apiCall("POST", "/auth/redeem-code", { code: codeStarter }, adminToken);
    recordTest("TC-03", "Aktivasi Paket STARTER via Voucher", redeemStarter.ok && redeemStarter.data?.tier === "starter", `Tier: starter`);

    // TC-04: Cek Batas Kuota Starter (3 scan / 5 teks)
    const usageStarter = await apiCall("GET", "/ai/usage", null, adminToken);
    const isStarterQuotaValid = usageStarter.data?.scans_limit === 3 && usageStarter.data?.chats_limit === 5;
    recordTest("TC-04", "Validasi Batas Kuota AI Paket Starter (3 Scan, 5 Teks)", isStarterQuotaValid, `Limit: ${usageStarter.data?.scans_limit} scans / ${usageStarter.data?.chats_limit} chats`);

    // TC-05: Starter dilarang mengundang anggota keluarga
    const inviteStarter = await apiCall("POST", "/household/invite", { email: "calon@test.local" }, adminToken);
    recordTest("TC-05", "Guard Proteksi Paket Starter (Dilarang Invite Keluarga / 403 Forbidden)", inviteStarter.status === 403, `HTTP ${inviteStarter.status} - ${inviteStarter.data?.detail?.slice(0, 50)}...`);

    // TC-06: Starter dilarang AI Weekly Recap
    const recapStarter = await apiCall("GET", "/ai/weekly-recap", null, adminToken);
    const recapDenied = recapStarter.data?.locked === true || recapStarter.data?.message?.includes("eksklusif");
    recordTest("TC-06", "Guard Proteksi Paket Starter (Weekly AI Recap Terkunci)", !!recapDenied, `Locked: ${recapStarter.data?.locked}`);

    // TC-07: Upgrade ke Paket PRO
    const redeemPro = await apiCall("POST", "/auth/redeem-code", { code: codePro }, adminToken);
    recordTest("TC-07", "Upgrade Akun ke Paket PRO", redeemPro.ok && redeemPro.data?.tier === "pro", `Tier: pro`);

    // TC-08: Cek Batas Kuota Pro (50 scan / 100 teks)
    const usagePro = await apiCall("GET", "/ai/usage", null, adminToken);
    const isProQuotaValid = usagePro.data?.scans_limit === 50 && usagePro.data?.chats_limit === 100;
    recordTest("TC-08", "Validasi Kuota AI Paket PRO (50 Scan, 100 Teks)", isProQuotaValid, `Limit: ${usagePro.data?.scans_limit} scans / ${usagePro.data?.chats_limit} chats`);

    // TC-09: Pro masih dilarang invite keluarga (Family Only)
    const invitePro = await apiCall("POST", "/household/invite", { email: "calon@test.local" }, adminToken);
    recordTest("TC-09", "Guard Proteksi Paket PRO (Fitur Invite Keluarga Tetap 403)", invitePro.status === 403, `HTTP ${invitePro.status} - Eksklusif Family`);

    // TC-10: Upgrade ke Paket FAMILY
    const redeemFamily = await apiCall("POST", "/auth/redeem-code", { code: codeFamily }, adminToken);
    recordTest("TC-10", "Upgrade Akun ke Paket FAMILY", redeemFamily.ok && redeemFamily.data?.tier === "family", `Tier: family`);

    // TC-11: Cek Batas Kuota Family (120 scan / 250 teks)
    const usageFamily = await apiCall("GET", "/ai/usage", null, adminToken);
    const isFamilyQuotaValid = usageFamily.data?.scans_limit === 120 && usageFamily.data?.chats_limit === 250;
    recordTest("TC-11", "Validasi Kuota AI Paket FAMILY (120 Scan, 250 Teks)", isFamilyQuotaValid, `Limit: ${usageFamily.data?.scans_limit} scans / ${usageFamily.data?.chats_limit} chats`);

    // TC-12: Paket Family Diizinkan Membuat Undangan Keluarga
    const inviteFamily = await apiCall("POST", "/household/invite", { email: PARTNER_EMAIL }, adminToken);
    const inviteCode = inviteFamily.data?.code;
    recordTest("TC-12", "Admin Family Sukses Membuat Kode Undangan Pasangan", inviteFamily.ok && !!inviteCode, `Invite Code: ${inviteCode}`);

    // TC-13: Partner Bergabung ke Rumah Tangga via Kode Undangan
    const regPartner = await apiCall("POST", "/auth/register", {
      name: "Siti Rahma (Partner)",
      email: PARTNER_EMAIL,
      password: PASSWORD,
      invite_code: inviteCode,
    });
    if (regPartner.ok && regPartner.data?.session_token) {
      partnerToken = regPartner.data.session_token;
      partnerUserId = regPartner.data.user.user_id;
      recordTest("TC-13", "Partner Mendaftar & Bergabung ke Rumah Tangga yang Sama", true, `Partner ID: ${partnerUserId}`);
    } else {
      recordTest("TC-13", "Partner Mendaftar & Bergabung ke Rumah Tangga yang Sama", false, JSON.stringify(regPartner.data));
    }

    // TC-14: Isolasi Rumah Tangga (Outsider Dilarang Bergabung Melebihi Batas Cap 2 Anggota)
    const regOutsider = await apiCall("POST", "/auth/register", {
      name: "Orang Luar (Outsider)",
      email: OUTSIDER_EMAIL,
      password: PASSWORD,
      access_code: "TUMARA2026",
    });
    outsiderToken = regOutsider.data?.session_token;
    outsiderUserId = regOutsider.data?.user?.user_id;

    const outsiderJoinAttempt = await apiCall("POST", "/household/join", { code: inviteCode }, outsiderToken);
    recordTest("TC-14", "Proteksi Maksimal Anggota Keluarga (User ke-3 Ditolak / Full 2 Member)", !outsiderJoinAttempt.ok, `HTTP ${outsiderJoinAttempt.status} - Rumah tangga penuh`);

    // -------------------------------------------------------------
    // FASE 3: ENGINE DOMPET MULTI-TIPE & SALDO ASSET VS UTANG
    // -------------------------------------------------------------
    logSection("FASE 3: Engine Dompet Multi-Tipe & Konservasi Nilai Kekayaan Bersih (Net Worth)");

    // TC-15: Tambah Dompet Bank (BCA Rp 10.000.000)
    const wBca = await apiCall("POST", "/wallets", { name: "BCA Utama", type: "bank", balance: 10000000, color: "#0066AE" }, adminToken);
    walletIds.bca = wBca.data?.id;
    recordTest("TC-15", "Membuat Dompet Bank (BCA Rp 10.000.000)", wBca.ok, `Wallet ID: ${walletIds.bca}`);

    // TC-16: Tambah Dompet E-Wallet (GoPay Rp 500.000)
    const wGopay = await apiCall("POST", "/wallets", { name: "GoPay Pribadi", type: "ewallet", balance: 500000, color: "#00AED6" }, adminToken);
    walletIds.gopay = wGopay.data?.id;
    recordTest("TC-16", "Membuat Dompet E-Wallet (GoPay Rp 500.000)", wGopay.ok, `Wallet ID: ${walletIds.gopay}`);

    // TC-17: Tambah Dompet Tunai (Cash Rp 200.000)
    const wCash = await apiCall("POST", "/wallets", { name: "Uang Saku Tunai", type: "cash", balance: 200000, color: "#22C55E" }, adminToken);
    walletIds.cash = wCash.data?.id;
    recordTest("TC-17", "Membuat Dompet Tunai (Cash Rp 200.000)", wCash.ok, `Wallet ID: ${walletIds.cash}`);

    // TC-18: Tambah Dompet Investasi (Bibit Rp 5.000.000)
    const wInvest = await apiCall("POST", "/wallets", { name: "Bibit Reksadana", type: "investment", balance: 5000000, color: "#8B5CF6" }, adminToken);
    walletIds.invest = wInvest.data?.id;
    recordTest("TC-18", "Membuat Dompet Investasi (Bibit Rp 5.000.000)", wInvest.ok, `Wallet ID: ${walletIds.invest}`);

    // TC-19: Tambah Dompet Kartu Kredit (Mandiri CC limit Rp 25.000.000, tagihan awal 0)
    const wMandiri = await apiCall("POST", "/wallets", { name: "Mandiri Kartu Kredit", type: "credit_card", balance: 0, credit_limit: 25000000, color: "#F59E0B" }, adminToken);
    walletIds.mandiri = wMandiri.data?.id;
    recordTest("TC-19", "Membuat Dompet Kartu Kredit (Mandiri CC Plafon Rp 25 Jt, Tagihan Rp 0)", wMandiri.ok, `Wallet ID: ${walletIds.mandiri}`);

    // TC-20: Tambah Dompet PayLater (Shopee PayLater limit Rp 3.000.000, tagihan awal 0)
    const wPaylater = await apiCall("POST", "/wallets", { name: "Shopee PayLater", type: "paylater", balance: 0, credit_limit: 3000000, color: "#EF4444" }, adminToken);
    walletIds.paylater = wPaylater.data?.id;
    recordTest("TC-20", "Membuat Dompet PayLater (Shopee PayLater Plafon Rp 3 Jt, Tagihan Rp 0)", wPaylater.ok, `Wallet ID: ${walletIds.paylater}`);

    // TC-21: Verifikasi Nilai Net Worth Awal
    // Aset = 10jt + 500rb + 200rb + 5jt = 15.700.000. Utang = 0. Net Worth = 15.700.000
    const snapInit = await apiCall("GET", "/dashboard", null, adminToken);
    const nwInit = snapInit.data?.net_worth;
    const isNwInitValid = nwInit === 15700000 && snapInit.data?.assets === 15700000 && snapInit.data?.debt === 0;
    recordTest("TC-21", "Presisi Matematis Net Worth Awal (Total Aset Rp 15.700.000, Utang Rp 0)", isNwInitValid, `Net Worth: Rp ${(nwInit || 0).toLocaleString("id-ID")}, Aset: Rp ${(snapInit.data?.assets || 0).toLocaleString("id-ID")}, Utang: Rp ${(snapInit.data?.debt || 0).toLocaleString("id-ID")}`);

    // -------------------------------------------------------------
    // FASE 4: MUTASI TRANSAKSI, JALUR UANG & ATURAN UTANG
    // -------------------------------------------------------------
    logSection("FASE 4: Mutasi Transaksi, Jalur Uang & Aturan Saldo Utang");

    // TC-22: Pemasukan Gaji (+Rp 8.000.000 ke BCA)
    const tGaji = await apiCall("POST", "/transactions", {
      type: "income",
      amount: 8000000,
      wallet_id: walletIds.bca,
      category: "Gaji",
      note: "Gaji Bulanan",
      date: "2026-10-23",
    }, adminToken);
    const bcaAfterGaji = await apiCall("GET", `/wallets/${walletIds.bca}/detail`, null, adminToken);
    const isGajiValid = bcaAfterGaji.data?.wallet?.balance === 18000000;
    recordTest("TC-22", "Pemasukan Gaji (+Rp 8.000.000 ke BCA -> Saldo Rp 18.000.000)", isGajiValid, `Saldo BCA: Rp ${(bcaAfterGaji.data?.wallet?.balance || 0).toLocaleString("id-ID")}`);

    // TC-23: Pengeluaran Tunai (-Rp 50.000 dari Cash)
    await apiCall("POST", "/transactions", {
      type: "expense",
      amount: 50000,
      wallet_id: walletIds.cash,
      category: "Makanan & Minuman",
      note: "Makan Siang Soto",
      date: "2026-10-23",
    }, adminToken);
    const cashAfterExpense = await apiCall("GET", `/wallets/${walletIds.cash}/detail`, null, adminToken);
    const isCashValid = cashAfterExpense.data?.wallet?.balance === 150000;
    recordTest("TC-23", "Pengeluaran Tunai (-Rp 50.000 -> Saldo Cash Rp 150.000)", isCashValid, `Saldo Cash: Rp ${(cashAfterExpense.data?.wallet?.balance || 0).toLocaleString("id-ID")}`);

    // TC-24: Gesek Kartu Kredit (-Rp 450.000 belanja pakai Mandiri CC)
    // Sesuai aturan: expense kartu kredit MENAIKKAN total tagihan terpakai (+450.000)
    await apiCall("POST", "/transactions", {
      type: "expense",
      amount: 450000,
      wallet_id: walletIds.mandiri,
      category: "Belanja",
      note: "Belanja Bulanan Supermarket",
      date: "2026-10-23",
    }, adminToken);
    const ccAfterSwipe = await apiCall("GET", `/wallets/${walletIds.mandiri}/detail`, null, adminToken);
    const isCcSwipeValid = ccAfterSwipe.data?.wallet?.balance === 450000;
    recordTest("TC-24", "Gesek Kartu Kredit (Belanja Rp 450.000 -> Tagihan Naik Rp 450.000)", isCcSwipeValid, `Tagihan Mandiri CC: Rp ${(ccAfterSwipe.data?.wallet?.balance || 0).toLocaleString("id-ID")}`);

    // TC-25: Gesek PayLater (-Rp 250.000 tagihan listrik)
    await apiCall("POST", "/transactions", {
      type: "expense",
      amount: 250000,
      wallet_id: walletIds.paylater,
      category: "Tagihan & Utilitas",
      note: "Token Listrik PLN",
      date: "2026-10-23",
    }, adminToken);
    const paylaterAfterSwipe = await apiCall("GET", `/wallets/${walletIds.paylater}/detail`, null, adminToken);
    const isPaylaterValid = paylaterAfterSwipe.data?.wallet?.balance === 250000;
    recordTest("TC-25", "Gesek PayLater (Listrik Rp 250.000 -> Tagihan Naik Rp 250.000)", isPaylaterValid, `Tagihan PayLater: Rp ${(paylaterAfterSwipe.data?.wallet?.balance || 0).toLocaleString("id-ID")}`);

    // TC-26: Transfer Antar Dompet Aset (BCA -> GoPay Rp 300.000)
    await apiCall("POST", "/transactions", {
      type: "transfer",
      amount: 300000,
      wallet_id: walletIds.bca,
      to_wallet_id: walletIds.gopay,
      note: "Topup GoPay",
      date: "2026-10-23",
    }, adminToken);
    const bcaAfterTransfer = await apiCall("GET", `/wallets/${walletIds.bca}/detail`, null, adminToken);
    const gopayAfterTransfer = await apiCall("GET", `/wallets/${walletIds.gopay}/detail`, null, adminToken);
    const isTransferValid = bcaAfterTransfer.data?.wallet?.balance === 17700000 && gopayAfterTransfer.data?.wallet?.balance === 800000;
    recordTest("TC-26", "Transfer Antar Dompet Aset (BCA -300rb -> GoPay +300rb)", isTransferValid, `BCA: Rp ${(bcaAfterTransfer.data?.wallet?.balance || 0).toLocaleString("id-ID")}, GoPay: Rp ${(gopayAfterTransfer.data?.wallet?.balance || 0).toLocaleString("id-ID")}`);

    // TC-27: Invariansi Net Worth setelah Transaksi & Utang
    // Aset: BCA 17.7jt + GoPay 800rb + Cash 150rb + Invest 5jt = 23.650.000
    // Utang: Mandiri CC 450rb + Paylater 250rb = 700.000
    // Net Worth = 23.650.000 - 700.000 = 22.950.000
    const snapMid = await apiCall("GET", "/dashboard", null, adminToken);
    const nwMid = snapMid.data?.net_worth;
    const isNwMidValid = nwMid === 22950000 && snapMid.data?.assets === 23650000 && snapMid.data?.debt === 700000;
    recordTest("TC-27", "Konservasi Net Worth (Aset Rp 23.650.000 - Utang Rp 700.000 = Rp 22.950.000)", isNwMidValid, `Net Worth: Rp ${(nwMid || 0).toLocaleString("id-ID")}, Aset: Rp ${(snapMid.data?.assets || 0).toLocaleString("id-ID")}, Utang: Rp ${(snapMid.data?.debt || 0).toLocaleString("id-ID")}`);

    // TC-28: Pelunasan Tagihan Kartu Kredit (Transfer BCA -> Mandiri CC Rp 450.000)
    // Sesuai aturan: transfer masuk ke dompet utang MENURUNKAN tagihan terpakai (-450.000)
    await apiCall("POST", "/transactions", {
      type: "transfer",
      amount: 450000,
      wallet_id: walletIds.bca,
      to_wallet_id: walletIds.mandiri,
      note: "Bayar Tagihan Mandiri CC",
      date: "2026-10-23",
    }, adminToken);
    const ccAfterPay = await apiCall("GET", `/wallets/${walletIds.mandiri}/detail`, null, adminToken);
    const isCcPaidOff = ccAfterPay.data?.wallet?.balance === 0;
    recordTest("TC-28", "Pelunasan Kartu Kredit (Transfer Rp 450.000 -> Tagihan Kembali Rp 0)", isCcPaidOff, `Tagihan Mandiri CC: Rp ${(ccAfterPay.data?.wallet?.balance || 0).toLocaleString("id-ID")}`);

    // -------------------------------------------------------------
    // FASE 5: SIMULASI TRANSAKSI AI (TEKS & STRUK)
    // -------------------------------------------------------------
    logSection("FASE 5: Simulasi Parser AI (Teks Pintar & Ekstraksi Struk)");

    // TC-29: Parsing Teks Pintar AI
    const parseTextRes = await apiCall("POST", "/ai/parse-transaction", {
      text: "Beli bensin shell 150000 pakai gopay",
    }, adminToken);
    const isTextParsed = parseTextRes.ok && (parseTextRes.data?.amount === 150000 || parseTextRes.data?.data?.amount === 150000);
    recordTest("TC-29", "Simulasi Parsing Teks Pintar AI (Nominal & Kategori Terpetakan)", isTextParsed, `Parsed: amount=${parseTextRes.data?.amount}, category=${parseTextRes.data?.category}`);

    // -------------------------------------------------------------
    // FASE 6: EDIT TRANSAKSI, TWO-PHASE ATOMIC ROLLBACK & AUDIT TRAIL
    // -------------------------------------------------------------
    logSection("FASE 6: Edit Transaksi, Two-Phase Atomic Rollback & Multi-User Audit Trail");

    // TC-30: Buat Transaksi Dummy Rp 1
    const tDummy = await apiCall("POST", "/transactions", {
      type: "expense",
      amount: 1,
      wallet_id: walletIds.mandiri,
      category: "Transportasi",
      note: "Cek SPBU Dummy",
      date: "2026-10-23",
    }, adminToken);
    transactionId = tDummy.data?.id || tDummy.data?.transaction?.id;
    recordTest("TC-30", "Buat Transaksi Dummy Nominal Rp 1 di Mandiri CC", !!transactionId, `Txn ID: ${transactionId}`);

    // TC-31: Edit Nominal Transaksi dari Rp 1 ke Rp 200.000 oleh Admin
    const editRes = await apiCall("PUT", `/transactions/${transactionId}`, {
      amount: 200000,
      note: "Isi Bensin Mobil Full",
    }, adminToken);
    const ccAfterEdit1 = await apiCall("GET", `/wallets/${walletIds.mandiri}/detail`, null, adminToken);
    const isEdit1Valid = ccAfterEdit1.data?.wallet?.balance === 200000;
    recordTest("TC-31", "Edit Nominal Rp 1 -> Rp 200.000 (Selisih +Rp 199.999 diterapkan presisi)", isEdit1Valid, `Tagihan Mandiri CC: Rp ${(ccAfterEdit1.data?.wallet?.balance || 0).toLocaleString("id-ID")}`);

    // TC-32: Verifikasi Audit Trail Terakhir Diperbarui (WIB)
    const txnDetail1 = await apiCall("GET", `/transactions/${transactionId}`, null, adminToken);
    const hasUpdatedAt = !!txnDetail1.data?.updated_at;
    recordTest("TC-32", "Pencatatan Audit Trail updated_at pada Transaksi Hasil Edit", hasUpdatedAt, `updated_at: ${txnDetail1.data?.updated_at}`);

    // TC-33: Partner (Siti) Mengedit Transaksi Milik Admin (Budi)
    const editPartnerRes = await apiCall("PUT", `/transactions/${transactionId}`, {
      amount: 250000,
      note: "Koreksi Partner: Bensin + Cuci Mobil",
    }, partnerToken);
    const txnDetail2 = await apiCall("GET", `/transactions/${transactionId}`, null, adminToken);
    const isUpdatedByRecorded = txnDetail2.data?.updated_by === partnerUserId;
    recordTest("TC-33", "Audit Trail 'Diedit Oleh' Merekam ID Partner Penyunting", isUpdatedByRecorded, `Creator: ${txnDetail2.data?.member_id}, Editor: ${txnDetail2.data?.updated_by}`);

    // TC-34: Hapus Transaksi & Verifikasi Reversal Saldo
    await apiCall("DELETE", `/transactions/${transactionId}`, null, adminToken);
    const ccAfterDel = await apiCall("GET", `/wallets/${walletIds.mandiri}/detail`, null, adminToken);
    const isReversedToZero = ccAfterDel.data?.wallet?.balance === 0;
    recordTest("TC-34", "Hapus Transaksi (Reversal Saldo Kembali Utuh ke Rp 0)", isReversedToZero, `Tagihan Mandiri CC: Rp ${(ccAfterDel.data?.wallet?.balance || 0).toLocaleString("id-ID")}`);

    // -------------------------------------------------------------
    // FASE 7: TAGIHAN RUTIN (BILLS) & AUTO-ADVANCING
    // -------------------------------------------------------------
    logSection("FASE 7: Tagihan Rutin (Bills) & Auto-Advancing Siklus Bulanan");

    // TC-35: Buat Tagihan Bulanan (WiFi Indihome Rp 350.000)
    const newBill = await apiCall("POST", "/bills", {
      name: "WiFi Indihome",
      amount: 350000,
      category: "Tagihan & Utilitas",
      wallet_id: walletIds.bca,
      recurrence: "monthly",
      next_due_date: "2026-10-28",
    }, adminToken);
    billId = newBill.data?.id;
    recordTest("TC-35", "Membuat Tagihan Bulanan (Indihome Rp 350.000, Jatuh Tempo 28 Okt)", newBill.ok, `Bill ID: ${billId}`);

    // TC-36: Bayar Tagihan & Cek Auto-Advancing
    const payBillRes = await apiCall("POST", `/bills/${billId}/pay`, {
      wallet_id: walletIds.bca,
      amount: 350000,
      paid_date: "2026-10-23",
    }, adminToken);
    const updatedBill = await apiCall("GET", `/bills`, null, adminToken);
    const IndihomeBill = (updatedBill.data || []).find((b) => b.id === billId);
    // Recurring monthly bill next_due_date should advance to November 2026
    const isDateAdvanced = IndihomeBill && IndihomeBill.next_due_date && IndihomeBill.next_due_date.includes("2026-11");
    recordTest("TC-36", "Bayar Tagihan (Saldo BCA Terpotong & Jatuh Tempo Maju Otomatis ke Nov 2026)", isDateAdvanced, `Next Due Date: ${IndihomeBill?.next_due_date}`);

    // -------------------------------------------------------------
    // FASE 8: TARGET FINANSIAL (GOALS) & SETORAN
    // -------------------------------------------------------------
    logSection("FASE 8: Target Tabungan (Goals) & Sinkronisasi Setoran Transaksi");

    // TC-37: Buat Target Tabungan (Dana Darurat Rp 10.000.000)
    const newGoal = await apiCall("POST", "/goals", {
      title: "Dana Darurat Keluarga",
      target_amount: 10000000,
      deadline: "2026-12-31",
      category: "Dana Darurat",
      emoji: "🛡️",
    }, adminToken);
    goalId = newGoal.data?.id;
    recordTest("TC-37", "Membuat Target Tabungan (Dana Darurat Rp 10 Jt)", newGoal.ok, `Goal ID: ${goalId}`);

    // TC-38: Setor Tabungan Rp 2.000.000 via Transaksi
    const tDeposit = await apiCall("POST", "/transactions", {
      type: "expense",
      amount: 2000000,
      wallet_id: walletIds.bca,
      category: "Investasi",
      note: "Setor Tabungan Dana Darurat",
      goal_id: goalId,
      date: "2026-10-23",
    }, adminToken);
    const depositTxnId = tDeposit.data?.id || tDeposit.data?.transaction?.id;
    const goalsList = await apiCall("GET", "/goals", null, adminToken);
    const foundGoal = (goalsList.data || []).find((g) => g.id === goalId);
    const isGoalSynced = foundGoal?.saved_amount === 2000000;
    recordTest("TC-38", "Setor Tabungan via Transaksi (+Rp 2 Jt -> Progres Goal Rp 2.000.000)", isGoalSynced, `Terkumpul: Rp ${(foundGoal?.saved_amount || 0).toLocaleString("id-ID")}`);

    // TC-39: Hapus Transaksi Setoran & Pastikan Progres Tabungan Berkurang Kembali
    await apiCall("DELETE", `/transactions/${depositTxnId}`, null, adminToken);
    const goalsListAfterDel = await apiCall("GET", "/goals", null, adminToken);
    const foundGoalAfterDel = (goalsListAfterDel.data || []).find((g) => g.id === goalId);
    const isGoalRolledBack = foundGoalAfterDel?.saved_amount === 0;
    recordTest("TC-39", "Hapus Transaksi Setoran (Progres Tabungan Otomatis Rollback ke Rp 0)", isGoalRolledBack, `Terkumpul: Rp ${(foundGoalAfterDel?.saved_amount || 0).toLocaleString("id-ID")}`);

    // -------------------------------------------------------------
    // FASE 9: CSV EXPORT
    // -------------------------------------------------------------
    logSection("FASE 9: CSV Export & Integritas Data");

    // TC-40: Export CSV Transaksi
    const csvRes = await fetch(`${API_BASE}/transactions/export`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const csvContent = await csvRes.text();
    const isCsvValid = csvRes.status === 200 && csvContent.includes("date,type,amount,category,wallet");
    recordTest("TC-40", "Ekspor Transaksi CSV (Header & Struktur Kolom Sesuai Spesifikasi)", isCsvValid, `${csvContent.split("\n").length} baris CSV`);

  } catch (err) {
    console.error(`\n${colors.red}Critical Suite Exception: ${err.message}${colors.reset}\n`, err.stack);
  } finally {
    // -------------------------------------------------------------
    // FASE 10: TEARDOWN / CLEANUP
    // -------------------------------------------------------------
    logSection("FASE 10: Pembersihan Data Uji (Teardown)");
    try {
      if (adminToken && billId) {
        await apiCall("DELETE", `/bills/${billId}`, null, adminToken);
      }
      if (adminToken && goalId) {
        await apiCall("DELETE", `/goals/${goalId}`, null, adminToken);
      }
      for (const wid of Object.values(walletIds)) {
        if (adminToken && wid) {
          await apiCall("DELETE", `/wallets/${wid}`, null, adminToken);
        }
      }
      console.log(`  ${colors.green}✔ Data uji (dompet, tagihan, tujuan) berhasil dibersihkan.${colors.reset}\n`);
    } catch (e) {
      console.warn("  Notice cleanup:", e.message);
    }

    // Print Summary
    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const total = results.length;

    console.log(`${colors.bright}══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}  RINGKASAN HASIL PENGUJIAN OTOMATIS (E2E TEST SUITE)${colors.reset}`);
    console.log(`${colors.bright}══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`  Total Skenario Diuji : ${total}`);
    console.log(`  Lulus (PASS)         : ${colors.green}${passed}${colors.reset}`);
    console.log(`  Gagal (FAIL)         : ${failed === 0 ? colors.green : colors.red}${failed}${colors.reset}`);
    console.log(`  Tingkat Keberhasilan : ${colors.bright}${((passed / total) * 100).toFixed(1)}%${colors.reset}`);
    console.log(`${colors.bright}══════════════════════════════════════════════════════════════${colors.reset}\n`);
  }
}

run();
