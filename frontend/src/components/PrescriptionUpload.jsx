import React, { useState } from 'react';
import axios from 'axios';
import './PrescriptionUpload.css';

function PrescriptionUpload({ apiBaseUrl, onMedicinesExtracted, consumerId, customerEmail }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf',
      'image/heic',
      'image/heif'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload an image (JPEG, PNG, HEIC) or PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    await uploadPrescription(file);
  };

  const uploadPrescription = async (file) => {
    setUploading(true);
    setError('');

    try {
      if (!apiBaseUrl) throw new Error("API base URL is not configured.");

      const formData = new FormData();
      formData.append('prescription', file);

      // ✅ REQUIRED by backend
      if (consumerId) {
        formData.append('consumerId', String(consumerId));
      } else if (customerEmail) {
        formData.append('customer_email', customerEmail);
      } else {
        throw new Error('Missing consumerId/customerEmail for prescription upload');
      }


      
//this is it 
      const response = await axios.post(
  `${apiBaseUrl}/api/prescription/upload`,
  formData
);

      if (response.data?.success && response.data?.medicines?.length > 0) {
        onMedicinesExtracted(response.data.medicines, response.data.patientInfo);
      } else {
        setError('No medicines found in the prescription.');
      }
    } catch (err) {
      console.error('Upload error full:', err);
      setError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to upload prescription. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="prescription-upload">
      <input
        type="file"
        id="prescription-file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={uploading}
      />

      <label
        htmlFor="prescription-file"
        className={`upload-button ${uploading ? 'uploading' : ''}`}
      >
        {uploading ? (
          <>
            <span className="upload-icon spinning">⏳</span>
            <span className="upload-text">Analyzing...</span>
          </>
        ) : (
          <>
            <span className="upload-icon">
              <img src="/plus.png" alt="Upload" />
            </span>
            <span className="upload-text">Upload Prescription</span>
          </>
        )}
      </label>

      {error && <div className="upload-error">{error}</div>}
    </div>
  );
}

export default PrescriptionUpload;