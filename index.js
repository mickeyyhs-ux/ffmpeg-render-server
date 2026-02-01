import express from "express";
import AWS from "aws-sdk";

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

/* ---------- health check (중요) ---------- */
app.get("/", (req, res) => {
  res.send("OK");
});

/* ---------- r2 overwrite test ---------- */
app.get("/r2-test", async (req, res) => {
  try {
    await s3
      .putObject({
        Bucket: process.env.R
