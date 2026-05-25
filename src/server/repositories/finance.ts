import { TuitionFee } from "../../types";
import { Queryable } from "../db";
import { tuitionFeeFromRow } from "../mappers";

export const financeRepository = {
  async listTuitionFees(db: Queryable) {
    return (await db.query("SELECT * FROM tuition_fees ORDER BY due_date DESC")).rows.map(tuitionFeeFromRow);
  },

  async getDashboard(db: Queryable) {
    const fees = await this.listTuitionFees(db);
    return {
      tuitionFees: fees,
      summary: {
        totalBilled: fees.reduce((sum, fee) => sum + fee.amount, 0),
        totalPaid: fees.reduce((sum, fee) => sum + fee.paidAmount, 0),
        unpaidCount: fees.filter(fee => fee.status !== "paid").length
      }
    };
  },

  async payTuition(db: Queryable, feeId: string, paidAmount: number) {
    const fee = (await db.query("SELECT * FROM tuition_fees WHERE id = $1", [feeId])).rows[0];
    if (!fee) return null;
    const totalPaid = Math.min(Number(fee.amount), Number(fee.paid_amount || 0) + paidAmount);
    const status: TuitionFee["status"] = totalPaid >= Number(fee.amount) ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
    const paidAt = status === "paid" ? new Date().toISOString() : fee.paid_at;
    const receiptCode = fee.receipt_code || `RC${Date.now()}`;
    await db.query("UPDATE tuition_fees SET paid_amount = $1, status = $2, paid_at = $3, receipt_code = $4 WHERE id = $5", [totalPaid, status, paidAt, receiptCode, feeId]);
    return { id: feeId, paidAmount: totalPaid, status, paidAt, receiptCode };
  }
};
