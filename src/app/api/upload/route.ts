import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }
    
    // Create unique filename
    const fileExtension = file.name.split(".").pop();
    const fileName = `${session.user.id}_${generateUniqueId()}.${fileExtension}`;
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    
    // Save file path
    const filePath = path.join(uploadsDir, fileName);
    
    // Convert the file to a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Write the file to the filesystem
    await writeFile(filePath, buffer);
    
    // Public URL for the file
    const fileUrl = `/uploads/${fileName}`;
    
    return NextResponse.json({
      url: fileUrl,
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