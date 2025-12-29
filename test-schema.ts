
import { z } from "zod";

// Mock optionalNumber as imported from registrationValidation
const optionalNumber = (message?: string) =>
  z.preprocess(
    (v) => {
      if (typeof v === "number" && Number.isNaN(v)) return undefined;
      if (typeof v === "string") {
        if (v.trim() === "") return undefined;
        const parsed = Number(v);
        return Number.isNaN(parsed) ? v : parsed;
      }
      return v;
    },
    z.number({ invalid_type_error: message || "Nilai harus angka" }).optional()
  );

// Mock roles etc needed for schema
const roles = ["Admin"] as const;
const divisions = ["IT"] as const;
const organizations = ["Org1"] as const;
const employmentStatuses = ["Permanent"] as const;
const workSchedules = ["NON_SHIFT"] as const;
const phoneRegex = /^[+]?\d{8,15}$/;

function buildEditSchema() {
  const base = z.object({
    // Minimal fields for testing BPJS
    bpjsKesehatan: optionalNumber("BPJS Kesehatan harus angka"),
    bpjsKetenagakerjaan: optionalNumber("BPJS Ketenagakerjaan harus angka"),
  });
  return base;
}

const schema = buildEditSchema();

// Test cases
const cases = [
  { name: "String number", input: { bpjsKesehatan: "150000" }, expected: { bpjsKesehatan: 150000 } },
  { name: "Number", input: { bpjsKesehatan: 150000 }, expected: { bpjsKesehatan: 150000 } },
  { name: "Empty string", input: { bpjsKesehatan: "" }, expected: { bpjsKesehatan: undefined } },
  { name: "Undefined", input: { bpjsKesehatan: undefined }, expected: { bpjsKesehatan: undefined } },
  { name: "Invalid string", input: { bpjsKesehatan: "abc" }, shouldFail: true },
];

console.log("Running tests...");
let passed = 0;
for (const c of cases) {
  const result = schema.safeParse(c.input);
  if (c.shouldFail) {
    if (!result.success) {
      console.log(`PASS: ${c.name} failed as expected`);
      passed++;
    } else {
      console.log(`FAIL: ${c.name} should have failed but passed with`, result.data);
    }
  } else {
    if (result.success) {
      const val = result.data.bpjsKesehatan;
      if (c.expected && val === c.expected.bpjsKesehatan) {
        console.log(`PASS: ${c.name} -> ${val}`);
        passed++;
      } else {
        console.log(
          `FAIL: ${c.name} expected ${c.expected ? c.expected.bpjsKesehatan : 'undefined'}, got ${val}`
        );
      }
    } else {
      console.log(`FAIL: ${c.name} failed validation`, result.error);
    }
  }
}
console.log(`Total: ${passed}/${cases.length}`);
