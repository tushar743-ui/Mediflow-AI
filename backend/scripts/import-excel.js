// import XLSX from 'xlsx';
// import { query } from '../config/database.js';

// async function importExcel(filePath) {
//   try {
//     console.log(`📂 Reading Excel file: ${filePath}`);

//     // Read Excel file
//     const workbook = XLSX.readFile(filePath);
//     const sheetName = workbook.SheetNames[0]; // First sheet
//     const worksheet = workbook.Sheets[sheetName];

//     // Convert to JSON
//     const records = XLSX.utils.sheet_to_json(worksheet);

//     console.log(`📦 Found ${records.length} records in sheet "${sheetName}"`);

//     let success = 0;
//     let failed = 0;

//     for (const record of records) {
//       try {
//         await query(`
//           INSERT INTO medicines (
//             medicine_name, generic_name, category, prescription_required,
//             stock_quantity, unit_type, price, manufacturer, description
//           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
//         `, [
//           record.medicine_name,
//           record.generic_name || record.medicine_name,
//           record.category || 'Other',
//           record.prescription_required === true || 
//           record.prescription_required === 'TRUE' || 
//           record.prescription_required === 'true',
//           parseInt(record.stock_quantity) || 100,
//           record.unit_type || 'tablets',
//           parseFloat(record.price) || 10.00,
//           record.manufacturer || 'Generic Pharma',
//           record.description || ''
//         ]);

//         console.log('✅', record.medicine_name);
//         success++;
//       } catch (error) {
//         console.error('❌', record.medicine_name, '-', error.message);
//         failed++;
//       }
//     }

//     console.log(`\n🎉 Import complete!`);
//     console.log(`✅ Success: ${success}`);
//     console.log(`❌ Failed: ${failed}`);
//     process.exit(0);

//   } catch (error) {
//     console.error('❌ Error reading Excel:', error);
//     process.exit(1);
//   }
// }

// // Check if file path provided
// if (!process.argv[2]) {
//   console.error('❌ Usage: node import-excel.js <path-to-excel-file>');
//   process.exit(1);
// }

// importExcel(process.argv[2]);