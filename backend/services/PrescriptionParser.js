// // services/PrescriptionParser.js
// import fs from "fs/promises";
// import sharp from "sharp";
// import Tesseract from "tesseract.js";
// import fetch from "node-fetch"; // ✅ Fix: ensures fetch works even on Node < 18

// /**
//  * Production-Ready Prescription Parser (Groq Based)
//  * - Supports PDF text extraction (pdfjs)
//  * - Falls back to OCR for scanned PDFs
//  * - OCR for images
//  * - Extracts structured JSON via Groq
//  */
// export class PrescriptionParser {
//   async parsePrescription(filePath, fileType) {
//     try {
//       console.log(`📄 Parsing prescription: ${filePath} (${fileType})`);

//       let extractedText = "";

//       if (fileType === "application/pdf") {
//         extractedText = await this.parsePdfToText(filePath);

//         // If PDF text is empty/too small, treat as scanned and OCR it
//         if (!extractedText || extractedText.trim().length < 20) {
//           console.log("📷 PDF looks scanned. Running OCR...");
//           extractedText = await this.ocrPdf(filePath);
//         }
//       } else if (fileType && fileType.startsWith("image/")) {
//         // ✅ HEIC/HEIF often fails depending on sharp build; error handled cleanly
//         extractedText = await this.ocrImage(filePath);
//       } else {
//         return { success: false, error: "Unsupported file type" };
//       }

//       console.log("📝 Extracted text preview:", extractedText.substring(0, 200));

//       const structured = await this.extractWithGroq(extractedText);

//       return {
//         success: Array.isArray(structured.medicines) && structured.medicines.length > 0,
//         rawText: extractedText,
//         medicines: structured.medicines || [],
//         patientInfo: structured.patientInfo || {},
//       };
//     } catch (err) {
//       console.error("❌ Error parsing prescription:", err);
//       return { success: false, error: err?.message || "Failed to parse prescription" };
//     }
//   }

//   // ---------------- PDF TEXT EXTRACTION ----------------

//   async parsePdfToText(filePath) {
//     const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
//     const dataBuffer = await fs.readFile(filePath);
//     const uint8Array = new Uint8Array(dataBuffer);

//     const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
//     const pdf = await loadingTask.promise;

//     let fullText = "";

//     for (let i = 1; i <= pdf.numPages; i++) {
//       const page = await pdf.getPage(i);
//       const content = await page.getTextContent();
//       const pageText = content.items.map((it) => it.str || "").join(" ");
//       fullText += pageText + "\n";
//     }

//     return fullText.trim();
//   }

//   // ---------------- OCR PDF (Render pages -> OCR) ----------------

//   async ocrPdf(filePath) {
//     // ✅ If native deps for canvas aren't available, throw a clear error
//     const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
//     const { createCanvas } = await import("@napi-rs/canvas");

//     const dataBuffer = await fs.readFile(filePath);
//     const uint8Array = new Uint8Array(dataBuffer);

//     const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
//     const pdf = await loadingTask.promise;

//     let combined = "";

//     // ✅ OCR only first 2 pages for speed (you can increase later)
//     for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
//       const page = await pdf.getPage(i);
//       const viewport = page.getViewport({ scale: 3.0 });

//       const canvas = createCanvas(viewport.width, viewport.height);
//       const ctx = canvas.getContext("2d");

//       await page.render({ canvasContext: ctx, viewport }).promise;

//       const imgBuffer = canvas.toBuffer("image/png");

//       const tempPath = `${filePath}_page_${i}.png`;
//       await fs.writeFile(tempPath, imgBuffer);

//       const text = await this.ocrImage(tempPath);
//       combined += text + "\n";

//       await fs.unlink(tempPath).catch(() => {});
//     }

//     return combined.trim();
//   }

//   // ---------------- OCR IMAGE ----------------

//   async ocrImage(filePath) {
//     const processed = `${filePath}_processed.png`;

//     try {
//       // ✅ Fix: normalize() is the standard method name (normalise may fail on some versions)
//       await sharp(filePath)
//         .greyscale()
//         .normalize()
//         .sharpen()                         // helps thin text
//         .threshold(180)                    // binarize; tune 160–200
//         .resize({ width: 2000, withoutEnlargement: true }) // optional
//         .png()
//         .toFile(processed);
//     } catch (e) {
//       // Common cause: HEIC/HEIF unsupported by sharp build
//       throw new Error(`Image preprocessing failed (sharp): ${e?.message || e}`);
//     }

//     try {
//       const result = await Tesseract.recognize(processed, "eng+deu");
//       const text = result?.data?.text || "";
//       return text.trim();
//     } finally {
//       await fs.unlink(processed).catch(() => {});
//     }
//   }

//   // ---------------- GROQ LLM EXTRACTION ----------------

//   async extractWithGroq(text) {
//     const apiKey = process.env.GROQ_API_KEY;
//     const model = process.env.LLM_MODEL || "llama-3.1-70b-versatile";

//     if (!apiKey) {
//       throw new Error("GROQ_API_KEY missing in .env");
//     }

