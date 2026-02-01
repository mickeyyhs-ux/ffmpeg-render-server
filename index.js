const express = require("express");
const AWS = require("aws-sdk");

const app = express();
app.use(express.json());

const s3 = new AWS.S3({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: "auto",
  signatureVersion: "v4",
});

app.get("/", (req, res) => {
  res.json({ ok: true, message: "server alive" });
});

app.get("/r2-test", async (req, res) => {
  try {
    await s3
      .listObjectsV2({
        Bucket: process.env.R2_BUCKET, // 🔥 이 줄이 핵심
        MaxKeys: 1,
      })
      .promise();

    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
// =========================
// DEBUG ROUTES (ADD-ONLY)
// =========================

// 1) Railway env가 런타임에 실제로 들어오는지 확인
app.get("/env-check", (req, res) => {
  const safe = (v) => (v ? `${String(v).slice(0, 4)}...${String(v).slice(-4)}` : null);

  res.json({
    ok: true,
    node: process.version,
    has_R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
    has_R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    has_R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_raw: process.env.R2_BUCKET ?? null,
    R2_BUCKET_trim: process.env.R2_BUCKET ? process.env.R2_BUCKET.trim() : null,
    R2_ACCESS_KEY_ID_preview: safe(process.env.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY_preview: safe(process.env.R2_SECRET_ACCESS_KEY),
  });
});

// 2) R2(S3) 실제 호출 테스트: Bucket은 무조건 env에서 가져오게 강제
app.get("/r2-test", async (req, res) => {
  try {
    const Bucket = (process.env.R2_BUCKET || "").trim();
    if (!Bucket) {
      return res.status(400).json({
        ok: false,
        error: "R2_BUCKET env is empty (Railway Variables 확인 필요)",
      });
    }

    // ⚠️ 아래 s3 객체는 기존 코드에서 이미 생성돼 있어야 합니다.
    // (예: const s3 = new AWS.S3({...}) )
    const out = await s3.listObjectsV2({ Bucket, MaxKeys: 5 }).promise();

    return res.json({
      ok: true,
      bucket: Bucket,
      count: (out.Contents || []).length,
      keys: (out.Contents || []).map((x) => x.Key),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.listen(PORT, () => {
  console.log("server running on", PORT);
});
