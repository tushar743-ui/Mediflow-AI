// import Tesseract from 'tesseract.js';
// import sharp from 'sharp';
// import fs from 'fs/promises';

// /**
//  * Parse prescriptions from images using OCR
//  * (PDF support temporarily disabled due to module issues)
//  */
// export class PrescriptionParser {
  
//   /**
//    * Parse prescription file and extract medicine information
//    */
//   async parsePrescription(filePath, fileType) {
//     try {
//       console.log(`📄 Parsing prescription: ${filePath} (${fileType})`);
      
//       let extractedText = '';
      
//       if (fileType === 'application/pdf') {
       
//         return {
//           success: false,
//           error: 'PDF support coming soon. Please upload an image (JPG/PNG) of your prescription instead.'
//         };
//       } else if (fileType.startsWith('image/')) {
//         extractedText = await this.parseImage(filePath);
//       } else {
//         throw new Error('Unsupported file type');
//       }
      
//       console.log('📝 Extracted text:', extractedText.substring(0, 200) + '...');
      
//       // Extract medicines from text using pattern matching
//       const medicines = this.extractMedicines(extractedText);
      
//       return {
//         success: true,
//         rawText: extractedText,
//         medicines: medicines,
//         patientInfo: this.extractPatientInfo(extractedText)
//       };
      
//     } catch (error) {
//       console.error('Error parsing prescription:', error);
//       return {
//         success: false,
//         error: error.message
//       };
//     }
//   }
  
//   /**
//    * Parse image prescription using OCR
//    */
//   async parseImage(filePath) {
//     try {
//       // Preprocess image for better OCR
//       const processedPath = filePath + '_processed.png';
      
//       await sharp(filePath)
//         .greyscale()
//         .normalise()
//         .linear(1.2, -(128 * 1.2) + 128) // Increase contrast
//         .toFile(processedPath);
      
//       // Run OCR with better configuration
//       const { data: { text } } = await Tesseract.recognize(
//         processedPath,
//         'eng',
//         {
//           logger: info => {
//             if (info.status === 'recognizing text') {
//               console.log(`OCR Progress: ${Math.round(info.progress * 100)}%`);
//             }
//           }
//         }
//       );
      
//       // Clean up processed image
//       await fs.unlink(processedPath).catch(() => {});
      
//       return text;
//     } catch (error) {
//       console.error('OCR Error:', error);
//       throw new Error('Failed to read prescription image. Please ensure the image is clear and try again.');
//     }
//   }
  
//   /**
//    * Extract medicine names and quantities from text
//    */
//   extractMedicines(text) {
//     const medicines = [];
    
//     // Enhanced prescription patterns
//     const patterns = [
//       // "Tab. Metformin 500mg - 60 tablets"
//       /(?:Tab\.|Tablet|Cap\.|Capsule|Syrup|Injection|Inj\.)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+\s*(?:mg|mcg|µg|g|ml|%)?)\s*[\-–—]*\s*(\d+)?\s*(?:tablets?|capsules?|ml|units?)?/gi,
      
//       // "Metformin 500mg x 60"
//       /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+\s*(?:mg|mcg|µg|g|ml|%))\s*[xX×]\s*(\d+)/gi,
      
//       // "1. Metformin 500mg - 60 tablets"
//       /\d+[\.)]\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+\s*(?:mg|mcg|µg|g|ml|%))[\s\-–—]*(\d+)?\s*(?:tablets?|capsules?|ml)?/gi,
      
//       // Simple "Metformin 500mg"
//       /([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)?)\s+(\d+\s*(?:mg|mcg|µg|g|ml|%))/g
//     ];
    
//     patterns.forEach(pattern => {
//       let match;
//       const regex = new RegExp(pattern.source, pattern.flags);
//       while ((match = regex.exec(text)) !== null) {
//         const medicineName = match[1].trim();
//         const dosage = match[2] ? match[2].trim() : '';
//         const quantity = match[3] ? parseInt(match[3]) : 30;
        
//         // Filter out common non-medicine words
//         const blacklist = ['patient', 'doctor', 'date', 'prescription', 'hospital', 'clinic'];
//         if (blacklist.some(word => medicineName.toLowerCase().includes(word))) {
//           continue;
//         }
        
//         // Avoid duplicates
//         if (!medicines.find(m => m.name.toLowerCase() === medicineName.toLowerCase())) {
//           medicines.push({
//             name: medicineName,
//             dosage: dosage,
//             quantity: quantity
//           });
//         }
//       }
//     });
    
//     return medicines;
//   }
  
//   /**
//    * Extract patient information
//    */
//   extractPatientInfo(text) {
//     const info = {};
    
