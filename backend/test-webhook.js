import axios from 'axios';

const WEBHOOK_URL = 'YOUR_ZAPIER_WEBHOOK_URL_HERE';

const testPayload = {
  event: 'order.confirmation',
  timestamp: new Date().toISOString(),
  customer_name: 'John Doe',
  customer_email: 'your-email@gmail.com', // CHANGE THIS
  customer_phone: '+1-555-1234',
  order_id: 101,
  medicines_count: 5,
  total_amount: '425.75',
  status: 'confirmed',
  payment_status: 'paid',
  order_date: new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }),
  medicine_list: [
    '1. Paracetamol 500mg - 10 units ($5.00 each)',
    '2. Aspirin 75mg - 10 units ($3.50 each)',
    '3. Saw Palmetto 350mg - 12 units ($12.00 each)',
    '4. Osa Schorf Spray - 1 units ($25.00 each)',
    '5. Calmvalera Hevert Tropfen - 1 units ($18.25 each)'
  ].join('\n'),
  currency: 'USD',
  pickup_ready: true,
  pharmacy_name: 'MediFlow AI Pharmacy',
  pharmacy_phone: '+1-555-MEDFLOW',
  pharmacy_address: '123 Healthcare St, Medical District, NY 10001'
};

console.log('Sending test webhook to:', WEBHOOK_URL);
console.log('Payload:', JSON.stringify(testPayload, null, 2));

axios.post(WEBHOOK_URL, testPayload)
  .then(response => {
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Response:', response.data);
  })
  .catch(error => {
    console.error('❌ Error:');
    console.error(error.response ? error.response.data : error.message);
  });