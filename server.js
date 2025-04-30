const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

dotenv.config();

const app = express();
const upload = multer({ dest: os.tmpdir() });

// Configure S3 client
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || undefined,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Download file from URL
async function downloadFile(urlStr) {
  const parsedUrl = url.parse(urlStr);
  const pathname = parsedUrl.pathname;
  const fileName = path.basename(pathname);
  const filePath = path.join(os.tmpdir(), fileName);
  const response = await axios.get(urlStr, { responseType: 'stream' });
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);
  });
}

// Create video endpoint
app.post('/create-video', upload.fields([{ name: 'audioFile' }, { name: 'imageFile' }]), async (req, res) => {
  try {
    let audioPath = req.files['audioFile'] ? req.files['audioFile'][0].path : null;
    let imagePath = req.files['imageFile'] ? req.files['imageFile'][0].path : null;

    // Handle URL inputs
    if (req.body.audioUrl) {
      audioPath = await downloadFile(req.body.audioUrl);
    }
    if (req.body.imageUrl) {
      imagePath = await downloadFile(req.body.imageUrl);
    }

    // Validate inputs
    if (!audioPath || !imagePath) {
      return res.status(400).json({ error: 'Both audio and image are required.' });
    }

    // Determine audio base name based on input type
    let audioBaseName;
    if (req.files['audioFile']) {
      // For uploaded files, use the original file name
      audioBaseName = path.basename(req.files['audioFile'][0].originalname, path.extname(req.files['audioFile'][0].originalname));
    } else if (req.body.audioUrl) {
      // For URLs, use the base name from the URL
      const parsedUrl = url.parse(req.body.audioUrl);
      const pathname = parsedUrl.pathname;
      audioBaseName = path.basename(pathname, path.extname(pathname));
    } else {
      return res.status(400).json({ error: 'Audio source must be provided either as file or URL.' });
    }

    const outputPath = path.join(os.tmpdir(), `${audioBaseName}.mp4`);

    // Process with FFMPEG
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions('-loop 1')
        .input(audioPath)
        .videoCodec('libx264')
        .outputOptions('-tune stillimage')
        .outputOptions('-r 30')
        .audioCodec('aac')
        .audioBitrate('192k')
        .outputOptions('-shortest')
        .outputOptions('-pix_fmt yuv420p')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Upload to S3
    const fileContent = fs.readFileSync(outputPath);
    const s3Key = `/video-creation/${audioBaseName}.mp4`;
    await s3.upload({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'video/mp4',
    }).promise();

    // Clean up
    fs.unlinkSync(audioPath);
    fs.unlinkSync(imagePath);
    fs.unlinkSync(outputPath);

    // Generate S3 URL
    let s3Url;
    if (process.env.S3_ENDPOINT) {
      s3Url = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${s3Key}`;
    } else {
      s3Url = `[invalid url, do not cite] ? '.' + process.env.S3_REGION : ''}.amazonaws.com/${s3Key}`;
    }

    res.json({ outputUrl: s3Url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});