//     // Extract patient name
//     const nameMatch = text.match(/Patient\s*(?:Name)?:\s*([A-Za-z\s]+)/i);
//     if (nameMatch) {
//       info.patientName = nameMatch[1].trim();
//     }
    
//     // Extract date
//     const dateMatch = text.match(/Date:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
//     if (dateMatch) {
//       info.date = dateMatch[1];
//     }
    
//     // Extract doctor name
//     const doctorMatch = text.match(/(?:Dr\.?|Doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
//     if (doctorMatch) {
//       info.doctorName = doctorMatch[1].trim();
//     }
    
//     return info;
//   }
// }

// export default PrescriptionParser;












// services/PrescriptionParser.js
import fs from "fs/promises";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import fetch from "node-fetch"; // ✅ Fix: ensures fetch works even on Node < 18

/**
 * Production-Ready Prescription Parser (Groq Based)
 * - Supports PDF text extraction (pdfjs)
 * - Falls back to OCR for scanned PDFs
 * - OCR for images
 * - Extracts structured JSON via Groq
 */
export class PrescriptionParser {
  async parsePrescription(filePath, fileType) {
    try {
      console.log(`📄 Parsing prescription: ${filePath} (${fileType})`);

      let extractedText = "";

      if (fileType === "application/pdf") {
        extractedText = await this.parsePdfToText(filePath);

        // If PDF text is empty/too small, treat as scanned and OCR it
        if (!extractedText || extractedText.trim().length < 20) {
          console.log("📷 PDF looks scanned. Running OCR...");
          extractedText = await this.ocrPdf(filePath);
        }
      } else if (fileType && fileType.startsWith("image/")) {
        // ✅ HEIC/HEIF often fails depending on sharp build; error handled cleanly
        extractedText = await this.ocrImage(filePath);
      } else {
        return { success: false, error: "Unsupported file type" };
      }

      console.log("📝 Extracted text preview:", extractedText.substring(0, 200));

      const structured = await this.extractWithGroq(extractedText);

      return {
        success: Array.isArray(structured.medicines) && structured.medicines.length > 0,
        rawText: extractedText,
        medicines: structured.medicines || [],
        patientInfo: structured.patientInfo || {},
      };
    } catch (err) {
      console.error("❌ Error parsing prescription:", err);
      return { success: false, error: err?.message || "Failed to parse prescription" };
    }
  }

  // ---------------- PDF TEXT EXTRACTION ----------------

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

  // ---------------- OCR PDF (Render pages -> OCR) ----------------

  async ocrPdf(filePath) {
    // ✅ If native deps for canvas aren't available, throw a clear error
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = await import("@napi-rs/canvas");

    const dataBuffer = await fs.readFile(filePath);
    const uint8Array = new Uint8Array(dataBuffer);

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    let combined = "";

    // ✅ OCR only first 2 pages for speed (you can increase later)
    for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");

      await page.render({ canvasContext: ctx, viewport }).promise;

      const imgBuffer = canvas.toBuffer("image/png");

      const tempPath = `${filePath}_page_${i}.png`;
      await fs.writeFile(tempPath, imgBuffer);

      const text = await this.ocrImage(tempPath);
      combined += text + "\n";

      await fs.unlink(tempPath).catch(() => {});
    }

    return combined.trim();
  }

  // ---------------- OCR IMAGE ----------------

  async ocrImage(filePath) {
    const processed = `${filePath}_processed.png`;

    try {
      // ✅ Fix: normalize() is the standard method name (normalise may fail on some versions)
      await sharp(filePath)
        .greyscale()
        .normalize()
        .png()
        .toFile(processed);
    } catch (e) {
      // Common cause: HEIC/HEIF unsupported by sharp build
      throw new Error(`Image preprocessing failed (sharp): ${e?.message || e}`);
    }

    try {
      const result = await Tesseract.recognize(processed, "eng");
      const text = result?.data?.text || "";
      return text.trim();
    } finally {
      await fs.unlink(processed).catch(() => {});
    }
  }

  // ---------------- GROQ LLM EXTRACTION ----------------

  async extractWithGroq(text) {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.LLM_MODEL || "llama-3.1-70b-versatile";

    if (!apiKey) {
      throw new Error("GROQ_API_KEY missing in .env");
    }

    // Guard: extremely small OCR text will just produce empty output
    if (!text || text.trim().length < 10) {
      return { medicines: [], patientInfo: {} };
    }

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
            content: `
You extract structured prescription data.
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
- Do NOT include instruction phrases like "Once daily".
- Do NOT guess quantity as 30.
- Only use numbers explicitly present.
`,
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

