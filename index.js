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

if (!r2AccountId) console.warn("WARN: R2_ACCOUNT_ID is missing");
if (!r2AccessKeyId) console.warn("WARN: R2_ACCESS_KEY_ID is missing");
if (!r2SecretAccessKey) console.warn("WARN: R2_SECRET_ACCESS_KEY is missing");
if (!r2Bucket) console.warn("WARN: R2_BUCKET is missing");

// endpoint 구성: https://<accountid>.r2.cloudflarestorage.com
const r2EndpointStr = r2AccountId
  ? `https://${r2AccountId}.r2.cloudflarestorage.com`
  : null;

// ✅ SDK 전역 설정(흔들림 방지)
AWS.config.update({
  signatureVersion: "v4",
  region: "auto",
});

// ✅ endpoint는 객체로 고정 (문자열 파싱 이슈 방지)
const r2Endpoint = r2EndpointStr ? new AWS.Endpoint(r2EndpointStr) : null;

/**
 * ✅ Cloudflare R2에서 "Unauthorized / Signature" 줄이는 핵심 포인트
 * - endpoint: AWS.Endpoint로 고정
 * - s3ForcePathStyle: true
 * - correctClockSkew: true
 */
const s3 = new AWS.S3({
  endpoint: r2Endpoint,
  accessKeyId: r2AccessKeyId,
  secretAccessKey: r2SecretAccessKey,
  signatureVersion: "v4",
  region: "auto",

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
    R2_ENDPOINT: preview(r2EndpointStr),
    NOTE:
      "env는 정상. r2-test가 401이면 권한/토큰타입/API키종류(R2 API Token vs S3 Access Key)/endpoint/서명 문제를 의심.",
  });
});

/* ============================
   R2 TEST (3단계 진단)
   1) HeadBucket: 버킷 접근권한 확인
   2) ListObjects: list 권한 확인(가장 민감)
   3) PutObject(옵션): 쓰기권한 확인
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

    // 1) Bucket 존재/접근 가능 여부(권한/서명 1차 체크)
    await s3.headBucket({ Bucket: r2Bucket }).promise();

    // 2) list 권한 체크 (list 권한이 없으면 여기서 막힐 수 있음)
    let listResult = null;
    try {
      const data = await s3
        .listObjectsV2({ Bucket: r2Bucket, MaxKeys: 10 })
        .promise();
      listResult = {
        count: (data.Contents || []).length,
        keys: (data.Contents || []).map((o) => o.Key),
      };
    } catch (e) {
      listResult = {
        ok: false,
        error: e.message,
        code: e.code || null,
        statusCode: e.statusCode || null,
        note:
          "HeadBucket은 통과했는데 ListObjects가 실패하면: list 권한이 없거나 토큰 스코프가 제한된 경우가 많음.",
      };
    }

    res.json({
      ok: true,
      bucket: r2Bucket,
      headBucket: "ok",
      listObjects: listResult,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
      code: e.code || null,
      statusCode: e.statusCode || null,
      requestId: e.requestId || null,
      debug: {
        endpoint: r2EndpointStr,
        forcePathStyle: true,
        region: "auto",
      },
      note:
        "여기서 401 Unauthorized면 (1) 키 종류가 R2 S3용 AccessKey/Secret이 아닌 경우 (2) 토큰 스코프/권한 문제 (3) endpoint/accountId 혼동을 의심.",
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
      return res.status(500).json({ ok: false, error: "Missing required env: R2_BUCKET" });
    }
    if (!key) {
      return res.status(400).json({ ok: false, error: "Missing 'key' in body" });
    }
    if (!base64) {
      return res.status(400).json({ ok: false, error: "Missing 'base64' in body" });
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
      note:
        "putObject에서 401이면: 키/시크릿 불일치, R2 S3 자격증명(AccessKey/Secret)이 아닌 값 사용, 또는 endpoint/accountId 혼동을 의심.",
    });
  }
});

/* ============================
   Start server
   ============================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server listening on ${PORT}`);
  console.log("R2 endpoint:", r2EndpointStr);
  console.log("R2 bucket:", r2Bucket);
  console.log("R2 path-style:", true);
});
