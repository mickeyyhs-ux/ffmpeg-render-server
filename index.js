import express from "express";
import AWS from "aws-sdk";
import { exec } from "child_process";

const app = express();
const port = process.env.PORT || 3000;

/**
 * ✅ 하드코딩(최종 덮어쓰기 버전)
 * - 아래 3개는 Cloudflare R2에서 받은 값 그대로 붙여넣기
 * - BUCKET_NAME 은 R2 버킷 이름(예: audio-factory)
 *
 * ※ 보안상 여기 채팅에 키 올리지 마시고, 코드에만 넣으세요.
 */
const R2_ACCOUNT_ID = "44c0a67547d831e3d3e48ba395c5a47e"; // 예: 44c0a...
const R2_ACCESS_KEY_ID = "a2Nf1G96KtQl2GsD4IIxw4bxU_g5Sv7h1vanozTV"; // 예: a2Nf...
const R2_SECRET_ACCESS_KEY = "ef5007c4ccf2627b580e4312ca438fd8a991c8236dbae126c7ec1a98a06414b3"; // 예: ef500...
const R2_BUCKET = "audio-factory"; // ✅ 실제 버킷 이름

/* ---------- R2 (S3 compatible, AWS SDK v2) ---------- */
const s3 = new AWS.S3({
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  region: "auto",
  signatureVersion: "v4",
});

/* ---------- health ---------- */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "ffmpeg-render-server alive" });
});

/* ---------- env check (진짜로 값이 들어왔는지 확인용) ---------- */
app.get("/env-check", (req, res) => {
  res.json({
    ok: true,
    hardcoded: {
      has_account: !!R2_ACCOUNT_ID && !R2_ACCOUNT_ID.includes("PASTE_"),
      has_access: !!R2_ACCESS_KEY_ID && !R2_ACCESS_KEY_ID.includes("PASTE_"),
      has_secret: !!R2_SECRET_ACCESS_KEY && !R2_SECRET_ACCESS_KEY.includes("PASTE_"),
      bucket: R2_BUCKET,
    },
    process_env: {
      PORT: process.env.PORT || null,
      R2_BUCKET: process.env.R2_BUCKET || null,
    },
  });
});

/* ---------- ffmpeg version ---------- */
app.get("/ffmpeg-version", (req, res) => {
  exec("ffmpeg -version", (error, stdout) => {
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.json({ ok: true, output: stdout.split("\n")[0] });
  });
});

/**
 * ✅ 덮어쓰기 테스트
 * - 같은 Key("render/output.mp4")로 계속 putObject 하면 “무조건 덮어쓰기”
 * - 지금은 내용이 문자열이지만, 나중에 mp4 바이너리로 바꾸면 됨
 */
app.get("/r2-test", async (req, res) => {
  try {
    const key = "render/output.mp4"; // ✅ 이 Key가 같으면 항상 overwrite

    await s3
      .putObject({
        Bucket: R2_BUCKET, // ✅ 하드코딩 버킷
        Key: key,
        Body: "THIS WILL BE OVERWRITTEN",
        ContentType: "application/octet-stream",
      })
      .promise();

    res.json({
      ok: true,
      message: "같은 Key라서 무조건 덮어씀",
      bucket: R2_BUCKET,
      key,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ---------- test render (로컬 /tmp/test.mp4 생성만) ---------- */
app.get("/test-render", (req, res) => {
  exec(
    "ffmpeg -f lavfi -i color=c=black:s=720x1280:d=2 -vf drawtext=text=hello:fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2 /tmp/test.mp4",
    (error) => {
      if (error) return res.status(500).json({ ok: false, error: error.message });
      res.json({ ok: true, file: "/tmp/test.mp4" });
    }
  );
});

app.listen(port, () => {
  console.log("server running on port", port);
});
