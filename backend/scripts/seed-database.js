import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import pool, { query } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Seed Medicines
    console.log('📦 Seeding medicines...');
    const medicineCSV = fs.readFileSync(
      path.join(__dirname, '../../database/medicine_master.csv'),
      'utf-8'
    );

    const medicineData = Papa.parse(medicineCSV, { header: true }).data;

    for (const medicine of medicineData) {
      if (!medicine.medicine_name) continue;

      await query(`
        INSERT INTO medicines 
        (medicine_name, generic_name, stock_quantity, unit_type, prescription_required, dosage_info, category, price, manufacturer)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
      `, [
        medicine.medicine_name,
        medicine.generic_name,
        parseInt(medicine.stock_quantity),
        medicine.unit_type,
        medicine.prescription_required === 'Yes',
        medicine.dosage_info,
        medicine.category,
        parseFloat(medicine.price),
        medicine.manufacturer
      ]);
    }

    console.log(`✅ Seeded ${medicineData.length} medicines\n`);

    // Seed Consumers and Order History
    console.log('👥 Seeding consumers and order history...');
    const orderCSV = fs.readFileSync(
      path.join(__dirname, '../../database/consumer_orders.csv'),
      'utf-8'
    );

    const orderData = Papa.parse(orderCSV, { header: true }).data;

    // Create unique consumers
    const consumers = {};
    for (const order of orderData) {
      if (!order.user_id || !order.consumer_name) continue;
      
      if (!consumers[order.user_id]) {
        consumers[order.user_id] = {
          name: order.consumer_name,
          email: `${order.consumer_name.toLowerCase().replace(/\s+/g, '.')}@email.com`,
          phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`
        };
      }
    }

    // Insert consumers
    for (const [userId, consumer] of Object.entries(consumers)) {
      await query(`
        INSERT INTO consumers (id, name, email, phone)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `, [parseInt(userId), consumer.name, consumer.email, consumer.phone]);
    }

    console.log(`✅ Seeded ${Object.keys(consumers).length} consumers\n`);

    // Create orders from history
    console.log('🛒 Seeding order history...');
    
    for (const orderRecord of orderData) {
      if (!orderRecord.user_id || !orderRecord.medicine_name) continue;

      // Get medicine ID
      const medicineResult = await query(`
        SELECT id, price FROM medicines WHERE medicine_name = $1
      `, [orderRecord.medicine_name]);

      if (medicineResult.rows.length === 0) continue;

      const medicine = medicineResult.rows[0];
      const quantity = parseInt(orderRecord.quantity) || 30;
      const totalAmount = medicine.price * quantity;

      // Create order
      const orderResult = await query(`
        INSERT INTO orders (consumer_id, order_date, status, total_amount)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        parseInt(orderRecord.user_id),
        new Date(orderRecord.purchase_date),
        'fulfilled',
        totalAmount
      ]);

      const orderId = orderResult.rows[0].id;

      // Create order item
      await query(`
        INSERT INTO order_items (order_id, medicine_id, quantity, dosage_frequency, unit_price, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        orderId,
        medicine.id,
        quantity,
        orderRecord.dosage_frequency,
        medicine.price,
        totalAmount
      ]);

      // Create consumption history entry
      const expectedDepletionDays = parseInt(orderRecord.expected_depletion_days) || 30;
      const depletionDate = new Date(orderRecord.purchase_date);
      depletionDate.setDate(depletionDate.getDate() + expectedDepletionDays);

      await query(`
        INSERT INTO consumption_history 
        (consumer_id, medicine_id, purchase_date, quantity, dosage_frequency, expected_depletion_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        parseInt(orderRecord.user_id),
        medicine.id,
        new Date(orderRecord.purchase_date),
        quantity,
        orderRecord.dosage_frequency,
        depletionDate
      ]);
    }

    console.log(`✅ Seeded ${orderData.length} orders\n`);

    // Create some sample prescriptions
    console.log('📋 Creating sample prescriptions...');
    
    const prescriptionMedicines = await query(`
      SELECT id, medicine_name FROM medicines WHERE prescription_required = true LIMIT 5
    `);

    let prescriptionCount = 0;
    for (const medicine of prescriptionMedicines.rows) {
      for (const [userId] of Object.entries(consumers)) {
        await query(`
          INSERT INTO prescriptions 
          (consumer_id, medicine_id, prescribed_by, prescription_date, expiry_date, verified)
          VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', true)
          ON CONFLICT DO NOTHING
        `, [parseInt(userId), medicine.id, 'Dr. Smith']);
        
        prescriptionCount++;
      }
    }

    console.log(`✅ Created ${prescriptionCount} sample prescriptions\n`);

    console.log('🎉 Database seeding completed successfully!\n');
    console.log('Summary:');
    console.log(`  • Medicines: ${medicineData.length}`);
    console.log(`  • Consumers: ${Object.keys(consumers).length}`);
    console.log(`  • Orders: ${orderData.length}`);
    console.log(`  • Prescriptions: ${prescriptionCount}\n`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seeding
seedDatabase().catch(console.error);






// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import Papa from 'papaparse';
// import XLSX from 'xlsx';
// import pool, { query } from '../config/database.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Excel path (database/products-export.xlsx)
// const PRODUCTS_XLSX_PATH = path.join(__dirname, '../../database/products-export.xlsx');

// function toInt(v, fallback = 0) {
//   const n = parseInt(v, 10);
//   return Number.isFinite(n) ? n : fallback;
// }

// function toFloat(v, fallback = null) {
//   const n = parseFloat(v);
//   return Number.isFinite(n) ? n : fallback;
// }

// function toBoolYesNo(v) {
//   if (v == null) return false;
//   const s = String(v).trim().toLowerCase();
//   return s === 'yes' || s === 'true' || s === '1' || s === 'y';
// }

// function normalizeImageUrl(v) {
//   if (v == null) return null;
//   let s = String(v).trim();
//   if (!s) return null;

//   // If user entered filenames without extension, assume png
//   if (!/\.(png|jpg|jpeg|webp)$/i.test(s)) s = `${s}.png`;
//   return s;
// }

// async function ensureMedicineExtraColumns() {
//   await query(`
//     ALTER TABLE medicines
//       ADD COLUMN IF NOT EXISTS description_de TEXT,
//       ADD COLUMN IF NOT EXISTS image_url TEXT,
//       ADD COLUMN IF NOT EXISTS pzn VARCHAR(32),
//       ADD COLUMN IF NOT EXISTS package_size VARCHAR(64),
//       ADD COLUMN IF NOT EXISTS price_rec DECIMAL(10,2)
//   `);
// }

// async function findMedicineRowByExactName(name) {
//   const r = await query(`SELECT * FROM medicines WHERE medicine_name = $1 LIMIT 1`, [name]);
//   return r.rows.length ? r.rows[0] : null;
// }

// async function findMedicineIdForProductName(productName) {
//   // Try exact/ILIKE against medicine_name or generic_name
//   const exact = await query(
//     `
//     SELECT id
//     FROM medicines
//     WHERE medicine_name ILIKE $1
//        OR generic_name ILIKE $1
//     ORDER BY
//       CASE WHEN medicine_name ILIKE $1 THEN 0 ELSE 1 END
//     LIMIT 1
//     `,
//     [productName]
//   );
//   if (exact.rows.length) return exact.rows[0].id;

//   // Try contains match
//   const loose = await query(
//     `
//     SELECT id
//     FROM medicines
//     WHERE medicine_name ILIKE $1
//        OR generic_name ILIKE $1
//     LIMIT 1
//     `,
//     [`%${productName}%`]
//   );
//   return loose.rows.length ? loose.rows[0].id : null;
// }

// /**
//  * CSV upsert without ON CONFLICT
//  * Works even if there is NO unique constraint on medicine_name
//  */
// async function upsertMedicineFromMasterCSV(medicine) {
//   const name = medicine.medicine_name?.trim();
//   if (!name) return;

//   const generic = medicine.generic_name || null;
//   const stock = toInt(medicine.stock_quantity, 0);
//   const unitType = medicine.unit_type || 'units';

//   const prescriptionRequired =
//     String(medicine.prescription_required || '').trim() === 'Yes' ||
//     toBoolYesNo(medicine.prescription_required);

//   const dosageInfo = medicine.dosage_info || null;
//   const category = medicine.category || null;
//   const price = toFloat(medicine.price, null);
//   const manufacturer = medicine.manufacturer || null;

//   const existing = await findMedicineRowByExactName(name);

//   if (!existing) {
//     await query(
//       `
//       INSERT INTO medicines
//         (medicine_name, generic_name, stock_quantity, unit_type, prescription_required, dosage_info, category, price, manufacturer)
//       VALUES
//         ($1,$2,$3,$4,$5,$6,$7,$8,$9)
//       `,
//       [name, generic, stock, unitType, prescriptionRequired, dosageInfo, category, price, manufacturer]
//     );
//     return;
//   }

//   // Update existing (COALESCE keeps old value if new value is null)
//   await query(
//     `
//     UPDATE medicines
//     SET
//       generic_name = COALESCE($2, generic_name),
//       stock_quantity = COALESCE($3, stock_quantity),
//       unit_type = COALESCE($4, unit_type),
//       prescription_required = COALESCE($5, prescription_required),
//       dosage_info = COALESCE($6, dosage_info),
//       category = COALESCE($7, category),
//       price = COALESCE($8, price),
//       manufacturer = COALESCE($9, manufacturer),
//       updated_at = CURRENT_TIMESTAMP
//     WHERE id = $1
//     `,
//     [existing.id, generic, stock, unitType, prescriptionRequired, dosageInfo, category, price, manufacturer]
//   );
// }

// /**
//  * Excel import:
//  * Updates existing medicine rows if matched, else inserts new rows.
//  * (NO ON CONFLICT used)
//  */
// async function importProductsFromExcel() {
//   if (!fs.existsSync(PRODUCTS_XLSX_PATH)) {
//     console.log(`⚠️ products-export.xlsx not found at: ${PRODUCTS_XLSX_PATH}`);
//     console.log('   Skipping Excel import.\n');
//     return { imported: 0, updated: 0, inserted: 0 };
//   }

//   console.log('🧾 Importing product info from Excel (DE description + image + pzn + package size + price_rec)...');

//   const wb = XLSX.readFile(PRODUCTS_XLSX_PATH);
//   const sheet = wb.Sheets[wb.SheetNames[0]];
//   const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

//   let updated = 0;
//   let inserted = 0;

//   for (const r of rows) {
//     const productName = String(r['product name'] ?? '').trim();
//     if (!productName) continue;

//     const pzn = r['pzn'] != null ? String(r['pzn']).trim() : null;
//     const packageSize = r['package size'] != null ? String(r['package size']).trim() : null;
//     const descriptionDe = r['descriptions'] != null ? String(r['descriptions']).trim() : null;
//     const priceRec = toFloat(r['price rec'], null);
//     const imageUrl = normalizeImageUrl(r['image_url']);

//     const medId = await findMedicineIdForProductName(productName);

//     if (medId) {
//       await query(
//         `
//         UPDATE medicines
//         SET
//           description_de = COALESCE($2, description_de),
//           pzn = COALESCE($3, pzn),
//           package_size = COALESCE($4, package_size),
//           price_rec = COALESCE($5, price_rec),
//           image_url = COALESCE($6, image_url),
//           price = CASE WHEN price IS NULL AND $5 IS NOT NULL THEN $5 ELSE price END,
//           updated_at = CURRENT_TIMESTAMP
//         WHERE id = $1
//         `,
//         [medId, descriptionDe, pzn, packageSize, priceRec, imageUrl]
//       );
//       updated++;
//     } else {
//       // Insert new
//       await query(
//         `
//         INSERT INTO medicines
//           (medicine_name, stock_quantity, unit_type, prescription_required, price, price_rec, description_de, pzn, package_size, image_url)
//         VALUES
//           ($1, 0, 'units', false, $2, $2, $3, $4, $5, $6)
//         `,
//         [productName, priceRec, descriptionDe, pzn, packageSize, imageUrl]
//       );
//       inserted++;
//     }
//   }

//   console.log(`✅ Excel import done. Updated: ${updated}, Inserted: ${inserted}\n`);
//   return { imported: rows.length, updated, inserted };
// }

// async function seedConsumersAndOrders() {
//   console.log('👥 Seeding consumers and order history...');

//   const orderCSV = fs.readFileSync(path.join(__dirname, '../../database/consumer_orders.csv'), 'utf-8');
//   const orderData = Papa.parse(orderCSV, { header: true, skipEmptyLines: true }).data;

//   // unique consumers map
//   const consumers = {};
//   for (const order of orderData) {
//     if (!order.user_id || !order.consumer_name) continue;

//     if (!consumers[order.user_id]) {
//       consumers[order.user_id] = {
//         name: order.consumer_name,
//         email: `${order.consumer_name.toLowerCase().replace(/\s+/g, '.')}@email.com`,
//         phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`
//       };
//     }
//   }

//   // insert consumers
//   for (const [userId, consumer] of Object.entries(consumers)) {
//     await query(
//       `
//       INSERT INTO consumers (id, name, email, phone)
//       VALUES ($1, $2, $3, $4)
//       ON CONFLICT (id) DO NOTHING
//       `,
//       [toInt(userId), consumer.name, consumer.email, consumer.phone]
//     );
//   }

//   console.log(`✅ Seeded ${Object.keys(consumers).length} consumers\n`);

//   console.log('🛒 Seeding order history...');

//   let orderInserted = 0;

//   for (const orderRecord of orderData) {
//     if (!orderRecord.user_id || !orderRecord.medicine_name) continue;

//     const medicineResult = await query(
//       `SELECT id, price FROM medicines WHERE medicine_name = $1 LIMIT 1`,
//       [orderRecord.medicine_name]
//     );
//     if (!medicineResult.rows.length) continue;

//     const medicine = medicineResult.rows[0];
//     const quantity = toInt(orderRecord.quantity, 30);
//     const unitPrice = toFloat(medicine.price, 0);
//     const totalAmount = unitPrice * quantity;

//     const purchaseDate = orderRecord.purchase_date ? new Date(orderRecord.purchase_date) : new Date();

//     const orderResult = await query(
//       `
//       INSERT INTO orders (consumer_id, order_date, status, total_amount)
//       VALUES ($1, $2, $3, $4)
//       RETURNING id
//       `,
//       [toInt(orderRecord.user_id), purchaseDate, 'fulfilled', totalAmount]
//     );

//     const orderId = orderResult.rows[0].id;

//     await query(
//       `
//       INSERT INTO order_items (order_id, medicine_id, quantity, dosage_frequency, unit_price, subtotal)
//       VALUES ($1, $2, $3, $4, $5, $6)
//       `,
//       [
//         orderId,
//         medicine.id,
//         quantity,
//         orderRecord.dosage_frequency || null,
//         unitPrice,
//         totalAmount
//       ]
//     );

//     const expectedDepletionDays = toInt(orderRecord.expected_depletion_days, 30);
//     const depletionDate = new Date(purchaseDate);
//     depletionDate.setDate(depletionDate.getDate() + expectedDepletionDays);

//     await query(
//       `
//       INSERT INTO consumption_history
//         (consumer_id, medicine_id, purchase_date, quantity, dosage_frequency, expected_depletion_date)
//       VALUES
//         ($1, $2, $3, $4, $5, $6)
//       `,
//       [
//         toInt(orderRecord.user_id),
//         medicine.id,
//         purchaseDate,
//         quantity,
//         orderRecord.dosage_frequency || null,
//         depletionDate
//       ]
//     );

//     orderInserted++;
//   }

//   console.log(`✅ Seeded ${orderInserted} orders from history\n`);

//   // sample prescriptions
//   console.log('📋 Creating sample prescriptions...');
//   const prescriptionMedicines = await query(`SELECT id FROM medicines WHERE prescription_required = true LIMIT 5`);

//   let prescriptionCount = 0;
//   for (const med of prescriptionMedicines.rows) {
//     for (const [userId] of Object.entries(consumers)) {
//       await query(
//         `
//         INSERT INTO prescriptions
//           (consumer_id, medicine_id, prescribed_by, prescription_date, expiry_date, verified)
//         VALUES
//           ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', true)
//         ON CONFLICT DO NOTHING
//         `,
//         [toInt(userId), med.id, 'Dr. Smith']
//       );
//       prescriptionCount++;
//     }
//   }

//   console.log(`✅ Created ${prescriptionCount} sample prescriptions\n`);
// }

// async function seedDatabase() {
//   console.log('🌱 Starting database seeding...\n');

//   try {
//     await ensureMedicineExtraColumns();

//     // Medicines from CSV
//     console.log('📦 Seeding medicines from CSV...');
//     const medicineCSV = fs.readFileSync(path.join(__dirname, '../../database/medicine_master.csv'), 'utf-8');
//     const medicineData = Papa.parse(medicineCSV, { header: true, skipEmptyLines: true }).data;

//     let medicineCount = 0;
//     for (const medicine of medicineData) {
//       if (!medicine.medicine_name) continue;
//       await upsertMedicineFromMasterCSV(medicine);
//       medicineCount++;
//     }
//     console.log(`✅ Seeded/Updated ${medicineCount} medicines from CSV\n`);

//     // Excel enrichment
//     await importProductsFromExcel();

//     // Consumers + orders + prescriptions
//     await seedConsumersAndOrders();

//     console.log('🎉 Database seeding completed successfully!\n');
//   } catch (error) {
//     console.error('❌ Error seeding database:', error);
//     throw error;
//   } finally {
//     await pool.end();
//   }
// }

// seedDatabase().catch(console.error);