import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { hash, compare } from "bcrypt";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

// GET: Get the current user's profile
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to access your profile." },
        { status: 401 }
      );
    }
    
    if (!session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Invalid session. Missing user information." },
        { status: 400 }
      );
    }
    
    // Get the user with employee information if available
    const user = await db.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileImageUrl: true, // Include profileImageUrl field
        createdAt: true,
        employee: {
          select: {
            id: true,
            employeeId: true,
            position: true,
            division: true,
            organization: true,
            basicSalary: true,
            hourlyRate: true,
            workScheduleType: true,
            bpjsKesehatan: true,
            bpjsKetenagakerjaan: true,
            joiningDate: true,
            contactNumber: true,
            address: true,
            isActive: true,
          },
        },
      },
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found. User record may have been deleted." },
        { status: 404 }
      );
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile due to a server error. Please try again later." },
      { status: 500 }
    );
  }
}

// PATCH: Update the current user's profile
export async function PATCH(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const body = await _request.json();
    const { 
      name, 
      email, 
      currentPassword, 
      newPassword, 
      contactNumber, 
      address, 
      profileImageUrl 
    } = body;
    
    // Get the current user
    const user = await db.user.findUnique({
      where: {
        id: session.user.id,
      },
      include: {
        employee: true,
      },
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Prepare user update data
    const updateData: any = {};
    
    // Update name if provided
    if (name && name !== user.name) {
      updateData.name = name;
    }
    
    // Update email if provided and different from current
    if (email && email !== user.email) {
      // Check if email is already in use
      const existingUser = await db.user.findUnique({
        where: {
          email,
        },
      });
      
      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json(
          { error: "Email is already in use" },
          { status: 400 }
        );
      }
      
      updateData.email = email;
    }
    
    // Update profileImageUrl if provided
    if (profileImageUrl !== undefined) {
      updateData.profileImageUrl = profileImageUrl;
    }
    
    // Update password if both current and new passwords are provided
    if (currentPassword && newPassword) {
      // Verify current password
      const isPasswordValid = await compare(currentPassword, user.hashedPassword);
      
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }
      
      // Hash the new password
      const hashedPassword = await hash(newPassword, 10);
      updateData.hashedPassword = hashedPassword;
    }
    
    // Update the user
    const updatedUser = await db.user.update({
      where: {
        id: session.user.id,
      },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileImageUrl: true, // Include profileImageUrl in response
      },
    });
    
    // If user is an employee, update employee info if provided
    let updatedEmployeeInfo = null;
    if (user.employee && (contactNumber !== undefined || address !== undefined)) {
      const employeeUpdateData: any = {};
      
      if (contactNumber !== undefined) {
        employeeUpdateData.contactNumber = contactNumber;
      }
      
      if (address !== undefined) {
        employeeUpdateData.address = address;
      }
      
      updatedEmployeeInfo = await db.employee.update({
        where: {
          id: user.employee.id,
        },
        data: employeeUpdateData,
        select: {
          contactNumber: true,
          address: true,
        },
      });
    }
    
    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        ...updatedUser,
        employee: updatedEmployeeInfo ? {
          ...user.employee,
          ...updatedEmployeeInfo
        } : user.employee
      },
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 }
    );
  }
} 
