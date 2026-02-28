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
