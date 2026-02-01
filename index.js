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
const r2Endpoint =
  r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : null;

const s3 = new AWS.S3({
  endpoint: r2Endpoint,
  accessKeyId: r2AccessKeyId,
  secretAccessKey: r2SecretAccessKey,
  region: "auto",
  signatureVersion: "v4",
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
  });
});

/* ============================
   R2 TEST
   - 여기서 Bucket 누락이면 100% 코드/ENV 참조 문제
   ============================ */
app.get("/r2-test", async (req, res) => {
  try {
    // 1) 버킷 자체가 비었는지 먼저 확인 (지금 현성님이 겪는 에러의 핵심)
    if (!r2Bucket) {
      return res.status(500).json({
        ok: false,
        error: "Missing required env: R2_BUCKET",
        hint:
          "Railway Variables에 R2_BUCKET 값이 있는지 확인하고, 배포가 최신 커밋인지 확인하세요.",
      });
    }

    // 2) S3 List로 실제 통신 테스트
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
    res.status(500).json({
      ok: false,
      error: e.message,
      note:
        "여기서 Signature/AccessDenied가 나오면 키/권한/endpoint 문제입니다. Bucket 에러면 코드가 Bucket을 안 넣은 겁니다.",
    });
  }
});

/* ============================
   R2 UPLOAD (POST)
   - 자동화 공장에 쓰려고 "파일 업로드" 루트도 함께 포함
   - body 예시:
     {
       "key": "audio/test.mp3",
       "contentType": "audio/mpeg",
       "base64": "...."   // 파일을 base64로 넣는 방식
     }
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
    res.status(500).json({ ok: false, error: e.message });
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
