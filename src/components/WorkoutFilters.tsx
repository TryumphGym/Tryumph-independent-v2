import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function ChoiceDropdown({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <div className="min-w-0 space-y-1.5"><p className="text-xs font-semibold text-muted-foreground">{label}</p><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>;
}

export function MultiDropdown({ label, values, options, onChange, emptyLabel = "Any", exclusive }: { label: string; values: string[]; options: readonly string[]; onChange: (values: string[]) => void; emptyLabel?: string; exclusive?: string }) {
  const summary = values.length ? values.length === 1 ? values[0] : `${values.length} selected` : emptyLabel;
  return <div className="min-w-0 space-y-1.5"><p className="text-xs font-semibold text-muted-foreground">{label}</p><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" aria-label={`${label}: ${summary}`} className="w-full justify-between px-3"><span className="truncate">{summary}</span><ChevronDown className="opacity-50" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)]"><DropdownMenuCheckboxItem checked={!values.length} onSelect={(e) => e.preventDefault()} onCheckedChange={() => onChange([])}>{emptyLabel}</DropdownMenuCheckboxItem>{options.map((option) => <DropdownMenuCheckboxItem key={option} checked={values.includes(option)} onSelect={(e) => e.preventDefault()} onCheckedChange={(checked) => onChange(checked ? option === exclusive ? [option] : [...values.filter((v) => v !== exclusive), option] : values.filter((v) => v !== option))}>{option}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div>;
}