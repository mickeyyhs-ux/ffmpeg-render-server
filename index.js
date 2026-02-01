import express from "express";
import AWS from "aws-sdk";

const app = express();
const port = process.env.PORT || 3000;

// ✅ R2(S3) 연결
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

// ✅ "덮어쓰기 테스트" (항상 같은 Key로 putObject)
app.get("/r2-test", async (req, res) => {
  try {
    await s3
      .putObject({
        Bucket: process.env.R2_BUCKET,
        Key: "render/output.mp4", // ✅ 이게 고정이라 무조건 덮어씀
        Body: Buffer.from("THIS WILL BE OVERWRITTEN"),
        ContentType: "video/mp4",
      })
      .promise();

    res.json({
      ok: true,
      message: "같은 Key(render/output.mp4)라서 무조건 덮어씀",
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
});

app.listen(port, () => {
  console.log("server running on port", port);
});
