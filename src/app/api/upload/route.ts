import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Helper function to generate a unique ID
function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// POST: Upload a file
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get the form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = formData.get("folder") as string || "profiles"; // Default to 'profiles'

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    
    // Validate folder name to prevent directory traversal
    const allowedFolders = ["profiles", "attendance", "requests", "misc"];
    const targetFolder = allowedFolders.includes(folder) ? folder : "profiles";
    
    // Validate file type: only JPEG/PNG
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Format file harus JPEG atau PNG" },
        { status: 400 }
      );
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Ukuran file melebihi batas 2MB" },
        { status: 400 }
      );
    }
    
    // Create unique filename with folder path
    const fileExtension = file.name.split(".").pop();
    // Format: folder/userId_timestamp_random.ext
    // Note: In Supabase Storage, folders are just prefixes in the filename
    const fileName = `${targetFolder}/${session.user.id}_${generateUniqueId()}.${fileExtension}`;
    
    // Convert the file to a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Basic magic-byte validation for JPEG/PNG
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
    if (!isJpeg && !isPng) {
      return NextResponse.json(
        { error: "File tidak valid (format file rusak atau bukan gambar)" },
        { status: 400 }
      );
    }
    
    // Upload to Supabase Storage
    // Ensure you have a bucket named 'profiles' in your Supabase project
    const { data, error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true
      });
      
    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Gagal mengupload file ke storage server" },
        { status: 500 }
      );
    }
    
    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(fileName);
    
    return NextResponse.json({
      url: publicUrl,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
} 
