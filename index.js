import express from "express";
import AWS from "aws-sdk";
import { exec } from "child_process";

const app = express();
const port = process.env.PORT || 3000;

/* ---------- R2 (S3 compatible, AWS SDK v2) ---------- */
const s3 = new AWS.S3({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: "auto",
  signatureVersion: "v4",
});

/* ---------- health ---------- */
app.get("/", (req, res) => {
  res.json({ ok: true });
});

/* ---------- ffmpeg version ---------- */
app.get("/ffmpeg-version", (req, res) => {
  exec("ffmpeg -version", (error, stdout) => {
    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
    res.json({ ok: true, output: stdout.split("\n")[0] });
  });
});

/* ---------- r2 test ---------- */
app.get("/r2-test", async (req, res) => {
  try {
    await s3
      .putObject({
        Bucket: process.env.R2_BUCKET,
        Key: "test.txt",
        Body: "r2 connection test",
        ContentType: "text/plain",
      })
      .promise();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/* ---------- test render ---------- */
app.get("/test-render", (req, res) => {
  exec(
    "ffmpeg -f lavfi -i color=c=black:s=720x1280:d=2 -vf drawtext=text=test:fontcolor=white:fontsize=60:x=100:y=600 /tmp/test.mp4",
    (error) => {
      if (error) {
        return res.status(500).json({ ok: false, error: error.message });
      }
      res.json({ ok: true, file: "/tmp/test.mp4" });
    }
  );
});

app.listen(port, () => {
  console.log("server running on port", port);
});