//     // Guard: extremely small OCR text will just produce empty output
//     if (!text || text.trim().length < 10) {
//       return { medicines: [], patientInfo: {} };
//     }

//     const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${apiKey}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model,
//         temperature: 0,
//         response_format: { type: "json_object" },
//         messages: [
//           {
//             role: "system",
//             content: `
// You extract structured prescription data.
// Return ONLY valid JSON:

// {
//   "patientInfo": {
//     "patientName": string|null,
//     "date": string|null,
//     "doctorName": string|null
//   },
//   "medicines": [
//     {
//       "name": string,
//       "dosage": string|null,
//       "quantity": number|null
//     }
//   ]
// }

// Rules:
// - Do NOT include instruction phrases like "Once daily".
// - Do NOT guess quantity as 30.
// - Only use numbers explicitly present.
// `,
//           },
//           { role: "user", content: text },
//         ],
//       }),
//     });

//     if (!response.ok) {
//       const errTxt = await response.text().catch(() => "");
//       console.error("Groq Error:", response.status, errTxt);
//       return { medicines: [], patientInfo: {} };
//     }

//     const data = await response.json();

//     const content = data?.choices?.[0]?.message?.content;
//     if (!content) return { medicines: [], patientInfo: {} };

//     try {
//       const parsed = JSON.parse(content);
//       return {
//         medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
//         patientInfo: parsed.patientInfo || {},
//       };
//     } catch (e) {
//       console.error("Groq JSON parse failed:", e, "Raw:", content?.slice?.(0, 300));
//       return { medicines: [], patientInfo: {} };
//     }
//   }
// }







// services/PrescriptionParser.js
import fs from "fs/promises";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import fetch from "node-fetch";

/**
 * Production-Ready Prescription Parser
 * 
 * Strategy (in order):
 * 1. Images → Try Groq Vision (LLaMA vision model) first — handles handwriting
 * 2. Images → Fall back to Tesseract OCR + Groq text extraction if vision fails
 * 3. PDFs  → Extract text with pdfjs, fall back to OCR if scanned
 */
export class PrescriptionParser {
  async parsePrescription(filePath, fileType) {
    try {
      console.log(`📄 Parsing prescription: ${filePath} (${fileType})`);

      // ── IMAGE ────────────────────────────────────────────────────────────────
      if (fileType && fileType.startsWith("image/")) {
        // Strategy 1: Send image directly to Groq vision — best for handwriting
        const visionResult = await this.extractWithGroqVision(filePath);
        if (visionResult?.medicines?.length > 0) {
          console.log("✅ Vision model extracted medicines successfully");
          return {
            success: true,
            rawText: "[extracted via vision model]",
            medicines: visionResult.medicines,
            patientInfo: visionResult.patientInfo || {},
          };
        }

        // Strategy 2: OCR fallback → Groq text extraction
        console.log("⚠️ Vision model found no medicines, falling back to OCR...");
        const ocrText = await this.ocrImage(filePath);
        console.log("📝 OCR text preview:", ocrText.substring(0, 200));
        const structured = await this.extractWithGroq(ocrText);
        return {
          success: Array.isArray(structured.medicines) && structured.medicines.length > 0,
          rawText: ocrText,
          medicines: structured.medicines || [],
          patientInfo: structured.patientInfo || {},
        };
      }

      // ── PDF ──────────────────────────────────────────────────────────────────
      if (fileType === "application/pdf") {
        let extractedText = await this.parsePdfToText(filePath);

        if (!extractedText || extractedText.trim().length < 20) {
          console.log("📷 PDF looks scanned. Running OCR...");
          extractedText = await this.ocrPdf(filePath);
        }

        console.log("📝 PDF text preview:", extractedText.substring(0, 200));
        const structured = await this.extractWithGroq(extractedText);
        return {
          success: Array.isArray(structured.medicines) && structured.medicines.length > 0,
          rawText: extractedText,
          medicines: structured.medicines || [],
          patientInfo: structured.patientInfo || {},
        };
      }

      return { success: false, error: "Unsupported file type" };

    } catch (err) {
      console.error("❌ Error parsing prescription:", err);
      return { success: false, error: err?.message || "Failed to parse prescription" };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROQ VISION — Best for handwritten doctor prescriptions
  // Uses LLaMA vision to read the image directly without OCR
  // ═══════════════════════════════════════════════════════════════════════════

  async extractWithGroqVision(filePath) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY missing in .env");

    try {
      // Preprocess image for better vision model results
      const processedPath = `${filePath}_vision.jpg`;
      await sharp(filePath)
        .rotate()                          // auto-rotate based on EXIF
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toFile(processedPath);

      const imageBuffer = await fs.readFile(processedPath);
      const base64Image = imageBuffer.toString("base64");
      await fs.unlink(processedPath).catch(() => {});

      // Detect mime type for base64 header
      const mimeType = "image/jpeg";

      console.log("🔭 Sending image to Groq vision model...");

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct", // Groq's vision model
          temperature: 0,
          max_tokens: 1024,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
                {
                  type: "text",
                  text: `This is a doctor's handwritten prescription. 
Extract ALL medicine names you can see, even if the handwriting is difficult.

Common medicine name patterns to look for:
- Brand names (e.g. Allegra, Crocin, Wysolone, Pacimol, Dolo, Pan, Azithral)
- Names followed by numbers (e.g. "Allegra 120", "Pacimol 650", "Pan 40")
- Even partially readable names — make your best guess

Return ONLY valid JSON in this exact format:
{
  "patientInfo": {
    "patientName": string or null,
    "date": string or null,
    "doctorName": string or null
  },
  "medicines": [
    {
      "name": "medicine name with dosage if visible",
      "dosage": string or null,
      "quantity": number or null
    }
  ]
}

Rules:
- Include ALL medicines you can identify, even partially readable ones
- Do NOT include instructions like "once daily" in the name field
- If quantity number is circled on the prescription, use that as quantity
- Return empty medicines array [] if truly nothing is readable`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errTxt = await response.text().catch(() => "");
        console.error("Groq Vision Error:", response.status, errTxt);
        return null;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      console.log("🔭 Vision extracted:", JSON.stringify(parsed.medicines));
      return {
        medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
        patientInfo: parsed.patientInfo || {},
      };

    } catch (e) {
      console.error("❌ Groq Vision failed:", e?.message || e);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF TEXT EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════

  async parsePdfToText(filePath) {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const dataBuffer = await fs.readFile(filePath);
    const uint8Array = new Uint8Array(dataBuffer);

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it) => it.str || "").join(" ");
      fullText += pageText + "\n";
    }

    return fullText.trim();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OCR PDF (render pages → image → OCR)
  // ═══════════════════════════════════════════════════════════════════════════

  async ocrPdf(filePath) {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = await import("@napi-rs/canvas");

    const dataBuffer = await fs.readFile(filePath);
    const uint8Array = new Uint8Array(dataBuffer);

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    let combined = "";

    for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 3.0 });

      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");

      await page.render({ canvasContext: ctx, viewport }).promise;

      const imgBuffer = canvas.toBuffer("image/png");
      const tempPath = `${filePath}_page_${i}.png`;
      await fs.writeFile(tempPath, imgBuffer);

      // Try vision model on PDF page image too
      const visionResult = await this.extractWithGroqVision(tempPath);
      if (visionResult?.medicines?.length > 0) {
        combined += visionResult.medicines.map(m => m.name).join("\n") + "\n";
      } else {
        const text = await this.ocrImage(tempPath);
        combined += text + "\n";
      }

      await fs.unlink(tempPath).catch(() => {});
    }

