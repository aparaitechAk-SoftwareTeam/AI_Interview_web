import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { candidateImportRow, scanCandidateFile } from "../src/services/bulk-candidates/candidate-file-scanner.js";

describe("bulk candidate smart scanner", () => {
  it("maps a CSV roster row without mixing candidate contact details", async () => {
    const file = {
      originalname: "candidates.csv", mimetype: "text/csv",
      buffer: Buffer.from("Serial No,Full Name,Email,Mobile,Position\n1,Dipali Jagtap,dipali@example.com,+919876543210,Java Intern\n2,Vivek Shinde,vivek@example.com,+919812345678,React Intern")
    };
    const result = await scanCandidateFile(file);
    expect(result.valid).toBe(2);
    expect(result.rows.map(({ fullName, email, phone }) => ({ fullName, email, phone }))).toEqual([
      { fullName: "Dipali Jagtap", email: "dipali@example.com", phone: "+919876543210" },
      { fullName: "Vivek Shinde", email: "vivek@example.com", phone: "+919812345678" }
    ]);
  });

  it("reads a normal Excel worksheet and applies the default role only to blank roles", async () => {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Candidates");
    sheet.addRow(["Sr No", "Student Name", "Mail ID", "WhatsApp No", "Role"]);
    sheet.addRow([1, "Asha Patil", "asha@example.com", "+919900001111", ""]);
    const result = await scanCandidateFile({ originalname: "candidates.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) }, { position: "Graduate Trainee" });
    expect(result.rows[0]).toMatchObject({ valid: true, fullName: "Asha Patil", email: "asha@example.com", phone: "+919900001111", position: "Graduate Trainee" });
  });

  it("flags duplicate contacts and validates confirmed import rows again", async () => {
    const file = { originalname: "candidates.csv", mimetype: "text/csv", buffer: Buffer.from("Name,Email,Phone\nOne Person,one@example.com,+919999999999\nAnother Person,one@example.com,+919888888888") };
    const result = await scanCandidateFile(file);
    expect(result.rows[0].valid).toBe(true);
    expect(result.rows[1]).toMatchObject({ valid: false, errors: ["Duplicate email in this file"] });
    expect(candidateImportRow.safeParse({ fullName: "Only Name", email: "wrong", phone: "123" }).success).toBe(false);
  });
});
