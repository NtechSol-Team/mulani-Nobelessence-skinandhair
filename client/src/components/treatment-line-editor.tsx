import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BillTreatmentItem } from "@shared/schema";
import { calcTreatmentLine, formatMoney } from "@shared/money";

/** Apply a change to a bill treatment and recompute its discount + net total. */
export function withTreatmentLine(
  item: BillTreatmentItem,
  patch: Partial<BillTreatmentItem> = {},
): BillTreatmentItem {
  const next = { ...item, ...patch };
  const { discount, total } = calcTreatmentLine(next);
  return { ...next, discount, total };
}

interface TreatmentLineEditorProps {
  item: BillTreatmentItem;
  onChange: (next: BillTreatmentItem) => void;
  onRemove: () => void;
}

/** One treatment row on a bill: price, per-treatment discount (% or ₹) and the net amount. */
export function TreatmentLineEditor({ item, onChange, onRemove }: TreatmentLineEditorProps) {
  const discountType = item.discountType ?? "Percentage";
  const { discount, total } = calcTreatmentLine(item);

  return (
    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{item.treatmentName}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[7rem_1fr_7rem] gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Price</label>
          <Input
            type="number"
            min="0"
            value={item.price}
            onChange={(e) => onChange(withTreatmentLine(item, { price: parseFloat(e.target.value) || 0 }))}
            className="h-8"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Discount</label>
          <div className="flex gap-1">
            <Select
              value={discountType}
              onValueChange={(v) =>
                // Reset the value when the type flips: 10 (%) and 10 (₹) mean different things.
                onChange(withTreatmentLine(item, { discountType: v as "Percentage" | "INR", discountValue: 0 }))
              }
            >
              <SelectTrigger className="h-8 w-24 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Percentage">%</SelectItem>
                <SelectItem value="INR">₹</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              max={discountType === "Percentage" ? 100 : item.price}
              placeholder={discountType === "Percentage" ? "0 %" : "0 ₹"}
              value={item.discountValue ? item.discountValue : ""}
              onChange={(e) =>
                onChange(withTreatmentLine(item, { discountValue: parseFloat(e.target.value) || 0 }))
              }
              className="h-8 flex-1 min-w-0"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Total (Net)</label>
          <div className="h-8 flex flex-col justify-center font-medium text-sm">
            <span>₹{formatMoney(total)}</span>
            {discount > 0 ? <span className="text-xs text-green-600">(-₹{formatMoney(discount)})</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