    return combined.trim();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OCR IMAGE — Tesseract fallback with enhanced preprocessing
  // ═══════════════════════════════════════════════════════════════════════════

  async ocrImage(filePath) {
    const processed = `${filePath}_processed.png`;

    try {
      await sharp(filePath)
        .rotate()                                         // fix EXIF rotation
        .greyscale()
        .normalize()                                      // auto contrast
        .sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 })      // sharpen edges
        .gamma(1.5)                                       // brighten mid-tones
        .linear(1.3, -30)                                 // boost contrast
        .threshold(150)                                   // binarize (tune 130–170)
        .resize({ width: 2400, withoutEnlargement: true })
        .png()
        .toFile(processed);
    } catch (e) {
      throw new Error(`Image preprocessing failed (sharp): ${e?.message || e}`);
    }

    try {
      const result = await Tesseract.recognize(processed, "eng", {
        tessedit_pageseg_mode: "6",        // assume uniform block of text
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/-() ",
        preserve_interword_spaces: "1",
      });
      return (result?.data?.text || "").trim();
    } finally {
      await fs.unlink(processed).catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROQ TEXT EXTRACTION — for when we have raw OCR text
  // ═══════════════════════════════════════════════════════════════════════════

  async extractWithGroq(text) {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.LLM_MODEL || "llama-3.1-70b-versatile";

    if (!apiKey) throw new Error("GROQ_API_KEY missing in .env");
    if (!text || text.trim().length < 10) return { medicines: [], patientInfo: {} };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You extract structured prescription data from OCR text (which may have errors).
            
Return ONLY valid JSON:
{
  "patientInfo": {
    "patientName": string|null,
    "date": string|null,
    "doctorName": string|null
  },
  "medicines": [
    {
      "name": string,
      "dosage": string|null,
      "quantity": number|null
    }
  ]
}

Rules:
- OCR text may have errors — use context to infer medicine names
- Common corrections: "Allegra", "Wysolone", "Pacimol", "Dolo", "Pan", "Azithral"
- Do NOT include instruction phrases like "Once daily" in name field
- Only use quantity numbers explicitly present in text
- Return all medicines you can identify`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      const errTxt = await response.text().catch(() => "");
      console.error("Groq Error:", response.status, errTxt);
      return { medicines: [], patientInfo: {} };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { medicines: [], patientInfo: {} };

    try {
      const parsed = JSON.parse(content);
      return {
        medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
        patientInfo: parsed.patientInfo || {},
      };
    } catch (e) {
      console.error("Groq JSON parse failed:", e, "Raw:", content?.slice?.(0, 300));
      return { medicines: [], patientInfo: {} };
    }
  }
}