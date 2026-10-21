"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { CreditCard, Plus, Minus, Loader2, Archive, DollarSign } from "lucide-react";
import { listPolarProducts, createPolarProduct, archivePolarProduct, type BillingProduct } from "@/lib/actions/billing";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@starter/ui/components/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@starter/ui/components/alert-dialog";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Textarea } from "@starter/ui/components/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@starter/ui/components/select";

const PRICING_TYPES = [
  { value: "saas-monthly", label: "SaaS Monthly", desc: "Recurring every month" },
  { value: "saas-yearly", label: "SaaS Yearly", desc: "Recurring every year" },
  { value: "one-time", label: "One-time", desc: "Single purchase" },
] as const;

const CURRENCIES = [
  { value: "usd", label: "USD" },
  { value: "eur", label: "EUR" },
  { value: "gbp", label: "GBP" },
] as const;

type PricingType = (typeof PRICING_TYPES)[number]["value"];
type Currency = (typeof CURRENCIES)[number]["value"];

type ProductForm = {
  name: string;
  description: string;
  features: string[];
  type: PricingType;
  priceAmount: string;
  priceCurrency: Currency;
};

const emptyForm: ProductForm = {
  name: "",
  description: "",
  features: [],
  type: "saas-monthly",
  priceAmount: "",
  priceCurrency: "usd",
};

const isPricingType = (v: string): v is PricingType => PRICING_TYPES.some((t) => t.value === v);
const isCurrency = (v: string): v is Currency => CURRENCIES.some((c) => c.value === v);

function formatPrice(p: BillingProduct["prices"][number]) {
  if (p.amountType === "free") return "Free";
  if (p.priceAmount != null) {
    const amount = (p.priceAmount / 100).toFixed(2);
    const curr = p.priceCurrency.toUpperCase();
    return `${curr} ${amount}`;
  }
  return p.amountType;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  function loadProducts() {
    startTransition(async () => {
      const result = await listPolarProducts({ includeArchived });
      if (result.error) {
        setError(result.error);
        setProducts([]);
      } else {
        setError(null);
        setProducts(result.products);
      }
    });
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the filter changes
  }, [includeArchived]);

  async function handleCreate() {
    const name = form.name.trim();
    const priceCents = Math.round(parseFloat(form.priceAmount || "0") * 100);

    if (!name) {
      toast.error("Name is required");
      return;
    }
    if (priceCents < 50) {
      toast.error("Minimum price is $0.50 (50 cents)");
      return;
    }

    setSaving(true);
    try {
      // The server combines description + features (single source: @starter/core/payments).
      const result = await createPolarProduct({
        name,
        description: form.description,
        features: form.features,
        type: form.type,
        priceAmountCents: priceCents,
        priceCurrency: form.priceCurrency,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Product created");
      setCreateOpen(false);
      setForm(emptyForm);
      loadProducts();
    } catch {
      toast.error("Failed to create product");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!archiveId) return;
    setArchiving(true);
    try {
      const result = await archivePolarProduct(archiveId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Product archived");
        setArchiveId(null);
        loadProducts();
      }
    } catch {
      toast.error("Failed to archive");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Products</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Manage SaaS pricing and one-time products via Polar.
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3" />
          Create product
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 rounded-md">
          <p className="text-xs text-destructive">{error}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Configure Polar in Admin → API Keys (access token + organization ID).
          </p>
        </div>
      )}

      <div className="border border-border/40 bg-card/50">
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground/50" />
            <div>
              <p className="text-xs font-semibold">Polar Products</p>
              <p className="text-[10px] text-muted-foreground">
                {products.length} product{products.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded"
            />
            Include archived
          </label>
        </div>

        {isPending ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-xs text-muted-foreground">
              {error ? "Configure Polar to load products" : "No products yet"}
            </p>
            {!error && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
                Create your first product
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {products.map((product) => (
              <div
                key={product.id}
                className={`p-4 hover:bg-muted/20 transition-colors flex items-start justify-between gap-4 ${
                  product.isArchived ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold truncate">{product.name}</h3>
                    {product.isArchived && (
                      <span className="text-[9px] px-1.5 py-px bg-muted text-muted-foreground">Archived</span>
                    )}
                    {product.isRecurring && (
                      <span className="text-[9px] px-1.5 py-px bg-primary/10 text-primary">
                        {product.recurringInterval === "month" ? "Monthly" : "Yearly"}
                      </span>
                    )}
                  </div>
                  {product.summary && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{product.summary}</p>
                  )}
                  {product.features.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">
                      {product.features.join(" · ")}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {product.prices.map((p) => (
                      <span key={p.id} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <DollarSign className="h-2.5 w-2.5" />
                        {formatPrice(p)}
                      </span>
                    ))}
                  </div>
                </div>
                {!product.isArchived && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setArchiveId(product.id)}
                  >
                    <Archive className="h-3 w-3" />
                    Archive
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create product dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Create product</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="prod-name" className="text-[11px] font-medium">
                Name *
              </Label>
              <Input
                id="prod-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Pro Plan"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-desc" className="text-[11px] font-medium">
                Description (optional)
              </Label>
              <Textarea
                id="prod-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Full access to all features"
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium">Features (optional)</Label>
              <p className="text-[9px] text-muted-foreground">
                Add bullet points for the pricing page. Shown as an unordered list.
              </p>
              <div className="space-y-2">
                {form.features.map((feature, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={feature}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          features: f.features.map((v, j) => (j === i ? e.target.value : v)),
                        }))
                      }
                      placeholder={`Feature ${i + 1}`}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          features: f.features.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs w-full border-dashed"
                  onClick={() => setForm((f) => ({ ...f, features: [...f.features, ""] }))}
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add feature
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium">Pricing type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  if (isPricingType(v)) setForm((f) => ({ ...f, type: v }));
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-price" className="text-[11px] font-medium">
                  Price *
                </Label>
                <Input
                  id="prod-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.priceAmount}
                  onChange={(e) => setForm((f) => ({ ...f, priceAmount: e.target.value }))}
                  placeholder="9.99"
                  className="h-8 text-xs"
                />
                <p className="text-[9px] text-muted-foreground">Min $0.50. Enter in dollars (e.g. 9.99).</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-currency" className="text-[11px] font-medium">
                  Currency
                </Label>
                <Select
                  value={form.priceCurrency}
                  onValueChange={(v) => {
                    if (isCurrency(v)) setForm((f) => ({ ...f, priceCurrency: v }));
                  }}
                >
                  <SelectTrigger id="prod-currency" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="text-xs">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} size="sm" className="h-8 text-xs">
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  Creating...
                </>
              ) : (
                "Create product"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <AlertDialog open={archiveId !== null} onOpenChange={() => !archiving && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Archive product?</AlertDialogTitle>
            <AlertDialogDescription>
              The product will no longer be available for new purchases. Existing subscribers will keep access. You can
              unarchive from the Polar dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={archiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
