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
app.listen(PORT, () => {
  console.log("server running on", PORT);
});
