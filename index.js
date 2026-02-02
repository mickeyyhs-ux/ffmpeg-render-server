const express = require("express");
const { S3Client, ListObjectsV2Command, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ============================
   R2 (S3 compatible) Client - AWS SDK v3
   ============================ */
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2Bucket = process.env.R2_BUCKET;

// ✅ R2 endpoint (S3 API)
const r2Endpoint = r2AccountId
  ? `https://${r2AccountId}.r2.cloudflarestorage.com`
  : null;

// ✅ AWS SDK v3 S3Client
const s3 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint, // 반드시 https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: r2AccessKeyId || "",
    secretAccessKey: r2SecretAccessKey || "",
  },
});

/* ============================
   Health check
   ============================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "server alive" });
});

/* ============================
   ENV CHECK
   ============================ */
app.get("/env-check", (req, res) => {
  const preview = (v) => {
    if (!v) return null;
    const s = String(v);
    if (s.length <= 8) return `${s}`;
    return `${s.slice(0, 4)}...${s.slice(-4)} (len=${s.length})`;
  };

  res.json({
    ok: true,
    R2_ACCOUNT_ID: preview(r2AccountId),
    R2_ACCESS_KEY_ID: preview(r2AccessKeyId),
    R2_SECRET_ACCESS_KEY: preview(r2SecretAccessKey),
    R2_BUCKET: preview(r2Bucket),
    R2_ENDPOINT: preview(r2Endpoint),
    NOTE: "AWS SDK v3 기반. 401(Unauthorized) 서명 문제를 v2보다 안정적으로 피합니다.",
  });
});

/* ============================
   R2 TEST (List Objects)
   ============================ */
app.get("/r2-test", async (req, res) => {
  try {
    if (!r2Bucket) {
      return res.status(500).json({
        ok: false,
        error: "Missing required env: R2_BUCKET",
      });
    }

    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: r2Bucket,
        MaxKeys: 10,
      })
    );

    res.json({
      ok: true,
      bucket: r2Bucket,
      count: (out.Contents || []).length,
      keys: (out.Contents || []).map((o) => o.Key),
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      name: e?.name || null,
      $metadata: e?.$metadata || null,
      note:
        "여기서도 Unauthorized면 99%는 'R2 Access Key/Secret'이 아니라 '토큰(일반 API Token)'을 넣었거나, endpoint/accountId가 S3 API URL 문자열로 잘못 들어간 경우입니다.",
    });
  }
});

/* ============================
   R2 UPLOAD (POST)
   body: { key, contentType, base64 }
   ============================ */
app.post("/r2-upload", async (req, res) => {
  try {
    const { key, contentType, base64 } = req.body || {};

    if (!r2Bucket) {
      return res.status(500).json({ ok: false, error: "Missing required env: R2_BUCKET" });
    }
    if (!key) {
      return res.status(400).json({ ok: false, error: "Missing 'key' in body" });
    }
    if (!base64) {
      return res.status(400).json({ ok: false, error: "Missing 'base64' in body" });
    }

    const buffer = Buffer.from(base64, "base64");

    await s3.send(
      new PutObjectCommand({
        Bucket: r2Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
      })
    );

    res.json({ ok: true, bucket: r2Bucket, key, size: buffer.length });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      name: e?.name || null,
      $metadata: e?.$metadata || null,
    });
  }
});

/* ============================
   Start server
   ============================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server listening on ${PORT}`);
  console.log("R2 endpoint:", r2Endpoint);
  console.log("R2 bucket:", r2Bucket);
});
