const express = require("express");
const AWS = require("aws-sdk");

const app = express();
app.use(express.json());

/* =========================
   R2 (S3 compatible) Client
   ========================= */
const s3 = new AWS.S3({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: "auto",
  signatureVersion: "v4",
});

/* =========================
   Health check
   ========================= */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "server alive" });
});

/* =========================
   ENV DEBUG (가장 중요)
   ========================= */
app.get("/env-check", (req, res) => {
  const preview = (v) =>
    v ? `${String(v).slice(0, 4)}...${String(v).slice(-4)} (${String(v).length})` : null;

  res.json({
    ok: true,
    node: process.version,

    has_R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
    has_R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    has_R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    has_R2_BUCKET: !!process.env.R2_BUCKET,

    R2_BUCKET_raw: process.env.R2_BUCKET ?? null,
    R2_BUCKET_trim: process.env.R2_BUCKET ? process.env.R2_BUCKET.trim() : null,

    R2_ACCESS_KEY_ID_preview: preview(process.env.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY_preview: preview(process.env.R2_SECRET_ACCESS_KEY),
  });
});

/* =========================
   R2 TEST (Bucket 필수)
   ========================= */
app.get("/r2-test", async (req, res) => {
  try {
    const Bucket = (process.env.R2_BUCKET || "").trim();
    if (!Bucket) {
      return res.status(400).json({
        ok: false,
        error: "R2_BUCKET env is empty (Railway Variables 확인 필요)",
      });
    }

    const result = await s3
      .listObjectsV2({
        Bucket,
        MaxKeys: 5,
      })
      .promise();

    res.json({
      ok: true,
      bucket: Bucket,
      objectCount: (result.Contents || []).length,
      keys: (result.Contents || []).map((o) => o.Key),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/* =========================
   Server start
   ========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("server running on", PORT);
});
