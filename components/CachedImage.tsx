import React, { useState, useEffect, ReactNode } from 'react';
import { Image, View, StyleSheet, ImageStyle, ViewStyle, ActivityIndicator } from 'react-native';
import { colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

interface CachedImageProps {
  path: string | null;
  style: ImageStyle | ViewStyle;
  fallback?: ReactNode;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  showLoadingIndicator?: boolean;
}

// In-memory cache for faster repeating access
const imageCache: Record<string, string> = {};

const CachedImage: React.FC<CachedImageProps> = ({
  path,
  style,
  fallback,
  resizeMode = 'cover',
  showLoadingIndicator = true,
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const fetchImage = async () => {
      // If path is null or empty, show fallback
      if (!path) {
        setError(true);
        return;
      }

      // Check if path is already a full URL
      if (path.startsWith('http')) {
        setImageUri(path);
        return;
      }
      
      // Check in-memory cache first (fastest)
      if (imageCache[path]) {
        setImageUri(imageCache[path]);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        // Create a hash of the path for a consistent filename
        const pathHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          path
        );
        const cacheDir = FileSystem.cacheDirectory;
        const cacheFilePath = `${cacheDir}${pathHash}.img`;

        // Check if the image is already cached on disk
        const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);

        if (fileInfo.exists) {
          // Use cached version
          if (isMounted) {
            setImageUri(fileInfo.uri);
            setLoading(false);
            // Add to memory cache
            imageCache[path] = fileInfo.uri;
          }
        } else {
          // Get direct URL from Supabase Storage
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(path);

          console.warn(publicUrl);
            
          if (publicUrl) {
            // Download the image to cache
            const downloadResult = await FileSystem.downloadAsync(
              publicUrl,
              cacheFilePath
            );
            
            if (downloadResult.status === 200) {
              if (isMounted) {
                setImageUri(cacheFilePath);
                setLoading(false);
                // Add to memory cache
                imageCache[path] = cacheFilePath;
              }
            } else {
              throw new Error(`Failed to download image: ${downloadResult.status}`);
            }
          } else {
            throw new Error('Failed to get public URL');
          }
        }
      } catch (err) {
        console.error('Error in CachedImage:', err);
        
        // Try to get a direct URL as fallback
        try {
          const { data: { publicUrl } } = supabase.storage
            .from('public')
            .getPublicUrl(path);
            
          if (isMounted) {
            setImageUri(publicUrl);
            setLoading(false);
            // Add to memory cache
            imageCache[path] = publicUrl;
          }
        } catch (supabaseError) {
          if (isMounted) {
            setError(true);
            setLoading(false);
          }
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [path]);

  if (error || !imageUri) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <View style={[styles.fallbackContainer, style]}>
        {/* Default fallback */}
      </View>
    );
  }

  return (
    <View style={style}>
      <Image
        source={{ uri: imageUri }}
        style={[styles.image, { resizeMode }]}
        onError={() => setError(true)}
      />
      
      {loading && showLoadingIndicator && (
        <View style={styles.loadingOverlay}>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    backgroundColor: colors.secondaryAccent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});

// Add utility methods for cache management
CachedImage.clearCache = async () => {
  // Clear memory cache
  Object.keys(imageCache).forEach(key => delete imageCache[key]);
  
  // Clear disk cache
  const cacheDir = FileSystem.cacheDirectory;
  if (cacheDir) {
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    await Promise.all(
      files
        .filter(file => file.endsWith('.img'))
        .map(file => FileSystem.deleteAsync(`${cacheDir}${file}`))
    );
  }
};

export default CachedImage;