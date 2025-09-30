// hooks/useCloudinaryUpload.ts
import { useState } from 'react';
import { Alert } from 'react-native';

interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
}

interface UseCloudinaryUpload {
  uploadImage: (imageUri: string, folder?: string) => Promise<UploadResult | null>;
  uploadMultiple: (imageUris: string[], folder?: string) => Promise<(UploadResult | null)[]>;
  loading: boolean;
  error: string | null;
}

export const useCloudinaryUpload = (): UseCloudinaryUpload => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = async (imageUri: string, folder?: string): Promise<UploadResult | null> => {
    setLoading(true);
    setError(null);

    try {
      // Your Cloudinary configuration from the dashboard
      const cloudName = 'dxgveihpo'; // Your cloud name
      const uploadPreset = 'shopyos'; // You need to create this in Cloudinary settings

      // Create form data for upload
      const formData = new FormData();
      
      // Append the image file
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `upload_${Date.now()}.jpg`,
      } as any);

      // Required: Your upload preset
      formData.append('upload_preset', uploadPreset);
      
      // Optional: Add folder for organization
      if (folder) {
        formData.append('folder', folder);
      }

      // Upload to Cloudinary using their upload API
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        url: data.secure_url,
        publicId: data.public_id,
        format: data.format,
        width: data.width,
        height: data.height,
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload image to Cloudinary';
      setError(errorMessage);
      console.error('Cloudinary upload error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const uploadMultiple = async (imageUris: string[], folder?: string): Promise<(UploadResult | null)[]> => {
    setLoading(true);
    setError(null);

    try {
      const uploadPromises = imageUris.map((uri) => 
        uploadImage(uri, folder)
      );

      const results = await Promise.all(uploadPromises);
      return results;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload multiple images';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    uploadImage,
    uploadMultiple,
    loading,
    error,
  };
};