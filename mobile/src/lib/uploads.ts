import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

export async function pickImage(options?: ImagePicker.ImagePickerOptions) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library access is needed to choose an image.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.9,
    ...options,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export async function uploadImageAsset(
  bucket: string,
  path: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();
  const contentType = asset.mimeType ?? "image/jpeg";
  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
