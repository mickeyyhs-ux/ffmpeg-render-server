import express from "express";
import AWS from "aws-sdk";

const app = express();
const port = 3000;

/* ===============================
   🔥 R2 완전 하드코딩 (확정판)
   =============================== */
const s3 = new AWS.S3({
  endpoint: "https://44c0a67547d831e3d3e48ba395c5a47e.r2.cloudflarestorage.com",
  accessKeyId: "a2Nf1969K0tQ12GsD4IIxw4bxU_g5Sv7h1vanozTV",
  secretAccessKey: "ef5007c4ccf2627b580e4312ca438fd8a991c8236dbae126c7ec1a98a06414b3",
  region: "auto",
  signatureVersion: "v4",
});

/* ===============================
   health
   =============================== */
app.get("/", (req, res) => {
  res.json({ ok: true });
});

/* ===============================
   R2 overwrite test (무조건 덮어씀)
   =============================== */
app.get("/r2-test", async (req, res) => {
  try {
    await s3.putObject({
      Bucket: "audio-factory",
      Key: "render/output.mp4", // 🔥 같은 Key → 무조건 overwrite
      Body: "THIS WILL BE OVERWRITTEN",
      ContentType: "text/plain",
    }).promise();

    res.json({
      ok: true,
      message: "같은 Key라서 무조건 덮어씀 (SUCCESS)",
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
