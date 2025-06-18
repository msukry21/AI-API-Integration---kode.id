const express = require("express");
const dotenv = require("dotenv");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { MIMEType } = require("util");
const { get } = require("http");

dotenv.config();
const app = express();
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

const upload = multer({ dest: "uploads/" });

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
// ---------------------------------------------------------Text---------------------------------------------------------
app.post("/generate-text", async (req, res) => {
  const { prompt } = req.body;
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------Image---------------------------------------------------------
function imageToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

// Remove this incorrect import:
// const { MIMEType } = require("util");

// This function needs to return standard MIME type strings
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"; // Corrected: Return the actual string "image/jpeg"
    case ".png":
      return "image/png"; // Corrected: Return the actual string "image/png"
    case ".gif":
      return "image/gif"; // Corrected: Return the actual string "image/gif"
    default:
      // It's also good practice to include WebP if you anticipate it
      if (ext === ".webp") {
        return "image/webp";
      }
      // Consider throwing an error or returning a default if type is not recognized
      throw new Error(`Unsupported image type: ${ext}`);
  }
}

app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  const prompt = req.body.prompt || "Describe the image";
  try {
    const mimeType = getMimeType(req.file.originalname);
    const image = imageToGenerativePart(req.file.path, mimeType);
    const result = await model.generateContent([prompt, image]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    fs.unlinkSync(req.file.path); // Clean up the uploaded file
  }
});

// ---------------------------------------------------------Documents---------------------------------------------------------
app.post(
  "/generate-from-documents",
  upload.single("documents"),
  async (req, res) => {
    const filePath = req.files.path;
    const Buffer = fs.readFileSync(filePath);
    const base64Data = Buffer.toString("base64");
    const mimeType = req.file.mimetype;

    try {
      const documentPart = {
        inlineData: { data: base64Data, mimeType },
      };

      const result = await model.generateContent([
        "Analyze these documents",
        documentPart,
      ]);
      const response = await result.response;
      res.json({ output: response.text() });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      fs.unlinkSync(filePath); // Clean
    }
  }
);
// ---------------------------------------------------------Audio---------------------------------------------------------
app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
  const audioBuffer = fs.readFileSync(req.file.path);
  const base64Audio = audioBuffer.toString("base64");
  const audioPart = {
    inlineData: {
      data: base64Audio,
      mimeType: req.file.mimetype,
    },
  };

  try {
    const result = await model.generateContent([
      "Transcribe or analyze the following audio",
      audioPart,
    ]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    fs.unlinkSync(req.file.path);
  }
});
