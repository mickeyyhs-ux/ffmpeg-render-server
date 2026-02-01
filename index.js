const express = require("express");
const AWS = require("aws-sdk");

const app = express();
const port = process.env.PORT || 3000;

/* ---------- R2 (S3 compatible) ---------- */
const s3 = new AWS.S3({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  region: "auto",
  signatureVersion: "v4",
});

/* ---------- health ---------- */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "server alive" });
});

/* ---------- r2 overwrite test ---------- */
app.get("/r2-test", async (req, res) => {
  try {
    await s3
      .putObject({
        Bucket: process.env.R2_BUCKET,
        Key: "render/output.txt",
        Body: "THIS WILL ALWAYS BE OVERWRITTEN",
        ContentType: "text/plain",
      })
      .promise();

    res.json({
      ok: true,
      message: "same key -> overwritten",
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

app.listen(port, () => {
  console.log("server running on port", port);
});
