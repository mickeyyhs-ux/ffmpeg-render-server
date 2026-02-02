const express = require("express");
const AWS = require("aws-sdk");

const app = express();
app.use(express.json({ limit: "50mb" })); // base64 업로드 대비
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ============================
   R2 (S3 compatible) Client
   ============================ */
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2Bucket = process.env.R2_BUCKET;

// endpoint 구성: https://<accountid>.r2.cloudflarestorage.com
const r2Endpoint = r2AccountId
  ? `https://${r2AccountId}.r2.cloudflarestorage.com`
  : null;

/**
 * ✅ Cloudflare R2에서 "Unauthorized / Signature" 줄이는 핵심 포인트
 * - s3ForcePathStyle: true  (가장 중요)
 * - correctClockSkew: true  (서버 시간 오차로 인한 서명 실패 방지)
 * - httpOptions.timeout 등은 운영 안정성용 (필수는 아님)
 */
const s3 = new AWS.S3({
  endpoint: r2Endpoint,
  accessKeyId: r2AccessKeyId,
  secretAccessKey: r2SecretAccessKey,
  region: "auto",
  signatureVersion: "v4",

  // ✅ 중요: R2에서 서명 문제(Unauthorized/SignatureDoesNotMatch) 방지
  s3ForcePathStyle: true,

  // ✅ 시간 오차로 인한 서명 실패 방지
  correctClockSkew: true,

  // (선택) 네트워크 안정성
  httpOptions: {
    timeout: 30000,
    connectTimeout: 10000,
  },
});

/* ============================
   Health check
   ============================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "server alive" });
});

/* ============================
   ENV CHECK (Railway 변수 점검)
   - 실제 값 전체 노출은 위험하니 일부만 보여줌
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
    NOTE:
      "Unauthorized면 대개 서명/권한 문제입니다. 지금은 path-style 강제(s3ForcePathStyle)로 먼저 잡습니다.",
  });
});

/* ============================
   R2 TEST
   ============================ */
app.get("/r2-test", async (req, res) => {
  try {
    if (!r2Bucket) {
      return res.status(500).json({
        ok: false,
        error: "Missing required env: R2_BUCKET",
        hint:
          "Railway Variables에 R2_BUCKET 값이 있는지 확인하고, 배포가 최신 커밋인지 확인하세요.",
      });
    }

    const data = await s3
      .listObjectsV2({
        Bucket: r2Bucket,
        MaxKeys: 10,
      })
      .promise();

    res.json({
      ok: true,
      bucket: r2Bucket,
      count: (data.Contents || []).length,
      keys: (data.Contents || []).map((o) => o.Key),
    });
  } catch (e) {
    // ✅ Cloudflare/R2 쪽 에러는 code/statusCode가 힌트가 됩니다
    res.status(500).json({
      ok: false,
      error: e.message,
      code: e.code || null,
      statusCode: e.statusCode || null,
      requestId: e.requestId || null,
      note:
        "Unauthorized/SignatureDoesNotMatch면 키/권한/서명(주소스타일) 문제입니다. 이번 수정에서 path-style을 강제했습니다.",
    });
  }
});

/* ============================
   R2 UPLOAD (POST)
   ============================ */
app.post("/r2-upload", async (req, res) => {
  try {
    const { key, contentType, base64 } = req.body || {};

    if (!r2Bucket) {
      return res.status(500).json({
        ok: false,
        error: "Missing required env: R2_BUCKET",
      });
    }
    if (!key) {
      return res.status(400).json({
        ok: false,
        error: "Missing 'key' in body",
      });
    }
    if (!base64) {
      return res.status(400).json({
        ok: false,
        error: "Missing 'base64' in body",
      });
    }

    const buffer = Buffer.from(base64, "base64");

    await s3
      .putObject({
        Bucket: r2Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
      })
      .promise();

    res.json({ ok: true, bucket: r2Bucket, key, size: buffer.length });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
      code: e.code || null,
      statusCode: e.statusCode || null,
      requestId: e.requestId || null,
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
  console.log("R2 path-style:", true);
});
