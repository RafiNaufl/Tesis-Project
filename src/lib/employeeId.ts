


/**
 * Generates a new Employee ID based on the organization code.
 * Must be called within a transaction to ensure uniqueness and sequence integrity.
 * 
 * @param tx Prisma Transaction Client
 * @param organizationCode The organization code (e.g., "CTU", "MT")
 * @returns The generated Employee ID (e.g., "CTU-001")
 */
export async function generateEmployeeId(
  tx: any, // using any because Prisma.TransactionClient type is tricky to import sometimes, but ideally should be typed
  organizationCode: string
): Promise<string> {
  // Find the organization
  const organization = await tx.organization.findUnique({
    where: { code: organizationCode },
  });

  if (!organization) {
    throw new Error(`Organization with code ${organizationCode} not found`);
  }

  // Increment sequence
  const newSequence = organization.currentSequence + 1;
  const sequenceStr = newSequence.toString().padStart(3, "0");
  const newEmployeeId = `${organizationCode}-${sequenceStr}`;

  // Update organization sequence
  await tx.organization.update({
    where: { id: organization.id },
    data: { currentSequence: newSequence },
  });

  // Verify uniqueness globally (just in case)
  const existingEmployee = await tx.employee.findUnique({
    where: { employeeId: newEmployeeId },
  });

  if (existingEmployee) {
    // This shouldn't happen if sequence is managed correctly, but as a safety net
    throw new Error(`Generated Employee ID ${newEmployeeId} already exists`);
  }

  return newEmployeeId;
}

/**
 * Validates the format of an Employee ID.
 * Expected format: [ORG_CODE]-[3_DIGIT_NUMBER]
 */
export function validateEmployeeIdFormat(employeeId: string): boolean {
  const regex = /^[A-Z]+-\d{3}$/;
  return regex.test(employeeId);
}
