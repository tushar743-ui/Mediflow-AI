import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs/promises';

/**
 * Parse prescriptions from images using OCR
 * (PDF support temporarily disabled due to module issues)
 */
export class PrescriptionParser {
  
  /**
   * Parse prescription file and extract medicine information
   */
  async parsePrescription(filePath, fileType) {
    try {
      console.log(`📄 Parsing prescription: ${filePath} (${fileType})`);
      
      let extractedText = '';
      
      if (fileType === 'application/pdf') {
        // For hackathon: Ask user to convert PDF to image
        return {
          success: false,
          error: 'PDF support coming soon. Please upload an image (JPG/PNG) of your prescription instead.'
        };
      } else if (fileType.startsWith('image/')) {
        extractedText = await this.parseImage(filePath);
      } else {
        throw new Error('Unsupported file type');
      }
      
      console.log('📝 Extracted text:', extractedText.substring(0, 200) + '...');
      
      // Extract medicines from text using pattern matching
      const medicines = this.extractMedicines(extractedText);
      
      return {
        success: true,
        rawText: extractedText,
        medicines: medicines,
        patientInfo: this.extractPatientInfo(extractedText)
      };
      
    } catch (error) {
      console.error('Error parsing prescription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Parse image prescription using OCR
   */
  async parseImage(filePath) {
    try {
      // Preprocess image for better OCR
      const processedPath = filePath + '_processed.png';
      
      await sharp(filePath)
        .greyscale()
        .normalise()
        .linear(1.2, -(128 * 1.2) + 128) // Increase contrast
        .toFile(processedPath);
      
      // Run OCR with better configuration
      const { data: { text } } = await Tesseract.recognize(
        processedPath,
        'eng',
        {
          logger: info => {
            if (info.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(info.progress * 100)}%`);
            }
          }
        }
      );
      
      // Clean up processed image
      await fs.unlink(processedPath).catch(() => {});
      
      return text;
    } catch (error) {
      console.error('OCR Error:', error);
      throw new Error('Failed to read prescription image. Please ensure the image is clear and try again.');
    }
  }
  
  /**
   * Extract medicine names and quantities from text
   */
  extractMedicines(text) {
    const medicines = [];
    
    // Enhanced prescription patterns
    const patterns = [
      // "Tab. Metformin 500mg - 60 tablets"
      /(?:Tab\.|Tablet|Cap\.|Capsule|Syrup|Injection|Inj\.)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+\s*(?:mg|mcg|µg|g|ml|%)?)\s*[\-–—]*\s*(\d+)?\s*(?:tablets?|capsules?|ml|units?)?/gi,
      
      // "Metformin 500mg x 60"
      /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+\s*(?:mg|mcg|µg|g|ml|%))\s*[xX×]\s*(\d+)/gi,
      
      // "1. Metformin 500mg - 60 tablets"
      /\d+[\.)]\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+\s*(?:mg|mcg|µg|g|ml|%))[\s\-–—]*(\d+)?\s*(?:tablets?|capsules?|ml)?/gi,
      
      // Simple "Metformin 500mg"
      /([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)?)\s+(\d+\s*(?:mg|mcg|µg|g|ml|%))/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        const medicineName = match[1].trim();
        const dosage = match[2] ? match[2].trim() : '';
        const quantity = match[3] ? parseInt(match[3]) : 30;
        
        // Filter out common non-medicine words
        const blacklist = ['patient', 'doctor', 'date', 'prescription', 'hospital', 'clinic'];
        if (blacklist.some(word => medicineName.toLowerCase().includes(word))) {
          continue;
        }
        
        // Avoid duplicates
        if (!medicines.find(m => m.name.toLowerCase() === medicineName.toLowerCase())) {
          medicines.push({
            name: medicineName,
            dosage: dosage,
            quantity: quantity
          });
        }
      }
    });
    
    return medicines;
  }
  
  /**
   * Extract patient information
   */
  extractPatientInfo(text) {
    const info = {};
    
    // Extract patient name
    const nameMatch = text.match(/Patient\s*(?:Name)?:\s*([A-Za-z\s]+)/i);
    if (nameMatch) {
      info.patientName = nameMatch[1].trim();
    }
    
    // Extract date
    const dateMatch = text.match(/Date:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (dateMatch) {
      info.date = dateMatch[1];
    }
    
    // Extract doctor name
    const doctorMatch = text.match(/(?:Dr\.?|Doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (doctorMatch) {
      info.doctorName = doctorMatch[1].trim();
    }
    
    return info;
  }
}

export default PrescriptionParser;