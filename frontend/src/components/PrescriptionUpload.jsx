import React, { useState } from 'react';
import axios from 'axios';
import './PrescriptionUpload.css';

function PrescriptionUpload({ apiBaseUrl, onMedicinesExtracted }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload an image (JPEG, PNG, HEIC) or PDF file');
      return;
    }

    // Validate file size (10MB)
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
      const formData = new FormData();
      formData.append('prescription', file);

      const response = await axios.post(
        `${apiBaseUrl}/prescription/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success && response.data.medicines.length > 0) {
        // Pass extracted medicines to parent
        onMedicinesExtracted(response.data.medicines, response.data.patientInfo);
      } else {
        setError('No medicines found in the prescription.');
      }

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload prescription. Please try again.');
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
      <label htmlFor="prescription-file" className={`upload-button ${uploading ? 'uploading' : ''}`}>
        {uploading ? (
          <>
            <span className="upload-icon spinning">⏳</span>
            <span className="upload-text">Analyzing...</span>
          </>
        ) : (
          <>
            <span className="upload-icon"><img src="/plus.png" /></span>
            <span className="upload-text">Upload Prescription</span>
          </>
        )}
      </label>
      {error && <div className="upload-error">{error}</div>}
    </div>
  );
}

export default PrescriptionUpload;